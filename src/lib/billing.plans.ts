// USD-only pricing. Geo-detection removed.
export type Currency = "USD";

// Effective rate ~$0.125 / Aura.
export const PLANS = {
  starter: {
    credits: 80,
    label: "Starter — 80 Aura",
    usd: 10,
    prices: {
      USD: { amount_minor: 10_00, display: "$10" },
    },
  },
  creator: {
    credits: 240,
    label: "Creator — 240 Aura",
    usd: 30,
    prices: {
      USD: { amount_minor: 30_00, display: "$30" },
    },
  },
  studio: {
    credits: 640,
    label: "Studio — 640 Aura",
    usd: 80,
    prices: {
      USD: { amount_minor: 80_00, display: "$80" },
    },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function perCreditDisplay(plan: PlanKey, _currency: Currency = "USD"): string {
  const p = PLANS[plan];
  return `$${(p.usd / p.credits).toFixed(3)} / Aura`;
}

// ── Subscription tiers ────────────────────────────────────────────────────────
// Free and Pro monthly subscription plans.  Credit packs (PLANS above) remain
// available as one-time Aura top-ups on top of either tier.
export type SubscriptionTier = "free" | "pro";

export const SUBSCRIPTION_TIERS = {
  free: {
    label: "Free",
    monthly_aura: 20,
    price_usd: 0,
    price_display: "Free",
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
