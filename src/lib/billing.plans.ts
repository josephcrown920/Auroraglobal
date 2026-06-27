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
