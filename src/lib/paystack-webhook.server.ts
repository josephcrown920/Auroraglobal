import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SUBSCRIPTION_TIERS } from "@/lib/billing.plans";
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

type SubscriptionCustomer = {
  customer_code?: string;
  email?: string;
};

type SubscriptionPlan = {
  plan_code?: string;
};

export type PaystackSubscriptionCreateData = {
  amount?: number;
  subscription_code?: string;
  customer?: SubscriptionCustomer;
  plan?: SubscriptionPlan;
  next_payment_date?: string;
  email_token?: string;
};

export type PaystackSubscriptionRenewalData = {
  subscription_code?: string;
  metadata?: {
    user_id?: string;
  };
};

export type PaystackSubscriptionDisableData = {
  subscription_code?: string;
};

/**
 * Derive a stable, deterministic UUID from an arbitrary string input.
 * Using this for monthly grants makes both subscription.create and the first
 * charge.success idempotent, while allowing each later month to grant once.
 */
function deterministicUuid(input: string): string {
  const hash = createHash("md5").update(input).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function proMonthlyAuraRef(subCode: string): string {
  const month = new Date().toISOString().slice(0, 7);
  return deterministicUuid(`${subCode}:${month}`);
}

function fallbackSubscriptionExpiry(): string {
  return new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Activate a Pro subscription after Paystack's subscription.create event.
 *
 * Keep subscription business logic here rather than in the HTTP route. This
 * function is intentionally exported so the webhook behavior can be tested
 * without constructing a request or reproducing the route's Supabase calls.
 */
export async function processSubscriptionCreate(data: PaystackSubscriptionCreateData) {
  const subCode = data.subscription_code ?? "";
  const customerEmail = data.customer?.email ?? "";
  const emailToken = data.email_token ?? "";
  const customerCode = data.customer?.customer_code ?? "";
  const planCode = data.plan?.plan_code ?? "";
  const nextPaymentDate = data.next_payment_date ?? null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .eq("email", customerEmail)
    .maybeSingle();
  const userId = profile?.user_id ?? null;

  if (!userId || !subCode) return { status: "ignored" as const };

  await supabaseAdmin.rpc("activate_pro_subscription", {
    _user: userId,
    _sub_code: subCode,
    _expires_at: nextPaymentDate ? new Date(nextPaymentDate).toISOString() : fallbackSubscriptionExpiry(),
  });

  await supabaseAdmin.rpc("grant_monthly_aura", {
    _user: userId,
    _amount: SUBSCRIPTION_TIERS.pro.monthly_aura,
    _ref: proMonthlyAuraRef(subCode),
  });

  await supabaseAdmin.from("subscriptions").upsert({
    user_id: userId,
    paystack_subscription_code: subCode,
    paystack_customer_code: customerCode,
    paystack_email_token: emailToken,
    plan_code: planCode,
    status: "active",
    next_payment_date: nextPaymentDate,
    amount_minor: data.amount ?? SUBSCRIPTION_TIERS.pro.price_amount_minor,
    currency: "USD",
  }, { onConflict: "paystack_subscription_code" });

  return { status: "success" as const, userId, subscriptionCode: subCode };
}

/**
 * Keep a Pro subscription active and grant its monthly Aura on renewal.
 */
export async function processSubscriptionRenewal(data: PaystackSubscriptionRenewalData) {
  const subCode = data.subscription_code ?? "";
  if (!subCode) return { status: "ignored" as const };

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id, next_payment_date")
    .eq("paystack_subscription_code", subCode)
    .maybeSingle();
  const userId: string | null = sub?.user_id ?? data.metadata?.user_id ?? null;

  if (!userId) return { status: "ignored" as const };

  const newExpiry = fallbackSubscriptionExpiry();

  await supabaseAdmin.rpc("activate_pro_subscription", {
    _user: userId,
    _sub_code: subCode,
    _expires_at: newExpiry,
  });

  await supabaseAdmin.rpc("grant_monthly_aura", {
    _user: userId,
    _amount: SUBSCRIPTION_TIERS.pro.monthly_aura,
    _ref: proMonthlyAuraRef(subCode),
  });

  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "active", next_payment_date: newExpiry, updated_at: new Date().toISOString() })
    .eq("paystack_subscription_code", subCode);

  return { status: "success" as const, userId, subscriptionCode: subCode };
}

/**
 * End Pro access only after Paystack confirms the subscription is disabled.
 */
export async function processSubscriptionDisable(data: PaystackSubscriptionDisableData) {
  const subCode = data.subscription_code ?? "";
  if (!subCode) return { status: "ignored" as const };

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id")
    .eq("paystack_subscription_code", subCode)
    .maybeSingle();
  const userId: string | null = sub?.user_id ?? null;

  if (!userId) return { status: "ignored" as const };

  await supabaseAdmin.rpc("deactivate_pro_subscription", { _user: userId });
  await supabaseAdmin
    .from("subscriptions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("paystack_subscription_code", subCode);

  return { status: "success" as const, userId, subscriptionCode: subCode };
}

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
  // across the pass duration (e.g. 1-Day Pass → 150 Aura/day, 2-Day → 130/day).
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

