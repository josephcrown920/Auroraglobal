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
  | "adult-school"
  | "soul";

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
  { key: "spin",             label: "TikTok30 (Spin)",   routes: ["/spin"],              defaultHidden: false, description: "30-piece UGC campaign engine." },
  { key: "creator-hub",      label: "Creator Hub",       routes: ["/creator/dashboard"], defaultHidden: true, description: "Creator analytics dashboard." },
  { key: "grwm",             label: "Get Ready With Me", routes: [],                     defaultHidden: true, description: "GRWM landing tile + template." },
  { key: "talking-avatars",  label: "Talking Avatars",   routes: ["/avatar"],            defaultHidden: true, description: "Photo avatar + script studio." },
  { key: "heygen-templates", label: "HeyGen Templates",  routes: ["/heygen-templates"],  defaultHidden: true, description: "HeyGen presenter template gallery." },
  { key: "kids",             label: "Kids story studio", routes: ["/kids"],              defaultHidden: true, description: "Kids storybook / bedtime reels." },
  { key: "nexusarb",         label: "NexusARB",          routes: ["/nexusarb"],          defaultHidden: true, description: "Arbitrage simulator (separate audience)." },
  { key: "split-reality",    label: "Split Reality",     routes: ["/split-reality"],     defaultHidden: true, description: "Split-screen reality effect tool." },
  { key: "adult-school",     label: "Adult School",      routes: ["/eromify", "/adult", "/aurora-adult"], defaultHidden: true, description: "18+ studio entry points (artifact keeps its own passcode gate)." },
  { key: "soul",             label: "Aurora Soul",       routes: ["/soul"],              defaultHidden: true, description: "Train a face LoRA once, then generate identity-locked images/video of that character." },
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
 * Pure nav-item filter shared by the navigation chrome.
 * - `adminOnly` items (the Admin console link) are dropped unless the viewer is
 *   a SERVER-VERIFIED admin (`isAdmin` from FeatureVisibilityProvider, which is
 *   false until the check settles) — partner, referral and ordinary accounts
 *   never see them regardless of any client-side token or flag.
 * - Everything else follows the artist-only feature gating via `showFeature`.
 */
export function filterNavFeatures<T extends { to: string; adminOnly?: boolean }>(
  items: readonly T[],
  ctx: { isAdmin: boolean; showFeature: (key: FeatureKey | null) => boolean },
): T[] {
  return items.filter((f) => (!f.adminOnly || ctx.isAdmin) && ctx.showFeature(featureKeyForRoute(f.to)));
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

/**
 * A settled admin check, bound to the subject it was verified for.
 * `subject` is the Supabase user id the check ran as (null = signed out) and
 * `nonce` the refresh generation, so a verdict can never be mistaken for the
 * answer about a different session.
 */
export type AdminVerdict = { subject: string | null; nonce: number; isAdmin: boolean };

/**
 * Returns the verdict only if it was verified for exactly the viewer the
 * caller currently sees (same subject, same refresh generation, auth
 * resolved); otherwise null, meaning "not checked yet — keep waiting".
 * A previous session's positive answer must never be reused for the next
 * signed-in user, and a stale negative must never reject an admin who just
 * signed in mid-session.
 */
export function currentAdminVerdict(
  verdict: AdminVerdict | null,
  viewer: { authLoading: boolean; userId: string | null; nonce: number },
): AdminVerdict | null {
  if (viewer.authLoading || !verdict) return null;
  if (verdict.subject !== viewer.userId || verdict.nonce !== viewer.nonce) return null;
  return verdict;
}
