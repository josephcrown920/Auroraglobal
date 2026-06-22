import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { PLANS } from "./billing.plans";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase.from("profiles").select("credits, plan, lifetime_credits_purchased, email, display_name").eq("user_id", userId).maybeSingle();
    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (rolesData ?? []).some((r) => r.role === "admin");
    if (!data) {
      await supabaseAdmin.from("profiles").insert({ user_id: userId, credits: 5 }).select().maybeSingle();
      return { credits: 5, plan: "free", lifetime_credits_purchased: 0, email: null as string | null, display_name: null as string | null, isAdmin };
    }
    return { ...data, isAdmin };
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
