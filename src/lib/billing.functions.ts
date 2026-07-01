import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { PLANS, SUBSCRIPTION_TIERS } from "./billing.plans";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await (supabase.from("profiles") as any)
      .select("credits, plan, lifetime_credits_purchased, email, display_name, subscription_expires_at")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (rolesData ?? []).some((r) => r.role === "admin");
    if (!data) {
      await supabaseAdmin.from("profiles").insert({ user_id: userId, credits: 5 }).select().maybeSingle();
      return {
        credits: 5,
        plan: "free" as string,
        lifetime_credits_purchased: 0,
        email: null as string | null,
        display_name: null as string | null,
        subscription_expires_at: null as string | null,
        is_pro: false,
        isAdmin,
      };
    }
    return {
      ...data,
      is_pro: data.plan === "pro",
      isAdmin,
    };
  });

const InitPaystackSchema = z.object({
  plan: z.enum(["starter", "creator", "studio"]),
  currency: z.literal("USD").optional(),
});

export const createPaystackCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InitPaystackSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) throw new Error("Paystack not configured");
    const plan = PLANS[data.plan];

    const currency = "USD" as const;
    const price = plan.prices[currency];


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
        amount: price.amount_minor,
        currency,
        reference,
        ...(callback_url ? { callback_url } : {}),
        metadata: { user_id: userId, plan: data.plan, credits: plan.credits, currency },
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
      amount_kobo: price.amount_minor,
      currency,
      credits_granted: plan.credits,
      status: "pending",
    });
    return { authorizationUrl: json.data.authorization_url, reference: json.data.reference };
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

    await (supabaseAdmin as any)
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "active");

    await supabaseAdmin.rpc("deactivate_pro_subscription" as any, { _user: userId } as any);

    return { ok: true };
  });
