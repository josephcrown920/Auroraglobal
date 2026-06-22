import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
  const crypto = require("crypto");
  const expected = crypto
    .createHmac("sha512", secret)
    .update(body)
    .digest("hex");

  // Timing-safe comparison to prevent timing attacks
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

/**
 * Process a successful payment charge event.
 * Grants credits and records affiliate conversion if applicable.
 */
export async function processPaymentSuccess(
  event: z.infer<typeof PaymentEventSchema>
) {
  const reference = event.data.reference;

  // Fetch payment record
  const { data: payment, error: payErr } = await supabaseAdmin
    .from("payments")
    .select("id, user_id, credits_granted, status, currency")
    .eq("reference", reference)
    .maybeSingle();

  if (payErr || !payment) {
    throw new Error(`Payment not found: ${reference}`);
  }

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

  // Mark payment as succeeded
  await supabaseAdmin
    .from("payments")
    .update({ status: "succeeded", raw: event })
    .eq("id", payment.id);

  // Track affiliate conversion if buyer was referred
  const raw = (payment as { raw?: { ref?: string } }).raw;
  const refCode = raw?.ref ?? event.data.metadata?.ref;

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

