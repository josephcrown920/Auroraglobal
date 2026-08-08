// @ts-nocheck — stale Supabase types
// NOWPayments IPN receiver. External callers under /api/public/* bypass
// Lovable auth, so we verify HMAC-SHA512 with the store's IPN secret before
// touching any DB row.
//
// Signature contract (from https://nowpayments.io/help/):
//   sig = HMAC_SHA512(sortedJsonBody, NOWPAYMENTS_IPN_SECRET)
// where sortedJsonBody = JSON.stringify with keys sorted alphabetically,
// **recursively** for nested objects. Do not trust the raw body order.
//
// Terminal statuses that credit the user: "finished" and "confirmed".
// Non-terminal (waiting, confirming, sending, partially_paid) are 200-acked
// so NOWPayments stops retrying but no credit is granted.

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processPaymentSuccess } from "@/lib/paystack-webhook.server";
import { PLANS } from "@/lib/billing.plans";

function sortedStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(sortedStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${sortedStringify((value as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

function verifySignature(rawBody: string, sigHeader: string | null, secret: string): boolean {
  if (!sigHeader) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const canonical = sortedStringify(parsed);
  const expected = createHmac("sha512", secret).update(canonical).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sigHeader, "hex"));
  } catch {
    return false;
  }
}

type IPN = {
  payment_status?: string;
  order_id?: string;
  price_amount?: number;
  price_currency?: string;
  pay_amount?: number;
  pay_currency?: string;
  actually_paid?: number;
};

export const Route = createFileRoute("/api/public/nowpayments-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.NOWPAYMENTS_IPN_SECRET;
        if (!secret) return new Response("not configured", { status: 503 });

        const raw = await request.text();
        const sig = request.headers.get("x-nowpayments-sig");
        if (!verifySignature(raw, sig, secret)) {
          return new Response("bad signature", { status: 401 });
        }

        let body: IPN;
        try {
          body = JSON.parse(raw) as IPN;
        } catch {
          return new Response("bad json", { status: 400 });
        }

        const status = body.payment_status;
        const reference = body.order_id;
        if (!reference) return new Response("missing order_id", { status: 400 });

        // Ack non-terminal states without side effects.
        if (status !== "finished" && status !== "confirmed") {
          return new Response(`ack ${status}`, { status: 200 });
        }

        // Look up the pending payment row inserted at checkout time.
        const { data: payment } = await supabaseAdmin
          .from("payments")
          .select("id, user_id, credits_granted, status, amount_kobo")
          .eq("reference", reference)
          .maybeSingle();

        if (!payment) {
          console.error(`[nowpayments-webhook] no payment row for ref=${reference}`);
          // 409 → NOWPayments will retry, giving the checkout insert time to land.
          return new Response("payment not found", { status: 409 });
        }

        if (payment.status === "succeeded") {
          return new Response("already processed", { status: 200 });
        }

        // Reuse the exact same money path as Paystack (credit grant + 65/35
        // profit split + credit_ledger insert) — the shared processor is
        // reference-based and provider-agnostic.
        // Reuse the exact same money path as Paystack (credit grant + 65/35
        // profit split + credit_ledger insert) — the shared processor keys on
        // `reference` and only reads a couple of fields off the event.
        // Day passes carry a daily spend cap that the shared processor applies
        // from metadata.daily_limit (same as Paystack checkout). The pending
        // payments row doesn't store the plan key, but credits_granted uniquely
        // identifies each pack — recover the plan to forward its cap.
        const planEntry = Object.values(PLANS).find((p) => p.credits === payment.credits_granted);
        const dailyLimit =
          planEntry && "daily_limit" in planEntry && typeof planEntry.daily_limit === "number"
            ? planEntry.daily_limit
            : undefined;

        try {
          await processPaymentSuccess({
            event: "charge.success",
            data: {
              reference,
              status: "success",
              amount: payment.amount_kobo,
              metadata: {
                user_id: payment.user_id,
                credits: payment.credits_granted,
                ...(dailyLimit ? { daily_limit: dailyLimit } : {}),
              },
            },
          } as never);
        } catch (e) {
          console.error(`[nowpayments-webhook] processing failed for ref=${reference}`, e);
          return new Response("processing failed", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
