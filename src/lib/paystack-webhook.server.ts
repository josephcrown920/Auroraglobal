import { createHmac, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeProfitSplit } from "@/lib/profit-split";
import { z } from "zod";

/**
 * Paystack webhook verification and payment processing.
 * Signature verification + credit grant + affiliate conversion tracking.
 */

const PaymentEventSchema = z.object({
  event: z.string(),
  data: z.object({
    reference: z.string(),
    status: z.string(),
    amount: z.number().optional(),
    metadata: z.object({
      user_id: z.string().optional(),
      credits: z.number().optional(),
      ref: z.string().optional(),
      /** Set for day1/day2 passes — auto-applied as daily_spend_limit on success. */
      daily_limit: z.number().optional(),
    }).optional(),
  }),
});

/**
 * Verify Paystack webhook signature using HMAC-SHA512.
 */
export function verifyPaystackSignature(
  signature: string,
  body: string,
  secret: string
): boolean {
  const expected = createHmac("sha512", secret).update(body).digest("hex");

  // Timing-safe comparison to prevent timing attacks
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const PAYMENT_COLUMNS = "id, user_id, credits_granted, status, currency, amount_kobo";

type PaymentRow = {
  id: string;
  user_id: string;
  credits_granted: number;
  status: string;
  currency: string;
  amount_kobo: number;
};

async function fetchPayment(reference: string): Promise<PaymentRow | null> {
  const { data } = await supabaseAdmin
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("reference", reference)
    .maybeSingle();
  return (data as PaymentRow | null) ?? null;
}

/**
 * Find the payments row for a webhook reference, tolerating the race where
 * Paystack's webhook arrives before the checkout redirect has finished
 * inserting the `payments` row. We retry with backoff first (the row usually
 * shows up within a second or two); if it still hasn't appeared, we recover
 * by reconstructing the row from the webhook's own metadata (set at checkout
 * init time) so a paid customer never loses their credits to the race.
 */
async function findOrRecoverPayment(
  event: z.infer<typeof PaymentEventSchema>,
  retryDelaysMs: number[]
): Promise<PaymentRow> {
  const reference = event.data.reference;

  let payment = await fetchPayment(reference);
  for (let i = 0; !payment && i < retryDelaysMs.length; i++) {
    await sleep(retryDelaysMs[i]);
    payment = await fetchPayment(reference);
  }
  if (payment) return payment;

  const meta = event.data.metadata;
  if (!meta?.user_id || meta.credits == null) {
    throw new Error(`Payment not found: ${reference}`);
  }

  // Attempt to create the missing row ourselves. If it was created
  // concurrently in the meantime (unique `reference` constraint), fall back
  // to reading whatever got persisted instead of overwriting it.
  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("payments")
    .insert({
      reference,
      user_id: meta.user_id,
      credits_granted: meta.credits,
      amount_kobo: event.data.amount ?? 0,
      currency: "USD",
      status: "pending",
    })
    .select(PAYMENT_COLUMNS)
    .maybeSingle();

  if (!insertErr && inserted) {
    return inserted as PaymentRow;
  }

  const recovered = await fetchPayment(reference);
  if (!recovered) {
    throw new Error(`Payment not found: ${reference}`);
  }
  return recovered;
}

const DEFAULT_RETRY_DELAYS_MS = [200, 500, 1000, 2000];

/**
 * Process a successful payment charge event.
 * Grants credits and records affiliate conversion if applicable.
 */
export async function processPaymentSuccess(
  event: z.infer<typeof PaymentEventSchema>,
  opts: { retryDelaysMs?: number[] } = {}
) {
  const payment = await findOrRecoverPayment(
    event,
    opts.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS
  );

  if (payment.status === "succeeded") {
    return { status: "already_processed" };
  }

  // Grant credits to user
  await supabaseAdmin.rpc("grant_credits", {
    _user: payment.user_id,
    _amount: payment.credits_granted,
    _reason: "purchase",
    _ref: payment.id,
  });

  // Day passes: auto-set the daily spend limit so usage is naturally spread
  // across the pass duration (e.g. 1-Day Pass → 15 Aura/day, 2-Day → 13/day).
  // Carried on metadata.daily_limit by createPaystackCheckout.
  const dailyLimit = event.data.metadata?.daily_limit;
  if (typeof dailyLimit === "number" && dailyLimit > 0) {
    await supabaseAdmin
      .from("profiles")
      .update({ daily_spend_limit: dailyLimit } as never)
      .eq("user_id", payment.user_id);
  }

  // Mark payment as succeeded and persist the owner profit / credit-funding split.
  const split = computeProfitSplit(payment.amount_kobo);
  await supabaseAdmin
    .from("payments")
    .update({
      status: "succeeded",
      raw: event,
      profit_amount_minor: split.profit_minor,
      credit_funding_amount_minor: split.credit_funding_minor,
      split_profit_pct: split.profit_pct,
    })
    .eq("id", payment.id);

  // Track affiliate conversion if buyer was referred. Prefer the ref carried
  // on the payment/webhook itself; fall back to the buyer's profile-level
  // referral code (set at signup) if neither is present.
  const raw = (payment as { raw?: { ref?: string } }).raw;
  let refCode = raw?.ref ?? event.data.metadata?.ref;
  if (!refCode) {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("referred_by_code")
      .eq("user_id", payment.user_id)
      .maybeSingle();
    refCode = (prof as { referred_by_code?: string } | null)?.referred_by_code ?? undefined;
  }

  if (refCode) {
    const { data: aff } = await supabaseAdmin
      .from("affiliates")
      .select("code, commission_pct, total_earned_usd")
      .eq("code", String(refCode).toLowerCase())
      .maybeSingle();

    if (aff) {
      const minor = Number(event.data.amount ?? 0);
      const usdValue = minor / 100;
      const amountUsd = usdValue * (aff.commission_pct / 100);

      await supabaseAdmin.from("affiliate_events").insert({
        code: aff.code,
        kind: "conversion",
        amount_usd: amountUsd,
        user_id: payment.user_id,
        ref_id: payment.id,
      });

      // Update affiliate total earned
      await supabaseAdmin
        .from("affiliates")
        .update({
          total_earned_usd: (aff.total_earned_usd || 0) + amountUsd,
        })
        .eq("code", aff.code);
    }
  }

  return { status: "success", paymentId: payment.id };
}

/**
 * Server function: verify and process webhook (called from route)
 */
export const verifyAndProcessWebhook = createServerFn({ method: "POST" })
  .inputValidator((input: { signature: string; body: string }) => input)
  .handler(async ({ data: input }) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) throw new Error("Paystack secret not configured");

    if (!verifyPaystackSignature(input.signature, input.body, secret)) {
      throw new Error("Invalid signature");
    }

    const event = PaymentEventSchema.parse(JSON.parse(input.body));

    if (event.event !== "charge.success" || event.data.status !== "success") {
      return { status: "ignored" };
    }

    return processPaymentSuccess(event);
  });

