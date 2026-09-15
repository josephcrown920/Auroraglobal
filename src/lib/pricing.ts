// ─── Stacked, resolution/length-based pricing — single source of truth ───────
//
// Every charge point (public /api/public/generate, the AI Router server fn, and
// the AI Router UI preview) prices a generation through THIS module so a preview
// can never disagree with what is actually reserved/charged.

export const ONBOARDING_BONUS_AURA = 30;

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

export const FEATURES: readonly Feature[] = [
  "image", "upscale", "text", "audio", "video", "lipsync", "motion", "caption_burn", "lyric_video",
];

export const PRICING = {
  base: {
    image: 10,
    upscale: 10,
    text: 10,
    audio: 20,
    lipsync: 30,
    motion: 300,
    video: 100,
    caption_burn: 20,
    lyric_video: 50,
  } as Record<Feature, number>,
  resolutionMultiplier: {
    "480p": 0.5,
    "720p": 1,
    "1080p": 2,
    "2160p": 4,
  } as Record<Resolution, number>,
  referenceSeconds: 5,
  defaultResolution: "720p" as Resolution,
} as const;

export type ModelTier = "budget" | "standard" | "premium" | "ultra" | "max";

export const VIDEO_TIER_AURA: Record<ModelTier, number> = {
  budget: 100,
  standard: 200,
  premium: 320,
  ultra: 480,
  max: 600,
};

export const LIPSYNC_TIER_AURA: Record<ModelTier, number> = {
  budget: 30,
  standard: 60,
  premium: 90,
  ultra: 100,
  max: 120,
};

/**
 * Model → Aura tier. BytePlus Seedance 2.x entries are deliberately priced
 * from the direct ModelArk route now exposed by models.ts, rather than the old
 * cheaper FAL-only assumptions. Legacy aliases remain so saved jobs do not
 * become unpriceable after the registry cleanup.
 */
export const VIDEO_MODEL_TIERS: Record<string, ModelTier> = {
  "seedance-2.0-fast": "standard",
  "seedance-2.0": "ultra",
  "seedance-2.0-mini": "standard",
  "seedance-1.5-pro": "ultra",
  "seedance-3.0": "ultra", // legacy saved-preference alias
  "kling-v1": "standard",
  "veo-3-fast": "premium",
  "runway/gen3a-turbo": "premium",
  "runway/gen4-turbo": "premium",
  "fal-fallback/kling-video": "premium",
  "sora-2": "premium",
  "openai/sora-2": "premium",
  "openai/sora-2-pro": "ultra",
  "ltx/ltx-video": "standard",
  "kling-3.0": "ultra",
  "kling-3.0-omni": "ultra",
  "veo-2": "premium",
  "veo-3": "ultra",
  "seedance-2.5": "max",
  "byteplus/seedance-2.5": "max",
  "xai/grok-imagine-video-1.5": "standard",
  "heygen/video-agent": "ultra",
  "heygen/template": "ultra",
  "hf/text-to-video": "budget",
  "fal/ltx-video": "budget",
  "fal/ltx-motion": "budget",
  "inferencesh/veo-3-1-fast": "standard",
  "seedance-soul": "ultra",
};

export const LIPSYNC_MODEL_TIERS: Record<string, ModelTier> = {
  latentsync: "budget",
  "fal-ai/wav2lip": "standard",
  "sync/lipsync-2": "premium",
  "fal-ai/sync-lipsync/v2": "premium",
  "fal-fallback/sync-lipsync": "premium",
  "heygen/lipsync": "ultra",
  "xai/grok-imagine-video-1.5": "premium",
  "heygen/photo-video": "ultra",
  "heygen/avatar": "ultra",
};

export const DEFAULT_VIDEO_TIER: ModelTier = "standard";
export const DEFAULT_LIPSYNC_TIER: ModelTier = "premium";

// ─── Aurora Soul pricing ──────────────────────────────────────────────────────
export const SOUL_IMAGE_MODEL = "seedream-soul";
export const SOUL_VIDEO_MODEL = "seedance-soul";
export const SOUL_IMAGE_AURA = 10;
export const SOUL_VIDEO_AURA = 480;

export function modelTierForVideo(model?: string | null): ModelTier {
  return (model && VIDEO_MODEL_TIERS[model]) ?? DEFAULT_VIDEO_TIER;
}

export function modelTierForLipsync(model?: string | null): ModelTier {
  return (model && LIPSYNC_MODEL_TIERS[model]) ?? DEFAULT_LIPSYNC_TIER;
}

export function computeCost(input: {
  features?: Feature[];
  model?: string | null;
  resolution?: Resolution;
  durationSeconds?: number;
}): { total: number; breakdown: Record<string, number> } {
  const features = input.features ?? [];
  const resolution = input.resolution ?? PRICING.defaultResolution;
  const duration = Math.max(0, input.durationSeconds ?? PRICING.referenceSeconds);
  const lengthFactor = duration / PRICING.referenceSeconds;
  const resolutionFactor = PRICING.resolutionMultiplier[resolution];
  const breakdown: Record<string, number> = {};

  for (const feature of features) {
    let base = PRICING.base[feature];
    if (feature === "video") base = VIDEO_TIER_AURA[modelTierForVideo(input.model)];
    if (feature === "lipsync") base = LIPSYNC_TIER_AURA[modelTierForLipsync(input.model)];
    const scalesResolution = feature === "image" || feature === "video" || feature === "lipsync" || feature === "motion";
    const scalesLength = feature === "video" || feature === "lipsync" || feature === "motion";
    const value = base * (scalesResolution ? resolutionFactor : 1) * (scalesLength ? lengthFactor : 1);
    breakdown[feature] = (breakdown[feature] ?? 0) + value;
  }

  const total = Math.max(1, Math.ceil(Object.values(breakdown).reduce((sum, value) => sum + value, 0)));
  return { total, breakdown };
}

export function detectFeatures(input: { kind?: string; model?: string | null }): Feature[] {
  if (input.kind === "video") return ["video"];
  if (input.kind === "lipsync") return ["lipsync"];
  if (input.kind === "motion") return ["motion"];
  if (input.kind === "audio") return ["audio"];
  if (input.kind === "upscale") return ["upscale"];
  if (input.kind === "text") return ["text"];
  return ["image"];
}
