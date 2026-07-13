// Multi-currency pricing with geo-based PPP adjustments.
// Paystack-supported currencies: USD, NGN, GHS, ZAR, KES, EGP.
// Credit (Aura) amounts are the same in every region — only the local price changes.
export type Currency = "USD" | "NGN" | "GHS" | "ZAR" | "KES" | "EGP";

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$", NGN: "₦", GHS: "₵", ZAR: "R", KES: "KES ", EGP: "EGP ",
};

// Effective rate ~$0.125 / Aura at USD. Regional prices use PPP-adjusted rates.
export const PLANS = {
  starter: {
    credits: 80,
    label: "Starter — 80 Aura",
    usd: 10,
    prices: {
      USD: { amount_minor: 10_00,       display: "$10" },
      NGN: { amount_minor: 7_500_00,    display: "₦7,500" },
      GHS: { amount_minor: 130_00,      display: "₵130" },
      KES: { amount_minor: 1_300_00,    display: "KES 1,300" },
      ZAR: { amount_minor: 185_00,      display: "R185" },
      EGP: { amount_minor: 485_00,      display: "EGP 485" },
    } as Record<Currency, { amount_minor: number; display: string }>,
  },
  creator: {
    credits: 240,
    label: "Creator — 240 Aura",
    usd: 30,
    prices: {
      USD: { amount_minor: 30_00,       display: "$30" },
      NGN: { amount_minor: 22_500_00,   display: "₦22,500" },
      GHS: { amount_minor: 390_00,      display: "₵390" },
      KES: { amount_minor: 3_900_00,    display: "KES 3,900" },
      ZAR: { amount_minor: 555_00,      display: "R555" },
      EGP: { amount_minor: 1_455_00,    display: "EGP 1,455" },
    } as Record<Currency, { amount_minor: number; display: string }>,
  },
  studio: {
    credits: 640,
    label: "Studio — 640 Aura",
    usd: 80,
    prices: {
      USD: { amount_minor: 80_00,       display: "$80" },
      NGN: { amount_minor: 60_000_00,   display: "₦60,000" },
      GHS: { amount_minor: 1_040_00,    display: "₵1,040" },
      KES: { amount_minor: 10_400_00,   display: "KES 10,400" },
      ZAR: { amount_minor: 1_480_00,    display: "R1,480" },
      EGP: { amount_minor: 3_880_00,    display: "EGP 3,880" },
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
