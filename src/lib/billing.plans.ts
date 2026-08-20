// Multi-currency pricing with geo-based PPP adjustments.
// Aura quantities stay fixed; only the fiat amount changes by country.
//
// Currency is intentionally broader than the currency currently enabled on
// the Nigerian Paystack merchant. computeLocalPrice() remains useful for
// regional display/rate calculations; checkout quotes are always NGN until
// the merchant's multi-currency capability is explicitly verified.
export type Currency =
  | "USD" | "NGN" | "GHS" | "ZAR" | "KES" | "EGP"
  | "EUR" | "GBP" | "INR" | "BRL" | "IDR" | "PKR" | "JPY"
  | "AUD" | "CAD" | "AED" | "SAR" | "PHP" | "TRY" | "VND"
  | "BDT" | "LKR" | "COP" | "CLP" | "MXN" | "NZD";

export type PaystackCurrency = "USD" | "NGN" | "GHS" | "ZAR" | "KES" | "EGP";

export const PAYSTACK_SUPPORTED_CURRENCIES: readonly PaystackCurrency[] = [
  "NGN",
];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$", NGN: "₦", GHS: "₵", ZAR: "R", KES: "KES ", EGP: "EGP ",
  EUR: "€", GBP: "£", INR: "₹", BRL: "R$", IDR: "Rp ", PKR: "₨", JPY: "¥",
  AUD: "A$", CAD: "C$", AED: "د.إ ", SAR: "﷼", PHP: "₱", TRY: "₺",
  VND: "₫", BDT: "৳", LKR: "Rs ", COP: "COL$", CLP: "CLP$", MXN: "MX$", NZD: "NZ$",
};

export type CountryCurrency = { currency: Currency; locale: string };

/** Country routing is server-owned; this table is never selected by the browser. */
export const COUNTRY_CURRENCY_MAP: Record<string, CountryCurrency> = {
  NG: { currency: "NGN", locale: "en-NG" },
  GH: { currency: "GHS", locale: "en-GH" },
  KE: { currency: "KES", locale: "en-KE" },
  ZA: { currency: "ZAR", locale: "en-ZA" },
  EG: { currency: "EGP", locale: "ar-EG" },
  JP: { currency: "JPY", locale: "ja-JP" },
  IN: { currency: "INR", locale: "en-IN" },
  BR: { currency: "BRL", locale: "pt-BR" },
  ID: { currency: "IDR", locale: "id-ID" },
  PK: { currency: "PKR", locale: "en-PK" },
  PH: { currency: "PHP", locale: "en-PH" },
  TR: { currency: "TRY", locale: "tr-TR" },
  VN: { currency: "VND", locale: "vi-VN" },
  BD: { currency: "BDT", locale: "bn-BD" },
  LK: { currency: "LKR", locale: "en-LK" },
  CO: { currency: "COP", locale: "es-CO" },
  CL: { currency: "CLP", locale: "es-CL" },
  MX: { currency: "MXN", locale: "es-MX" },
  AE: { currency: "AED", locale: "en-AE" },
  SA: { currency: "SAR", locale: "en-SA" },
  // Keep high-income regions on Aurora's standard USD list price. This also
  // avoids advertising a display currency Paystack cannot charge for this
  // merchant before multi-currency approval is available.
  AU: { currency: "USD", locale: "en-US" },
  NZ: { currency: "USD", locale: "en-US" },
  CA: { currency: "USD", locale: "en-US" },
  GB: { currency: "USD", locale: "en-US" },
  DE: { currency: "USD", locale: "en-US" },
  FR: { currency: "USD", locale: "en-US" },
  IT: { currency: "USD", locale: "en-US" },
  ES: { currency: "USD", locale: "en-US" },
  NL: { currency: "USD", locale: "en-US" },
  US: { currency: "USD", locale: "en-US" },
};

export const PPP_MULTIPLIERS: Record<string, number> = {
  NG: 0.35, GH: 0.5, KE: 0.5, ZA: 0.65, EG: 0.45,
  IN: 0.4, BR: 0.55, ID: 0.4, PK: 0.35, PH: 0.45,
  TR: 0.5, VN: 0.4, BD: 0.35, LK: 0.4, CO: 0.55,
  CL: 0.65, MX: 0.6,
};

/** Approximate USD → local-currency rates, used only for deterministic pricing. */
export const USD_TO_LOCAL_RATE: Record<Currency, number> = {
  USD: 1, NGN: 1550, GHS: 15.5, ZAR: 18.5, KES: 130, EGP: 49,
  EUR: 0.92, GBP: 0.78, INR: 83, BRL: 5.5, IDR: 16000, PKR: 280, JPY: 150,
  AUD: 1.5, CAD: 1.36, AED: 3.67, SAR: 3.75, PHP: 58, TRY: 32, VND: 25000,
  BDT: 117, LKR: 300, COP: 4200, CLP: 9500, MXN: 18, NZD: 1.65,
};

const ZERO_DECIMAL_CURRENCIES = new Set<Currency>(["JPY", "IDR", "VND"]);

export function getPppMultiplier(country: string | null): number {
  const code = country?.trim().toUpperCase() ?? "";
  return PPP_MULTIPLIERS[code] ?? 1;
}

function minorUnitScale(currency: Currency): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100;
}

export type LocalPrice = {
  amountMinor: number;
  currency: Currency;
  pppMultiplier: number;
  displayLocale: string;
};

export function computeLocalPrice(amountUsdMinor: number, country: string | null): LocalPrice {
  const code = country?.trim().toUpperCase() ?? "";
  const mapped = COUNTRY_CURRENCY_MAP[code] ?? { currency: "USD" as Currency, locale: "en-US" };
  const scale = minorUnitScale(mapped.currency);
  const amountUsd = Math.max(0, Number(amountUsdMinor) || 0) / 100;
  const amountMinor = Math.round(amountUsd * USD_TO_LOCAL_RATE[mapped.currency] * getPppMultiplier(code) * scale);
  return {
    amountMinor,
    currency: mapped.currency,
    pppMultiplier: getPppMultiplier(code),
    displayLocale: mapped.locale,
  };
}

/**
 * Paystack currently accepts NGN only for this merchant. Keep PPP discounts,
 * but calculate the final quote and displayed amount in chargeable NGN rather
 * than advertising a currency Paystack will reject.
 */
export function computePaystackPrice(amountUsdMinor: number, country: string | null): LocalPrice {
  const code = country?.trim().toUpperCase() ?? "";
  const scale = minorUnitScale("NGN");
  return {
    amountMinor: Math.round(
      (Math.max(0, Number(amountUsdMinor) || 0) / 100)
        * USD_TO_LOCAL_RATE.NGN
        * getPppMultiplier(code)
        * scale,
    ),
    currency: "NGN",
    pppMultiplier: getPppMultiplier(code),
    displayLocale: "en-NG",
  };
}

export function formatLocalPrice(price: LocalPrice): string {
  return new Intl.NumberFormat(price.displayLocale, {
    style: "currency",
    currency: price.currency,
    maximumFractionDigits: minorUnitScale(price.currency) === 1 ? 0 : 2,
  }).format(price.amountMinor / minorUnitScale(price.currency));
}

// USD prices: Starter $10 | Creator $30 | Studio $80
// Africa prices: ~$6.50 / $20 / $53 USD equivalent (PPP-adjusted)
//
// Day passes sit outside the regular credit-pack tiers — they are short-term
// affordable entry points priced slightly above the Starter rate per Aura
// ($0.0133–$0.014 vs $0.0125 after the 2026-07-19 ×10 rebase) to reflect the
// smaller commitment. When purchased
// the webhook auto-sets the buyer's daily_spend_limit to `daily_limit` Aura
// so they naturally spread usage across the pass duration.
export const PLANS = {
  /** 1-Day Pass — 150 Aura. Auto-sets 150 Aura/day daily limit on purchase. */
  day1: {
    credits: 150,
    label: "1-Day Pass — 150 Aura",
    usd: 2,
    /** Auto-applied daily_spend_limit (Aura/day) when this pass is purchased. */
    daily_limit: 150,
    prices: {
      USD: { amount_minor: 2_00,        display: "$2" },
      NGN: { amount_minor: 2_000_00,    display: "₦2,000" },
      GHS: { amount_minor: 20_00,       display: "₵20" },
      KES: { amount_minor: 169_00,      display: "KES 169" },
      ZAR: { amount_minor: 24_00,       display: "R24" },
      EGP: { amount_minor: 64_00,       display: "EGP 64" },
    } as Record<Currency, { amount_minor: number; display: string }>,
  },
  /** 2-Day Pass — 250 Aura. Auto-sets 130 Aura/day daily limit on purchase. */
  day2: {
    credits: 250,
    label: "2-Day Pass — 250 Aura",
    usd: 3.5,
    /** Auto-applied daily_spend_limit (Aura/day) when this pass is purchased. */
    daily_limit: 130,
    prices: {
      USD: { amount_minor: 3_50,        display: "$3.50" },
      NGN: { amount_minor: 3_400_00,    display: "₦3,400" },
      GHS: { amount_minor: 35_00,       display: "₵35" },
      KES: { amount_minor: 295_00,      display: "KES 295" },
      ZAR: { amount_minor: 42_00,       display: "R42" },
      EGP: { amount_minor: 111_00,      display: "EGP 111" },
    } as Record<Currency, { amount_minor: number; display: string }>,
  },
  starter: {
    credits: 800,
    label: "Starter — 800 Aura",
    usd: 10,
    prices: {
      USD: { amount_minor: 10_00,       display: "$10" },
      NGN: { amount_minor: 9_750_00,    display: "₦9,750" },
      GHS: { amount_minor: 100_00,      display: "₵100" },
      KES: { amount_minor: 845_00,      display: "KES 845" },
      ZAR: { amount_minor: 120_00,      display: "R120" },
      EGP: { amount_minor: 318_00,      display: "EGP 318" },
    } as Record<Currency, { amount_minor: number; display: string }>,
  },
  creator: {
    credits: 2400,
    label: "Creator — 2,400 Aura",
    usd: 30,
    prices: {
      USD: { amount_minor: 30_00,       display: "$30" },
      NGN: { amount_minor: 31_000_00,   display: "₦31,000" },
      GHS: { amount_minor: 310_00,      display: "₵310" },
      KES: { amount_minor: 2_600_00,    display: "KES 2,600" },
      ZAR: { amount_minor: 370_00,      display: "R370" },
      EGP: { amount_minor: 980_00,      display: "EGP 980" },
    } as Record<Currency, { amount_minor: number; display: string }>,
  },
  studio: {
    credits: 6400,
    label: "Studio — 6,400 Aura",
    usd: 80,
    prices: {
      USD: { amount_minor: 80_00,       display: "$80" },
      NGN: { amount_minor: 82_000_00,   display: "₦82,000" },
      GHS: { amount_minor: 820_00,      display: "₵820" },
      KES: { amount_minor: 6_890_00,    display: "KES 6,890" },
      ZAR: { amount_minor: 980_00,      display: "R980" },
      EGP: { amount_minor: 2_597_00,    display: "EGP 2,597" },
    } as Record<Currency, { amount_minor: number; display: string }>,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function perCreditDisplay(plan: PlanKey, currency: Currency = "USD"): string {
  const p = PLANS[plan];
  const price = p.prices[currency];
  if (!price) return `$${(p.usd / p.credits).toFixed(4)} / Aura`;
  const sym = CURRENCY_SYMBOLS[currency];
  const amount = price.amount_minor / 100;
  // Post-rebase, per-Aura rates are sub-cent — show enough decimals to be honest.
  return `${sym}${(amount / p.credits).toFixed(currency === "NGN" ? 2 : 3)} / Aura`;
}

// ── Subscription tiers ────────────────────────────────────────────────────────
export type SubscriptionTier = "free" | "pro";

/**
 * Pro monthly subscription prices by region.
 * USD = $15/mo | Africa = ~$10/mo USD equivalent (PPP-adjusted).
 * Used by the billing page and subscription checkout.
 */
export const PRO_GEO_PRICES: Record<PaystackCurrency, { amount_minor: number; display: string }> = {
  USD: { amount_minor: 15_00,       display: "$15/mo" },
  NGN: { amount_minor: 15_500_00,   display: "₦15,500/mo" },
  GHS: { amount_minor: 155_00,      display: "₵155/mo" },
  KES: { amount_minor: 1_300_00,    display: "KES 1,300/mo" },
  ZAR: { amount_minor: 185_00,      display: "R185/mo" },
  EGP: { amount_minor: 490_00,      display: "EGP 490/mo" },
};

export const SUBSCRIPTION_TIERS = {
  free: {
    label: "Starter",
    monthly_aura: 200,
    price_usd: 0,
    price_display: "Starter",
    price_amount_minor: 0,
    watermark: true,
    queue_priority: 0,
    premium_templates: false,
    features: [
      "200 Aura / month",
      "All generation types",
      "Permanent gallery",
      "Canvas pipeline editor",
    ],
    limitations: [
      "Aurora watermark on exports",
      "Standard queue priority",
      "No premium templates",
      "No Growth Tools (daily posts, rollout plans, social packs)",
    ],
  },
  pro: {
    label: "Pro",
    monthly_aura: 2000,
    price_usd: 15,
    price_display: "$15 / month",
    price_amount_minor: 15_00,
    watermark: false,
    queue_priority: 10,
    premium_templates: true,
    features: [
      "2,000 Aura / month",
      "No watermark on exports",
      "Priority queue — faster generations",
      "All premium templates unlocked",
      "Growth Tools — daily posts, rollout plans & social packs",
      "All generation types",
      "Permanent gallery",
      "Canvas pipeline editor",
    ],
    limitations: [] as string[],
  },
} as const;

export function tierFor(plan: string | null | undefined): SubscriptionTier {
  return plan === "pro" ? "pro" : "free";
}

/** Per-tier maximum video/motion generation duration in seconds. */
export const DURATION_CAPS: Record<SubscriptionTier, number> = {
  free: 10,
  pro: 15,
};

export function durationCapMessage(
  tier: SubscriptionTier,
  durationSeconds: number,
): string | null {
  const cap = DURATION_CAPS[tier];
  if (durationSeconds <= cap) return null;
  const tierLabel = tier === "pro" ? "Pro" : "Starter";
  const upgradeHint = tier === "free" ? " Upgrade to Pro for up to 15 seconds." : "";
  return `Unsupported duration for your ${tierLabel} plan: ${durationSeconds}s exceeds the ${cap}s limit.${upgradeHint}`;
}

// ─── HD / 4K entitlement ──────────────────────────────────────────────────────

/**
 * Single source of truth for the HD/4K entitlement message. The server guard
 * (assertHdEntitlement in cost-guardrails.server.ts) throws EXACTLY this
 * string, and the pre-click warning UI + GET /api/estimate render it — so the
 * warning a user sees before generating can never drift from what the charge
 * path would actually throw.
 * Returns null when the resolution is allowed on this tier (or isn't HD/4K).
 */
export function hdEntitlementMessage(
  tier: SubscriptionTier,
  resolution: string | null | undefined,
): string | null {
  if (resolution !== "1080p" && resolution !== "2160p") return null;
  if (tier === "pro") return null;
  const label = resolution === "2160p" ? "4K (2160p)" : "HD (1080p)";
  return `Unsupported resolution for Free plan: ${label} requires Pro. Upgrade to unlock HD and 4K exports.`;
}

// ─── Pre-click plan-limit warnings ────────────────────────────────────────────

/**
 * Kinds whose duration is subject to the per-tier cap — mirrors the charge
 * paths: orchestrateGenerate asserts video/motion, api/public/generate and
 * the estimate route also assert lipsync.
 */
export const DURATION_CAPPED_KINDS = new Set(["video", "motion", "lipsync"]);

export type PlanLimitWarning = {
  code: "duration_cap" | "hd_entitlement";
  /** The exact message the server guard would throw for this selection. */
  message: string;
  /** Human label of the current plan's limit, e.g. "10s" or "720p". */
  limitLabel: string;
  /** Human label of the over-limit selection, e.g. "12s" or "HD (1080p)". */
  requestedLabel: string;
  /** Tier that lifts this limit; null when no plan unlocks it. */
  upgradeTier: SubscriptionTier | null;
  /**
   * true  → the very next render attempt would be rejected server-side.
   * false → the next attempt is a forced 480p preview pass (exempt from the
   *         HD guard), but the later full-quality render at this selection
   *         would be rejected.
   */
  blocksNextRender: boolean;
};

/**
 * Pure, client-safe evaluation of plan-tier limits for a prospective render.
 * Used by the pre-generate warning UI (instant, no round trip) and by
 * GET /api/estimate (authoritative, tier resolved from the auth token). All
 * three surfaces — client warning, estimate endpoint, and the server guards
 * in cost-guardrails.server.ts — share durationCapMessage/hdEntitlementMessage
 * above, so they always agree byte-for-byte.
 */
export function evaluatePlanLimits(args: {
  tier: SubscriptionTier;
  kind: string;
  durationSeconds?: number | null;
  resolution?: string | null;
  /** True when the flow's next submit is a forced 480p preview pass. */
  nextRenderIsPreview?: boolean;
}): PlanLimitWarning[] {
  const warnings: PlanLimitWarning[] = [];
  if (
    DURATION_CAPPED_KINDS.has(args.kind) &&
    typeof args.durationSeconds === "number" &&
    args.durationSeconds > 0
  ) {
    const msg = durationCapMessage(args.tier, args.durationSeconds);
    if (msg) {
      warnings.push({
        code: "duration_cap",
        message: msg,
        limitLabel: `${DURATION_CAPS[args.tier]}s`,
        requestedLabel: `${args.durationSeconds}s`,
        upgradeTier: args.tier === "free" ? "pro" : null,
        // The duration cap is asserted BEFORE the preview gate on every charge
        // path, so even a cheap preview click at an over-cap length is rejected.
        blocksNextRender: true,
      });
    }
  }
  const hdMsg = hdEntitlementMessage(args.tier, args.resolution);
  if (hdMsg) {
    warnings.push({
      code: "hd_entitlement",
      message: hdMsg,
      limitLabel: "720p",
      requestedLabel: args.resolution === "2160p" ? "4K (2160p)" : "HD (1080p)",
      upgradeTier: "pro",
      // Preview passes are forced to 480p and exempt from the HD guard; only
      // the full-quality render is blocked.
      blocksNextRender: !args.nextRenderIsPreview,
    });
  }
  return warnings;
}

// ─── Heavy-queue classification ───────────────────────────────────────────────
export const HEAVY_JOB_KINDS = new Set<string>(["lipsync"]);

export function classifyJobQueue(
  kind: string,
  payload: Record<string, unknown>,
): "standard" | "heavy" {
  if (HEAVY_JOB_KINDS.has(kind)) return "heavy";
  if (
    payload.resolution === "1080p" ||
    payload.resolution === "4K" ||
    payload.resolution === "2160p"
  ) return "heavy";
  if (kind === "reshoot" || kind === "multi_angle") return "heavy";
  return "standard";
}
