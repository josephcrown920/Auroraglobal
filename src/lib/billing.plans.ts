// Multi-currency pricing with geo-based PPP adjustments.
// Paystack-supported currencies: USD, NGN, GHS, ZAR, KES, EGP.
// Credit (Aura) amounts are the same in every region — only the local price changes.
//
// IMPORTANT: Never expose cross-region prices in any UI. Each user sees
// only their own detected region's price. This is standard PPP practice.
export type Currency = "USD" | "NGN" | "GHS" | "ZAR" | "KES" | "EGP";

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$", NGN: "₦", GHS: "₵", ZAR: "R", KES: "KES ", EGP: "EGP ",
};

// USD prices: Starter $10 | Creator $30 | Studio $80
// Africa prices: ~$6.50 / $20 / $53 USD equivalent (PPP-adjusted)
export const PLANS = {
  starter: {
    credits: 80,
    label: "Starter — 80 Aura",
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
    credits: 240,
    label: "Creator — 240 Aura",
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
    credits: 640,
    label: "Studio — 640 Aura",
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
  if (!price) return `$${(p.usd / p.credits).toFixed(3)} / Aura`;
  const sym = CURRENCY_SYMBOLS[currency];
  const amount = price.amount_minor / 100;
  return `${sym}${(amount / p.credits).toFixed(currency === "NGN" ? 0 : 2)} / Aura`;
}

// ── Subscription tiers ────────────────────────────────────────────────────────
export type SubscriptionTier = "free" | "pro";

/**
 * Pro monthly subscription prices by region.
 * USD = $15/mo | Africa = ~$10/mo USD equivalent (PPP-adjusted).
 * Used by the billing page and subscription checkout.
 */
export const PRO_GEO_PRICES: Record<Currency, { amount_minor: number; display: string }> = {
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
    monthly_aura: 20,
    price_usd: 0,
    price_display: "Starter",
    price_amount_minor: 0,
    watermark: true,
    queue_priority: 0,
    premium_templates: false,
    features: [
      "20 Aura / month",
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
    monthly_aura: 200,
    price_usd: 15,
    price_display: "$15 / month",
    price_amount_minor: 15_00,
    watermark: false,
    queue_priority: 10,
    premium_templates: true,
    features: [
      "200 Aura / month",
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
