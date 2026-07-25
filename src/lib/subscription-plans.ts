// ─── CapCut-style subscription plans ────────────────────────────────────────
// Client-safe: no server imports. Presents monthly buckets of Aura credits.
// Per-feature costs still stack via src/lib/pricing.ts — these tiers govern
// how many Aura a user gets each month + which flagship features unlock.

export type PlanId = "free" | "creator" | "pro" | "studio";

export type SubscriptionPlan = {
  id: PlanId;
  name: string;
  tagline: string;
  monthlyUsd: number;
  monthlyAura: number;
  perks: string[];
  /** true = highlight as recommended */
  featured?: boolean;
  /** Ordered high→low revenue features unlocked at this tier. */
  unlocks: string[];
};

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Try Aurora",
    monthlyUsd: 0,
    monthlyAura: 100,
    perks: [
      "100 Aura / month",
      "Standard-tier image + short video",
      "Aurora watermark",
      "Community GPU queue",
    ],
    unlocks: ["Image generation", "5s video (budget)"],
  },
  {
    id: "creator",
    name: "Creator",
    tagline: "For solo creators",
    monthlyUsd: 19,
    monthlyAura: 2_500,
    perks: [
      "2 500 Aura / month",
      "Remove watermark",
      "TikTok30 pack access",
      "Priority queue",
    ],
    unlocks: [
      "TikTok30 UGC Factory",
      "GRWM pack",
      "Colors Performance Sessions",
      "Perform Anywhere",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For serious artists",
    monthlyUsd: 49,
    monthlyAura: 8_000,
    featured: true,
    perks: [
      "8 000 Aura / month",
      "Premium & Ultra models",
      "4K upscale unlocked",
      "Batch generation up to 30",
      "Persistent Video Agent memory",
    ],
    unlocks: [
      "Motion Control",
      "Video Agent (Grok/Claude director)",
      "Lipsync ultra (HeyGen)",
      "Scene Builder",
      "Canvas node workflows",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    tagline: "For teams & labels",
    monthlyUsd: 129,
    monthlyAura: 25_000,
    perks: [
      "25 000 Aura / month",
      "Batch generation up to 100",
      "Dedicated GPU workers",
      "API access + webhooks",
      "Team seats (5 included)",
      "Priority support",
    ],
    unlocks: [
      "All flagship features",
      "Custom model fine-tunes",
      "White-label exports",
    ],
  },
];

export function planById(id: PlanId): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id);
}

/** Effective $ per Aura at each plan (lower = better value). */
export function dollarsPerAura(plan: SubscriptionPlan): number {
  if (plan.monthlyAura === 0) return 0;
  return plan.monthlyUsd / plan.monthlyAura;
}
