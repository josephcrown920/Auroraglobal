// @ts-nocheck — stale Supabase types: live DB missing tables/columns from local migrations
// Crypto checkout via NOWPayments (hosted invoice supports BTC, ETH, USDT,
// USDC, SOL, LTC, TRX, and 100+ other coins). Requires:
//   NOWPAYMENTS_API_KEY   — merchant API key (nowpayments.io → Store settings)
//   NOWPAYMENTS_IPN_SECRET — IPN callback secret (same dashboard page)
// The IPN webhook at /api/public/nowpayments-webhook re-uses the same
// processPaymentSuccess money-path as Paystack, so credit grant + 65/35
// profit split behavior stays identical across providers.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { PLANS } from "./billing.plans";
import { applyPromoAtCheckout } from "./promo.functions";

const InitCryptoSchema = z.object({
  plan: z.enum(["day1", "day2", "starter", "creator", "studio"]),
  promoCode: z.string().min(1).max(40).optional(),
});

export const createCryptoCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InitCryptoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    if (!apiKey) throw new Error("Crypto payments not configured");
    const plan = PLANS[data.plan];

    // Crypto is priced in USD (major units). NOWPayments takes price_amount as
    // a decimal — always operate in USD regardless of the user's local
    // Paystack currency, since crypto rails are global.
    let usdMinor = plan.prices.USD.amount_minor;
    let appliedPromoCodeId: string | null = null;
    let appliedPercentOff: number | null = null;
    if (data.promoCode) {
      const applied = await applyPromoAtCheckout(userId, data.promoCode, usdMinor);
      usdMinor = applied.amountMinor;
      appliedPromoCodeId = applied.promoCodeId;
      appliedPercentOff = applied.percentOff;
    }
    const usdAmount = (usdMinor / 100).toFixed(2);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();
    const email = profile?.email;
    if (!email) throw new Error("Profile email missing — please re-login");

    const reference = `aurora_crypto_${userId.replace(/-/g, "")}_${Date.now()}`;
    let origin = process.env.SITE_URL;
    if (!origin) {
      try {
        origin = new URL(getRequest().url).origin;
      } catch {
        origin = "";
      }
    }

    // Insert the pending payment row BEFORE the invoice call so the webhook
    // can always find it by reference (same pattern as Paystack — see
    // billing.functions.ts). Reference = order_id sent to NOWPayments.
    await supabaseAdmin.from("payments").insert({
      user_id: userId,
      reference,
      amount_kobo: usdMinor,
      currency: "USD",
      credits_granted: plan.credits,
      status: "pending",
      ...(appliedPromoCodeId
        ? { promo_code_id: appliedPromoCodeId, discount_percent_off: appliedPercentOff }
        : {}),
    } as any);

    const ipnCallback = origin ? `${origin}/api/public/nowpayments-webhook` : undefined;
    const successUrl = origin ? `${origin}/studio?paid=1&ref=${encodeURIComponent(reference)}` : undefined;
    const cancelUrl = origin ? `${origin}/billing?cancelled=1` : undefined;

    const res = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        price_amount: Number(usdAmount),
        price_currency: "usd",
        order_id: reference,
        order_description: `${plan.label} — Aurora Performance Studio`,
        // NOWPayments requires these to be full absolute URLs.
        ipn_callback_url: ipnCallback,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Crypto checkout init failed: ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as { invoice_url?: string; id?: string };
    if (!json.invoice_url) throw new Error("Crypto checkout returned no invoice URL");

    return { authorizationUrl: json.invoice_url, reference, invoiceId: json.id ?? null };
  });
