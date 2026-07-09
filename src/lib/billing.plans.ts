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

/** Per-tier maximum video/motion generation duration in seconds.
 * Enforced at the API layer before credits are reserved or a provider is called. */
export const DURATION_CAPS: Record<SubscriptionTier, number> = {
  free: 10,
  pro: 15,
};

/**
 * Pure per-tier duration check. Returns the TERMINAL rejection message
 * ("Unsupported …" — matches TERMINAL_ERROR_RE so queue jobs never retry it)
 * or null when the duration is allowed. assertDurationCap wraps this after a
 * profile lookup; tests exercise the policy here without mocking Supabase.
 */
export function durationCapMessage(
  tier: SubscriptionTier,
  durationSeconds: number,
): string | null {
  const cap = DURATION_CAPS[tier];
  if (durationSeconds <= cap) return null;
  const tierLabel = tier === "pro" ? "Pro" : "Free";
  const upgradeHint = tier === "free" ? " Upgrade to Pro for up to 15 seconds." : "";
  return `Unsupported duration for your ${tierLabel} plan: ${durationSeconds}s exceeds the ${cap}s limit.${upgradeHint}`;
}

// ─── Heavy-queue classification (pure, no server deps) ────────────────────────
// Lives here so tests can import it without pulling in server-only modules.

/** Kinds that are always routed to the heavy queue (expensive + non-urgent). */
export const HEAVY_JOB_KINDS = new Set<string>(["lipsync"]);

/**
 * Classify a job as 'standard' or 'heavy'.
 *
 * Heavy criteria:
 *  - Lip-sync: expensive self-hosted or paid provider, tolerable latency
 *  - HD (1080p) / 4K (2160p): high provider cost tier, longer render
 *  - Multi-angle reshoot: 6-image burst in one job
 */
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
