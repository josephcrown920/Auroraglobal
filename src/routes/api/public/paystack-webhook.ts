import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.PAYSTACK_SECRET_KEY;
        if (!key) return new Response("Not configured", { status: 500 });
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const body = await request.text();
        const expected = createHmac("sha512", key).update(body).digest("hex");
        try {
          if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
            return new Response("Invalid signature", { status: 401 });
          }
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }
        const event = JSON.parse(body) as { event: string; data: { reference: string; status: string; amount?: number; metadata?: { user_id?: string; credits?: number; ref?: string } } };
        if (event.event !== "charge.success" || event.data.status !== "success") {
          return new Response("ignored", { status: 200 });
        }
        const reference = event.data.reference;
        const { data: payment } = await supabaseAdmin
          .from("payments")
          .select("id, user_id, credits_granted, status, currency")
          .eq("reference", reference)
          .maybeSingle();
        if (!payment) return new Response("not found", { status: 200 });
        if (payment.status === "succeeded") return new Response("already processed", { status: 200 });

        await supabaseAdmin.rpc("grant_credits", {
          _user: payment.user_id,
          _amount: payment.credits_granted,
          _reason: "purchase",
          _ref: payment.id,
        });
        await supabaseAdmin.from("payments").update({ status: "succeeded", raw: event }).eq("id", payment.id);

        // Affiliate conversion: if the buyer was referred, record a conversion event
        // with a 20% (default) commission. The referral code is stored in payment.raw.ref
        // when the checkout was initiated; we also fall back to metadata.ref.
        try {
          const raw = (payment as { raw?: { ref?: string } }).raw;
          // Lifetime attribution: prefer the per-checkout ref, then fall back
          // to the referral code permanently stored on the buyer's profile.
          let refCode = raw?.ref ?? event.data.metadata?.ref;
          if (!refCode) {
            const { data: prof } = await supabaseAdmin
              .from("profiles")
              .select("referred_by_code")
              .eq("user_id", payment.user_id)
              .maybeSingle();
            refCode = prof?.referred_by_code ?? undefined;
          }
          if (refCode) {
            const { data: aff } = await supabaseAdmin
              .from("affiliates")
              .select("code, commission_pct, total_earned_usd")
              .eq("code", String(refCode).toLowerCase())
              .maybeSingle();
            if (aff) {
              // Paystack amount is in the minor unit of the charged currency (USD cents).
              const minor = Number((event.data as { amount?: number }).amount ?? 0);
              const usdValue = minor / 100;
              const amountUsd = usdValue * (aff.commission_pct / 100);
              await supabaseAdmin.from("affiliate_events").insert({
                code: aff.code,
                kind: "conversion",
                amount_usd: amountUsd,
                user_id: payment.user_id,
                ref_id: payment.id,
              });
              await supabaseAdmin.from("affiliates")
                .update({ total_earned_usd: Number(aff.total_earned_usd ?? 0) + amountUsd })
                .eq("code", aff.code);
            }
          }
        } catch {
          // never let affiliate accounting break a successful payment
        }
        return new Response("ok", { status: 200 });

      },
    },
  },
});