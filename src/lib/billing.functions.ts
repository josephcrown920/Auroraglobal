import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequest } from "@tanstack/react-start/server";
import { createHash } from "crypto";
import { z } from "zod";
import { PLANS, SUBSCRIPTION_TIERS } from "./billing.plans";
import { applyPromoAtCheckout } from "./promo.functions";

/** Stable MD5-based UUID that matches the SQL expression in grant_free_monthly_aura_all(). */
function deterministicUuid(input: string): string {
  const hash = createHash("md5").update(input).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await (supabase.from("profiles") as any)
      .select(
        "credits, plan, lifetime_credits_purchased, email, display_name, subscription_expires_at, daily_spend_limit",
      )
      .eq("user_id", userId)
      .maybeSingle();
    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (rolesData ?? []).some((r) => r.role === "admin");
    // Fetch subscription status so UI can show cancellation_pending correctly.
    const { data: subData } = await (supabase as any)
      .from("subscriptions")
      .select("status, next_payment_date")
      .eq("user_id", userId)
      .in("status", ["active", "cancellation_pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const subscription_status: string | null = subData?.status ?? null;
    if (!data) {
      // Create profile with zero balance, then credit the free monthly Aura via
      // grant_monthly_aura so the ledger entry is created.  The deterministic ref
      // matches grant_free_monthly_aura_all(), making the cron a no-op for this month.
      const freeAmount = SUBSCRIPTION_TIERS.free.monthly_aura;
      await supabaseAdmin.from("profiles").insert({ user_id: userId, credits: 0 }).select().maybeSingle();
      const month = new Date().toISOString().slice(0, 7); // e.g. "2026-07"
      await supabaseAdmin.rpc("grant_monthly_aura" as any, {
        _user: userId,
        _amount: freeAmount,
        _ref: deterministicUuid(`free:${userId}:${month}`),
      } as any);
      return {
        credits: freeAmount,
        plan: "free" as string,
        lifetime_credits_purchased: 0,
        email: null as string | null,
        display_name: null as string | null,
        subscription_expires_at: null as string | null,
        daily_spend_limit: null as number | null,
        is_pro: false,
        subscription_status,
        isAdmin,
      };
    }
    return {
      ...data,
      is_pro: data.plan === "pro",
      subscription_status,
      isAdmin,
    };
  });

const SetDailySpendLimitSchema = z.object({
  limit: z.number().int().positive().max(1_000_000).nullable(),
});

/** Set or clear the caller's personal daily Aura cap. Enforced for real inside
 * the reserve_credits() RPC; this just persists the setting. `null` clears it
 * (no limit). */
export const setDailySpendLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetDailySpendLimitSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ daily_spend_limit: data.limit } as any)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { daily_spend_limit: data.limit };
  });

/** One-time reward for finishing the onboarding vibe+selfie flow — enforced
 * server-side via claim_onboarding_bonus (CAS on profiles.onboarding_bonus_granted)
 * so a retried client call can never double-grant. */
export const ONBOARDING_BONUS_AURA = 3;

export const claimOnboardingBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: granted, error } = await supabaseAdmin.rpc("claim_onboarding_bonus" as any, {
      _user: userId,
      _amount: ONBOARDING_BONUS_AURA,
    } as any);
    if (error) throw new Error(error.message);
    return { granted: Boolean(granted), amount: ONBOARDING_BONUS_AURA };
  });

const InitPaystackSchema = z.object({
  plan: z.enum(["starter", "creator", "studio"]),
  currency: z.enum(["USD", "NGN", "GHS", "ZAR", "KES", "EGP"]).optional(),
  promoCode: z.string().min(1).max(40).optional(),
});

export const createPaystackCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InitPaystackSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) throw new Error("Paystack not configured");
    const plan = PLANS[data.plan];

    const currency = (data.currency ?? "USD") as import("./billing.plans").Currency;
    const price = plan.prices[currency] ?? plan.prices["USD"];

    let amountMinor: number = price.amount_minor;
    let appliedPromoCodeId: string | null = null;
    let appliedPercentOff: number | null = null;
    if (data.promoCode) {
      const applied = await applyPromoAtCheckout(userId, data.promoCode, amountMinor);
      amountMinor = applied.amountMinor;
      appliedPromoCodeId = applied.promoCodeId;
      appliedPercentOff = applied.percentOff;
    }

    const { data: profile } = await supabaseAdmin.from("profiles").select("email").eq("user_id", userId).maybeSingle();
    const email = profile?.email;
    if (!email) throw new Error("Profile email missing — please re-login");
    const reference = `aurora_${userId.replace(/-/g, "")}_${Date.now()}`;
    let origin = process.env.SITE_URL;
    if (!origin) {
      try {
        const req = getRequest();
        origin = new URL(req.url).origin;
      } catch {
        origin = "";
      }
    }
    const callback_url = origin ? `${origin}/studio?paid=1` : undefined;
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: amountMinor,
        currency,
        reference,
        ...(callback_url ? { callback_url } : {}),
        metadata: { user_id: userId, plan: data.plan, credits: plan.credits, currency, promo_code_id: appliedPromoCodeId },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Paystack init failed: ${t.slice(0, 200)}`);
    }
    const json = await res.json() as { status: boolean; data: { authorization_url: string; reference: string } };
    if (!json.status) throw new Error("Paystack init failed");
    await supabaseAdmin.from("payments").insert({
      user_id: userId,
      reference: json.data.reference,
      amount_kobo: amountMinor,
      currency,
      credits_granted: plan.credits,
      status: "pending",
      ...(appliedPromoCodeId ? { promo_code_id: appliedPromoCodeId, discount_percent_off: appliedPercentOff } : {}),
    } as any);
    return { authorizationUrl: json.data.authorization_url, reference: json.data.reference };
  });

/** Looks up a succeeded payment by Paystack reference, scoped to the caller's
 * own user_id, so the studio page can report the exact amount/currency to
 * the GTM dataLayer after the ?paid=1 redirect without trusting client-side
 * query params for the charge amount. */
export const getPaymentByReference = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ reference: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("reference, amount_kobo, currency, status")
      .eq("reference", data.reference)
      .eq("user_id", userId)
      .eq("status", "succeeded")
      .maybeSingle();
    if (!payment) return null;
    return {
      reference: payment.reference,
      amount: payment.amount_kobo / 100,
      currency: payment.currency,
    };
  });

// ── Pro subscription checkout ─────────────────────────────────────────────────

/** Get or create the Aurora Pro Paystack plan, caching the plan_code. */
async function getOrCreateProPlan(key: string): Promise<string> {
  const { data: setting } = await (supabaseAdmin as any)
    .from("app_settings")
    .select("value")
    .eq("key", "paystack_pro_plan_code")
    .maybeSingle();
  if (setting?.value && typeof (setting.value as { code?: string }).code === "string") {
    return (setting.value as { code: string }).code;
  }

  const tier = SUBSCRIPTION_TIERS.pro;
  const res = await fetch("https://api.paystack.co/plan", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Aurora Pro",
      interval: "monthly",
      amount: tier.price_amount_minor,
      currency: "USD",
      description: "Aurora Pro — no watermark, priority queue, 200 Aura/month",
    }),
  });
  const json = await res.json() as { status: boolean; data: { plan_code: string } };
  if (!json.status) throw new Error("Failed to create Paystack Pro plan");
  const planCode = json.data.plan_code;
  await (supabaseAdmin as any)
    .from("app_settings")
    .upsert({ key: "paystack_pro_plan_code", value: { code: planCode } });
  return planCode;
}

export const createProSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) throw new Error("Paystack not configured");

    const planCode = await getOrCreateProPlan(key);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();
    const email = profile?.email;
    if (!email) throw new Error("Profile email missing — please re-login");

    let origin = process.env.SITE_URL;
    if (!origin) {
      try {
        const req = getRequest();
        origin = new URL(req.url).origin;
      } catch {
        origin = "";
      }
    }
    const callback_url = origin ? `${origin}/billing?subscribed=1` : undefined;
    const reference = `aurora_pro_${userId.replace(/-/g, "")}_${Date.now()}`;

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amount: SUBSCRIPTION_TIERS.pro.price_amount_minor,
        currency: "USD",
        reference,
        plan: planCode,
        ...(callback_url ? { callback_url } : {}),
        metadata: { user_id: userId, type: "pro_subscription" },
      }),
    });
    if (!res.ok) throw new Error(`Paystack init failed: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json() as { status: boolean; data: { authorization_url: string; reference: string } };
    if (!json.status) throw new Error("Paystack subscription init failed");
    return { authorizationUrl: json.data.authorization_url };
  });

export const cancelProSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) throw new Error("Paystack not configured");

    const { data: sub } = await (supabaseAdmin as any)
      .from("subscriptions")
      .select("paystack_subscription_code, paystack_email_token")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (!sub?.paystack_subscription_code) {
      throw new Error("No active subscription found");
    }

    const res = await fetch("https://api.paystack.co/subscription/disable", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        code: sub.paystack_subscription_code,
        token: sub.paystack_email_token ?? "",
      }),
    });
    if (!res.ok) throw new Error(`Paystack disable failed: ${(await res.text()).slice(0, 200)}`);

    // Mark as cancellation_pending — Pro access stays active until Paystack fires
    // subscription.disable (end of billing period). deactivate_pro_subscription is
    // called ONLY from the webhook, never here, to preserve billing-period access.
    await (supabaseAdmin as any)
      .from("subscriptions")
      .update({ status: "cancellation_pending", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "active");

    return { ok: true };
  });
