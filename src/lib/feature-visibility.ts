/**
 * Feature visibility registry — client-safe (no server imports).
 *
 * Aurora is artist-first: creator/marketing features and other-audience
 * features are HIDDEN from regular users by default but stay fully working
 * for the owner/admin. The owner can resurface (or re-hide) any feature at
 * any time from the admin Features panel; overrides persist in the
 * `app_settings` key/value store (see feature-visibility.server.ts).
 *
 * This module is the single source of truth for WHAT is gateable and the
 * artist-only DEFAULTS. Reads everywhere must be fail-safe: when the store
 * is unreachable, fall back to these seeded defaults.
 */

export type FeatureKey =
  | "ugc"
  | "content-line"
  | "content-machine"
  | "content-funnel"
  | "spin"
  | "creator-hub"
  | "grwm"
  | "talking-avatars"
  | "heygen-templates"
  | "kids"
  | "nexusarb"
  | "split-reality"
  | "adult-school";

export type GateableFeature = {
  key: FeatureKey;
  label: string;
  /** Route paths owned by this feature (prefix-matched, e.g. /ugc covers /ugc/x). */
  routes: readonly string[];
  /** Hidden from regular users in the artist-only default state. */
  defaultHidden: boolean;
  /** Short operator-facing description for the admin Features panel. */
  description: string;
};

export const GATEABLE_FEATURES: readonly GateableFeature[] = [
  { key: "ugc",              label: "UGC Ads",           routes: ["/ugc"],               defaultHidden: true, description: "Product-photo → creator-style ad factory." },
  { key: "content-line",     label: "Content Line",      routes: ["/ugc-line"],          defaultHidden: true, description: "Batch UGC content pipeline." },
  { key: "content-machine",  label: "Content Machine",   routes: ["/content-machine"],   defaultHidden: true, description: "Multi-post content generator." },
  { key: "content-funnel",   label: "Content funnel",    routes: ["/content"],           defaultHidden: true, description: "The /content product funnel page." },
  { key: "spin",             label: "TikTok30 (Spin)",   routes: ["/spin"],              defaultHidden: true, description: "30-piece UGC campaign engine." },
  { key: "creator-hub",      label: "Creator Hub",       routes: ["/creator/dashboard"], defaultHidden: true, description: "Creator analytics dashboard." },
  { key: "grwm",             label: "Get Ready With Me", routes: [],                     defaultHidden: true, description: "GRWM landing tile + template." },
  { key: "talking-avatars",  label: "Talking Avatars",   routes: ["/avatar"],            defaultHidden: true, description: "Photo avatar + script studio." },
  { key: "heygen-templates", label: "HeyGen Templates",  routes: ["/heygen-templates"],  defaultHidden: true, description: "HeyGen presenter template gallery." },
  { key: "kids",             label: "Kids story studio", routes: ["/kids"],              defaultHidden: true, description: "Kids storybook / bedtime reels." },
  { key: "nexusarb",         label: "NexusARB",          routes: ["/nexusarb"],          defaultHidden: true, description: "Arbitrage simulator (separate audience)." },
  { key: "split-reality",    label: "Split Reality",     routes: ["/split-reality"],     defaultHidden: true, description: "Split-screen reality effect tool." },
  { key: "adult-school",     label: "Adult School",      routes: ["/eromify", "/aurora-adult"], defaultHidden: true, description: "18+ studio entry points (artifact keeps its own passcode gate)." },
] as const;

export const FEATURE_KEYS: readonly FeatureKey[] = GATEABLE_FEATURES.map((f) => f.key);

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === "string" && (FEATURE_KEYS as readonly string[]).includes(value);
}

/** Visible-overrides map persisted by the owner: key → true (visible) | false (hidden). */
export type FeatureOverrides = Partial<Record<FeatureKey, boolean>>;

/** Effective hidden keys for REGULAR USERS given the persisted overrides. */
export function resolveHiddenKeys(overrides: FeatureOverrides | null | undefined): FeatureKey[] {
  return GATEABLE_FEATURES.filter((f) => {
    const override = overrides?.[f.key];
    return typeof override === "boolean" ? !override : f.defaultHidden;
  }).map((f) => f.key);
}

/** Artist-only seeded default: everything flagged defaultHidden. */
export function defaultHiddenKeys(): FeatureKey[] {
  return resolveHiddenKeys(null);
}

/** Parse an untrusted stored value into a clean overrides map (fail-safe: {}). */
export function parseOverrides(value: unknown): FeatureOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: FeatureOverrides = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isFeatureKey(k) && typeof v === "boolean") out[k] = v;
  }
  return out;
}

/** Which gateable feature (if any) owns this route path? Prefix-matched. */
export function featureKeyForRoute(path: string): FeatureKey | null {
  for (const f of GATEABLE_FEATURES) {
    for (const r of f.routes) {
      if (path === r || path.startsWith(`${r}/`)) return f.key;
    }
  }
  return null;
}

/**
 * Which gateable feature (if any) backs a studio template?
 * - grwm-reel is the GRWM tile's template
 * - spin-dispatch templates are backed by TikTok30
 * - ugc-dispatch templates are backed by the UGC Ads backend
 * - Kids-category templates belong to the kids studio
 */
export function featureKeyForTemplate(t: {
  id: string;
  category: string;
  dispatch: string;
}): FeatureKey | null {
  if (t.id === "grwm-reel") return "grwm";
  if (t.dispatch === "spin") return "spin";
  if (t.dispatch === "ugc") return "ugc";
  if (t.category === "Kids") return "kids";
  return null;
}
