// ─── Stacked, resolution/length-based pricing — single source of truth ───────
//
// Every charge point (public /api/public/generate, the AI Router server fn, and
// the AI Router UI preview) prices a generation through THIS module so a preview
// can never disagree with what is actually reserved/charged.
//
// Model (Kling/Runway-inspired, all values in Aura credits):
//   • Each active feature has a base cost. A request that stacks features is
//     charged the SUM of every active feature (not one flat fee).
//   • Video and lip-sync are MODEL-TIERED: the base cost is set by the chosen
//     model's price tier (Budget / Standard / Premium / Ultra), so a premium
//     model costs the Aura its real provider cost warrants while a cheap /
//     self-hosted model keeps its historical low price. See MODEL_TIERS below.
//   • Resolution scales the resolution-bearing visual output.
//   • Length scales time-based features (video / lip-sync / motion).
//   • Per-feature subtotal = base × resolutionFactor × lengthFactor (kept exact);
//     the subtotals are summed and the TOTAL is rounded UP to a whole Aura.
//     A real generation is never free (minimum 1).
//
// This file is intentionally dependency-free (no server imports) so the client
// UI can import `computeCost`/`detectFeatures` directly for an instant preview.
// The model→tier table is therefore duplicated here (kept in sync with the
// server's MODEL_REGISTRY costs by pricing.test.ts) rather than imported.

export type Feature =
  | "image"
  | "upscale"
  | "text"
  | "audio"
  | "lipsync"
  | "motion"
  | "video"
  | "caption_burn"
  | "lyric_video";
export type Resolution = "480p" | "720p" | "1080p" | "2160p";

/** Every billable feature, in canonical display order. */
export const FEATURES: readonly Feature[] = [
  "image",
  "upscale",
  "text",
  "audio",
  "video",
  "lipsync",
  "motion",
  "caption_burn",
  "lyric_video",
];

// ─── Editable default price table ────────────────────────────────────────────
// The owner can tweak these numbers without touching any pricing logic.
export const PRICING = {
  /** Per-feature base cost (summed when features are stacked). */
  base: {
    image: 1,
    upscale: 1,
    text: 1,
    audio: 2,
    lipsync: 3,
    motion: 30,
    video: 10,
    caption_burn: 2,
    // Flat rate — deliberately NOT length-scaled (see LENGTH_FEATURES below): a
    // multi-minute song must not multiply this into a huge charge. Self-hosted
    // GPU-worker-only synthesis, so this stays cheap even at flat rate.
    lyric_video: 5,
  } as Record<Feature, number>,
  /** Multiplier applied to the resolution-bearing visual output. */
  resolutionMultiplier: {
    "480p": 0.5,
    "720p": 1,
    "1080p": 2,
    "2160p": 4,
  } as Record<Resolution, number>,
  /** Length multiplier is linear against this reference: seconds / referenceSeconds. */
  referenceSeconds: 5,
  /** Used when a request omits resolution. */
  defaultResolution: "720p" as Resolution,
} as const;

// ─── Model-tiered pricing for video & lip-sync ───────────────────────────────
//
// Video and lip-sync provider cost swings wildly by model, but only the ~40%
// "credit-funding" pool (≈ $0.047 per Aura sold) is meant to cover provider
// cost. A flat price would lose money on premium models. So each video/lip-sync
// model is placed in a price tier sized so `tierAura × $0.047` comfortably
// exceeds that model's real provider cost (incl. a buffer for retries/fallback).
//
// Tiers (Aura at the 5s / 720p reference; resolution + length multipliers stack
// ON TOP, exactly as for the flat prices). These are EDITABLE defaults — the
// owner can retune them without touching any pricing logic.
//
//   Tier      Video  Lip-sync   covers provider cost up to (≈ tierAura×$0.047)
//   Budget       10         3     video ≤ $0.47 / lipsync ≤ $0.14  (self-hosted, Seedance Lite)
//   Standard     20         6     video ≤ $0.94 / lipsync ≤ $0.28  (Kling direct, wav2lip)
//   Premium      32         9     video ≤ $1.50 / lipsync ≤ $0.42  (Wan, Runway, Veo Fast, Sora, Sync.so, Fal)
//   Ultra        48        10     video ≤ $2.26 / lipsync ≤ $0.47  (Seedance Pro, Kling Omni, Veo 3, HeyGen)
//
// 2026-07-08 repricing (owner request): video tiers and the motion-control base
// were DOUBLED (video 5/10/16/24 → 10/20/32/48, motion 15 → 30) — the old
// prices were leaving margin on the table, especially motion control.
export type ModelTier = "budget" | "standard" | "premium" | "ultra";

export const VIDEO_TIER_AURA: Record<ModelTier, number> = {
  budget: 10,
  standard: 20,
  premium: 32,
  ultra: 48,
};

export const LIPSYNC_TIER_AURA: Record<ModelTier, number> = {
  budget: 3,
  standard: 6,
  premium: 9,
  ultra: 10,
};

// Model → tier. Derived from the server MODEL_REGISTRY per-model `cost` (USD per
// reference clip); pricing.test.ts asserts each model sits in a tier whose pool
// covers its registry cost, so this table can't silently drift below margin.
//
// Adding a new video/lip-sync model to MODEL_REGISTRY (or to FALLBACK_MODELS in
// orchestrator.server.ts) WITHOUT adding it here fails
// pricing.test.ts's "model tiers cover real provider cost (margin guard)"
// suite — that's intentional: an untiered model must fail a test, not silently
// under-charge in production. Pick the cheapest tier whose pool (tierAura ×
// $0.047, see POOL_PER_AURA in pricing.test.ts) still comfortably covers the
// model's real USD cost × 1.15 (retry/fallback buffer).
export const VIDEO_MODEL_TIERS: Record<string, ModelTier> = {
  "seedance-2.0-fast": "budget", // $0.05
  "kling-v1": "standard", // $0.30
  "piapi/kling-video": "standard", // $0.30 (Kling via PiAPI aggregator)
  "veo-3-fast": "premium", // $0.40
  "runway/gen3a-turbo": "premium", // $0.40
  "runway/gen4-turbo": "premium", // $0.50
  "fal-fallback/kling-video": "premium", // $0.40
  "wan-2.5": "premium", // $0.45
  "sora-2": "premium", // $0.50
  "openai/sora-2": "premium", // $0.50 — direct OpenAI endpoint
  "openai/sora-2-pro": "ultra", // $1.00 — higher-quality Sora
  "ltx/ltx-video": "standard", // $0.15 — LTX Video (Lightricks)
  "seedance-2.0": "ultra", // $0.65
  "kling-3.0": "ultra", // $0.60
  "kling-3.0-omni": "ultra", // $0.70
  "veo-2": "premium", // $0.35 — Gemini Veo 2 direct API
  "veo-3": "ultra", // $0.75
  "seedance-3.0": "ultra", // $0.75 (seedance-1-5-pro, ByteDance-direct only)
  "xai/grok-imagine-video-1.5": "standard", // ~$0.24 (8s @ $0.03/s)
  "heygen/video-agent": "ultra", // $1.50 — needs the ultra pool ($2.26) to clear the retry buffer
  "heygen/template": "ultra", // $1.50 — Aurora Template render, same HeyGen credit burn as video-agent
};

export const LIPSYNC_MODEL_TIERS: Record<string, ModelTier> = {
  latentsync: "budget", // $0.01 (self-hosted)
  "fal-ai/wav2lip": "standard", // $0.10
  "sync/lipsync-2": "premium", // $0.25
  "fal-ai/sync-lipsync/v2": "premium", // $0.30
  "fal-fallback/sync-lipsync": "premium", // $0.30
  "heygen/lipsync": "ultra", // $0.40
  // xAI UGC (still photo → talking-head video via grok-imagine-video-1.5).
  // ~$0.30 per 10s run ($0.03/s) — premium pool (≤ $0.42) covers it with buffer.
  "xai/grok-imagine-video-1.5": "premium", // $0.30
  // HeyGen photo-to-video (POST /v3/videos, type:"image"): animates a still
  // photo directly from the user's OWN audio in a single call — no relip
  // stage needed (unlike xai-ugc). HeyGen credits run richer than a plain
  // lipsync-onto-video call, so this is priced at the same ultra tier as
  // heygen/lipsync ($0.40) with buffer.
  "heygen/photo-video": "ultra", // ~$0.40
  "heygen/avatar": "ultra", // ~$0.40 — avatar-id + script, HeyGen TTS internally
};

// When a request omits the model, fall back to the tier of the model the
// orchestrator ACTUALLY runs first for that kind (FALLBACK_MODELS[kind][0]):
//   • video   → seedance-2.0-fast (budget) — the cheapest tier, used for
//     legacy/unspecified requests (10 Aura since the 2026-07-08 repricing).
//   • lipsync → fal-ai/sync-lipsync/v2 (premium) — the real default lip-sync
//     model costs $0.30, so the default tier MUST cover it or every unspecified
//     lip-sync would lose money.
export const DEFAULT_VIDEO_TIER: ModelTier = "budget";
export const DEFAULT_LIPSYNC_TIER: ModelTier = "premium";

/** Resolve a video/lip-sync model to its price tier (default tier if unknown). */
export function tierForModel(feature: "video" | "lipsync", model: string | null | undefined): ModelTier {
  if (feature === "video") return (model ? VIDEO_MODEL_TIERS[model] : undefined) ?? DEFAULT_VIDEO_TIER;
  return (model ? LIPSYNC_MODEL_TIERS[model] : undefined) ?? DEFAULT_LIPSYNC_TIER;
}

/** The per-feature base cost, model-tiered for video/lip-sync. */
function baseFor(feature: Feature, model: string | null | undefined): number {
  if (feature === "video") return VIDEO_TIER_AURA[tierForModel("video", model)];
  if (feature === "lipsync") return LIPSYNC_TIER_AURA[tierForModel("lipsync", model)];
  return PRICING.base[feature];
}

// Time-based features whose price scales with length.
const LENGTH_FEATURES: ReadonlySet<Feature> = new Set<Feature>(["video", "lipsync", "motion"]);
// Temporal visual outputs — when one of these is present in a stack, a stacked
// source `image` is billed at base (it is a reference input, not a re-render).
const TEMPORAL_OUTPUTS: ReadonlySet<Feature> = new Set<Feature>(["video", "motion"]);

export type CostLineItem = {
  feature: Feature;
  base: number;
  resolutionFactor: number;
  lengthFactor: number;
  /** base × resolutionFactor × lengthFactor (exact, before the total is rounded). */
  subtotal: number;
};

export type CostQuote = {
  /** Whole-Aura amount actually reserved/charged. */
  total: number;
  breakdown: CostLineItem[];
  resolution: Resolution;
  durationSeconds: number;
};

/**
 * Whether the resolution multiplier scales a given feature within a stack.
 * - `video` / `motion`: always (they are the resolution-bearing output).
 * - `image`: only when it IS the final visual output — i.e. there is no temporal
 *   output (video/motion) in the stack. A source image under a video is base-only.
 *   This is what keeps the canonical stacked example at exactly 39 Aura.
 * - everything else (text/audio/lipsync/upscale): never.
 */
function resolutionApplies(feature: Feature, hasTemporalOutput: boolean): boolean {
  if (feature === "video" || feature === "motion") return true;
  if (feature === "image") return !hasTemporalOutput;
  return false;
}

// ─── Client-safe engine→model map for the lip-sync page ─────────────────────
// Mirrors lipsync.server.ts MODEL record but lives here so lipsync.tsx can call
// computeCost without importing a .server.ts file.
export type LipsyncEngine = "sync-v2" | "wav2lip" | "latentsync" | "xai-ugc" | "heygen-photo";
export const LIPSYNC_ENGINE_MODEL: Record<LipsyncEngine, string> = {
  "sync-v2": "fal-ai/sync-lipsync/v2",
  "wav2lip": "fal-ai/wav2lip",
  "latentsync": "latentsync",
  "xai-ugc": "xai/grok-imagine-video-1.5",
  "heygen-photo": "heygen/photo-video",
};

/**
 * The model used for the MANDATORY relip stage of the xAI UGC engine. xAI
 * generates its own (inconsistent) voice, so the clip is always re-synced to
 * the user's uploaded audio — voice consistency is the whole point of letting
 * the user supply their character's voice. Kept here (client-safe) so the UI
 * quote and the server charge derive from the same two-stage stack.
 */
export const XAI_UGC_RELIP_MODEL = "fal-ai/sync-lipsync/v2";

/**
 * Canonical price for a lip-sync engine run. THE single source both the
 * /lipsync UI quote and lipsync.server.ts charge must use (pricing.test.ts
 * asserts parity).
 *
 * xai-ugc is a two-stage chain — xAI image→video PLUS a required relip to the
 * user's audio — so it is billed as video + lipsync, not as one lipsync run.
 */
export function lipsyncEngineCost(engine: LipsyncEngine): number {
  if (engine === "xai-ugc") {
    const video = computeCost({
      features: ["video"],
      model: LIPSYNC_ENGINE_MODEL["xai-ugc"],
    }).total;
    const relip = computeCost({ features: ["lipsync"], model: XAI_UGC_RELIP_MODEL }).total;
    return video + relip;
  }
  return computeCost({ features: ["lipsync"], model: LIPSYNC_ENGINE_MODEL[engine] }).total;
}

export function computeCost(input: {
  features: Feature[];
  resolution?: Resolution | null;
  durationSeconds?: number | null;
  /** Chosen model — tiers the video/lip-sync base. Falls back to the default tier. */
  model?: string | null;
}): CostQuote {
  const resolution = input.resolution ?? PRICING.defaultResolution;
  const durationSeconds =
    typeof input.durationSeconds === "number" && input.durationSeconds > 0
      ? input.durationSeconds
      : PRICING.referenceSeconds;

  const resMult = PRICING.resolutionMultiplier[resolution];
  const lenMult = durationSeconds / PRICING.referenceSeconds;

  // De-duplicate and apply a stable, canonical ordering for the breakdown.
  const active = FEATURES.filter((f) => input.features.includes(f));
  const hasTemporalOutput = active.some((f) => TEMPORAL_OUTPUTS.has(f));

  const breakdown: CostLineItem[] = active.map((feature) => {
    const base = baseFor(feature, input.model);
    const resolutionFactor = resolutionApplies(feature, hasTemporalOutput) ? resMult : 1;
    const lengthFactor = LENGTH_FEATURES.has(feature) ? lenMult : 1;
    return {
      feature,
      base,
      resolutionFactor,
      lengthFactor,
      subtotal: base * resolutionFactor * lengthFactor,
    };
  });

  const raw = breakdown.reduce((sum, b) => sum + b.subtotal, 0);
  // Round the TOTAL up; never charge 0 for a real (non-empty) generation.
  const total = breakdown.length === 0 ? 0 : Math.max(1, Math.ceil(raw));

  return { total, breakdown, resolution, durationSeconds };
}

export type DetectInput = {
  /** The chosen primary modality. Manual selection IS the override for the primary. */
  kind: Feature;
  /** Driving audio (for an unambiguous lip-sync pairing). */
  audioUrl?: string | null;
  /** Source/driving video (for lip-sync / motion transfer). */
  videoUrl?: string | null;
  /** Explicit motion-transfer / camera-control preset (a requested operation). */
  cameraMovement?: string | null;
  /** Explicit override: force the exact active feature set. */
  features?: Feature[] | null;
};

/**
 * Deterministically derive the active feature set from a request.
 *
 * Detection is conservative and driven by explicit operations/inputs — never by
 * prompt text and never by incidental reference artifacts (a start image for a
 * video, or a stray audio URL alone). This guarantees charges are predictable
 * and that single-feature requests keep their historical price.
 *
 * Add-ons:
 *  - `motion` — added to a video request when an explicit camera-control preset
 *    is supplied (a requested motion-control operation).
 *  - `lipsync` — added only for an unambiguous "drive this audio onto this video"
 *    pair (both `audioUrl` and `videoUrl` present) on a non-lipsync primary.
 */
// ─── Flat-rate job costs (no feature stack — reserved at enqueue time) ───────
// These are the ONLY definitions of these values in the codebase. Server files
// (ugc.server.ts, autocut.server.ts) re-export from here so there is no risk
// of the displayed price and the reserved amount ever drifting apart.

/** AutoCut: multi-clip assembly job. */
export const COST_AUTOCUT = 8;

/** Talking UGC ad: xAI fast path (image→video + mandatory relip to voice track).
 *  Doubled 14 → 28 in the 2026-07-08 video repricing, tracking the underlying
 *  xAI video (standard, 20) + relip (premium lip-sync, 9) stack. */
export const COST_UGC_AD = 28;

/** TikTok Remix Factory: flat reservation per generated cut (a budget-tier
 *  video render). Doubled 5 → 10 in the 2026-07-08 video repricing, in lockstep
 *  with VIDEO_TIER_AURA.budget so a remix cut can't undercut a plain video. */
export const COST_TIKTOK_REMIX_CUT = 10;

/** HeyGen Product Demo: feature-list + screenshots → narrated avatar walkthrough
 *  (Task #276). Priced above a plain talking UGC ad since it's a longer,
 *  multi-feature narrated video, but flat regardless of feature count or
 *  duration preset so the up-front estimate always matches what's reserved. */
export const COST_PRODUCT_DEMO = 32;

// ─── Growth Tools flat costs (Pro only, LLM-based) ───────────────────────────
/** Daily Post Generator: 7 days of captions + image prompt pairs. */
export const COST_DAILY_POSTS = 10;
/** AI Rollout Plan: week-by-week release promotion calendar. */
export const COST_ROLLOUT_PLAN = 5;
/** Social Media Pack: square/portrait captions + 5 caption variants + hashtag sets. */
export const COST_SOCIAL_PACK = 8;

export function detectFeatures(input: DetectInput): {
  features: Feature[];
  primaryKind: Feature;
} {
  const primaryKind = input.kind;

  // An override can only ADD billable features on top of the primary kind — it can
  // never drop the kind to undercharge. (A caller submitting `kind:"video",
  // features:["image"]` is still charged for the video they actually run.) This
  // keeps caller-supplied `features` a safe, additive override, not a credit bypass.
  if (input.features && input.features.length > 0) {
    const forced = new Set<Feature>(input.features);
    forced.add(primaryKind);
    return { features: FEATURES.filter((f) => forced.has(f)), primaryKind };
  }

  const set = new Set<Feature>([primaryKind]);

  if (input.cameraMovement && primaryKind === "video") {
    set.add("motion");
  }
  if (input.audioUrl && input.videoUrl && primaryKind !== "lipsync") {
    set.add("lipsync");
  }

  return { features: FEATURES.filter((f) => set.has(f)), primaryKind };
}
