// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- generated Supabase types lag the live schema; tracked separately
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
import { PLANS, SUBSCRIPTION_TIERS } from "./billing.plans";
import { applyPromoAtCheckout } from "./promo.functions";
import {
  GiftCardPurchaseSchema,
  createPendingPurchasedGiftCard,
  linkPurchasedGiftCardPayment,
} from "./gifts.functions";

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
    const { error: paymentError } = await supabaseAdmin.from("payments").insert({
      user_id: userId,
      reference,
      amount_kobo: usdMinor,
      currency: "USD",
      credits_granted: plan.credits,
      status: "pending",
      ...(appliedPromoCodeId
        ? { promo_code_id: appliedPromoCodeId, discount_percent_off: appliedPercentOff }
        : {}),
    });
    // Hard precondition: never create a payable invoice without a settlement
    // row, or the webhook can't find the payment and a paid customer gets
    // nothing.
    if (paymentError) throw new Error(paymentError.message);

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

export const createCryptoGiftCardCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GiftCardPurchaseSchema.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    if (!apiKey) throw new Error("Crypto payments not configured");
    const { userId } = context;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile?.email) throw new Error("Profile email missing — please re-login");
    const order = await createPendingPurchasedGiftCard(
      { admin: supabaseAdmin },
      userId,
      { ...data, recipientEmail: profile.email },
    );
    const reference = `aurora_crypto_gift_${userId.replace(/-/g, "")}_${Date.now()}`;
    let origin = process.env.SITE_URL;
    if (!origin) {
      try { origin = new URL(getRequest().url).origin; } catch { origin = ""; }
    }
    // Settlement row + card linkage BEFORE the invoice call: if any DB write
    // fails we bail out with no payable invoice in existence, so a customer
    // can never pay against an order the webhook can't settle.
    const cardId = (order.card as { id: string }).id;
    const { error } = await supabaseAdmin.from("payments").insert({
      user_id: userId,
      reference,
      amount_kobo: order.product.usdMinor,
      currency: "USD",
      credits_granted: 0,
      status: "pending",
      purpose: "gift_card",
      gift_card_id: cardId,
      pro_days: 0,
    });
    if (error) throw new Error(error.message);
    await linkPurchasedGiftCardPayment({ admin: supabaseAdmin }, cardId, reference, "nowpayments");
    const res = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        price_amount: Number((order.product.usdMinor / 100).toFixed(2)),
        price_currency: "usd",
        order_id: reference,
        order_description: `${order.product.label} — Aurora Gift Card`,
        ...(origin ? {
          ipn_callback_url: `${origin}/api/public/nowpayments-webhook`,
          success_url: `${origin}/gifts?paid=1&ref=${encodeURIComponent(reference)}`,
          cancel_url: `${origin}/gifts?cancelled=1`,
        } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Crypto checkout init failed: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { invoice_url?: string; id?: string };
    if (!json.invoice_url) throw new Error("Crypto checkout returned no invoice URL");
    return { authorizationUrl: json.invoice_url, reference, invoiceId: json.id ?? null };
  });

/** A crypto Pro month is deliberately one-time: no saved payment method or
 * automatic renewal is created on NOWPayments. */
export const createCryptoProMonthCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    if (!apiKey) throw new Error("Crypto payments not configured");
    const { userId } = context;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile?.email) throw new Error("Profile email missing — please re-login");
    const reference = `aurora_crypto_pro_${userId.replace(/-/g, "")}_${Date.now()}`;
    let origin = process.env.SITE_URL;
    if (!origin) {
      try { origin = new URL(getRequest().url).origin; } catch { origin = ""; }
    }
    const { error: paymentError } = await supabaseAdmin.from("payments").insert({
      user_id: userId,
      reference,
      amount_kobo: SUBSCRIPTION_TIERS.pro.price_amount_minor,
      currency: "USD",
      credits_granted: 0,
      status: "pending",
      purpose: "pro_one_time",
      pro_days: 30,
    } as never);
    if (paymentError) throw new Error(paymentError.message);
    const res = await fetch("https://api.nowpayments.io/v1/invoice", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        price_amount: Number((SUBSCRIPTION_TIERS.pro.price_amount_minor / 100).toFixed(2)),
        price_currency: "usd",
        order_id: reference,
        order_description: "Aurora Pro — one month, non-recurring",
        ...(origin ? {
          ipn_callback_url: `${origin}/api/public/nowpayments-webhook`,
          success_url: `${origin}/billing?proCrypto=1&ref=${encodeURIComponent(reference)}`,
          cancel_url: `${origin}/billing?cancelled=1`,
        } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Crypto Pro checkout init failed: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { invoice_url?: string; id?: string };
    if (!json.invoice_url) throw new Error("Crypto checkout returned no invoice URL");
    return { authorizationUrl: json.invoice_url, reference, invoiceId: json.id ?? null };
  });
