// ─── Stacked, resolution/length-based pricing — single source of truth ───────

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

/** Provider-aware model tiers. New BytePlus Seedance routes are never underpriced. */
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

export function tierForModel(feature: "video" | "lipsync", model: string | null | undefined): ModelTier {
  if (feature === "video") return (model ? VIDEO_MODEL_TIERS[model] : undefined) ?? DEFAULT_VIDEO_TIER;
  return (model ? LIPSYNC_MODEL_TIERS[model] : undefined) ?? DEFAULT_LIPSYNC_TIER;
}

function baseFor(feature: Feature, model: string | null | undefined): number {
  if (feature === "video") return VIDEO_TIER_AURA[tierForModel("video", model)];
  if (feature === "lipsync") return LIPSYNC_TIER_AURA[tierForModel("lipsync", model)];
  return PRICING.base[feature];
}

export function computeCost(input: {
  features?: Feature[];
  model?: string | null;
  resolution?: Resolution;
  durationSeconds?: number;
}): { total: number; breakdown: Record<string, number> } {
  const features = input.features ?? [];
  const resolution = input.resolution ?? PRICING.defaultResolution;
  const durationSeconds = Math.max(0, input.durationSeconds ?? PRICING.referenceSeconds);
  const resolutionFactor = PRICING.resolutionMultiplier[resolution];
  const lengthFactor = durationSeconds / PRICING.referenceSeconds;
  const breakdown: Record<string, number> = {};

  for (const feature of features) {
    const base = baseFor(feature, input.model);
    const scalesResolution = feature === "image" || feature === "video" || feature === "lipsync" || feature === "motion";
    const scalesLength = feature === "video" || feature === "lipsync" || feature === "motion";
    const value = base * (scalesResolution ? resolutionFactor : 1) * (scalesLength ? lengthFactor : 1);
    breakdown[feature] = (breakdown[feature] ?? 0) + value;
  }

  return {
    total: Math.max(1, Math.ceil(Object.values(breakdown).reduce((sum, value) => sum + value, 0))),
    breakdown,
  };
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

// ─── Compatibility constants retained from the production pricing surface ────
export const COST_UGC_AD = 280;
export const COST_TIKTOK_REMIX_CUT = 100;
export const COST_PRODUCT_DEMO = 320;
export const COST_DAILY_POSTS = 100;
export const COST_ROLLOUT_PLAN = 50;
export const COST_SOCIAL_PACK = 80;
export const COST_AUTOCUT = 80;
export const TEMPLATE_VIDEO_PRESET_FEE = 50;

export const LIPSYNC_ENGINE_MODEL = {
  "sync-v2": "fal-ai/sync-lipsync/v2",
  wav2lip: "fal-ai/wav2lip",
  latentsync: "latentsync",
  "xai-ugc": "xai/grok-imagine-video-1.5",
  "heygen-photo": "heygen/photo-video",
} as const;
export type LipsyncEngine = keyof typeof LIPSYNC_ENGINE_MODEL;
export const XAI_UGC_RELIP_MODEL = "fal-ai/sync-lipsync/v2";

export function lipsyncEngineCost(engine: LipsyncEngine): number {
  if (engine === "xai-ugc") {
    return computeCost({ features: ["video"], model: LIPSYNC_ENGINE_MODEL[engine] }).total +
      computeCost({ features: ["lipsync"], model: XAI_UGC_RELIP_MODEL }).total;
  }
  return computeCost({ features: ["lipsync"], model: LIPSYNC_ENGINE_MODEL[engine] }).total;
}

export const SOUL_IMAGE_MODEL = "fal/soul-lora";
export const SOUL_VIDEO_MODEL = "seedance-soul";
export function soulImageCost(resolution: Resolution = "720p"): number {
  return computeCost({ features: ["image"], model: SOUL_IMAGE_MODEL, resolution }).total;
}
export function soulVideoCost(durationSeconds: number, resolution: Resolution = "720p"): number {
  return computeCost({ features: ["video"], model: SOUL_VIDEO_MODEL, durationSeconds, resolution }).total;
}
export const SOUL_TRAINING_COST = 300;

// Aura-pack value estimates used by billing UI. Keep the scenario cost derived
// from the same computeCost path as generation charges.
export const AURA_VALUE_SCENARIOS = [
  {
    id: "image",
    label: "AI images",
    shortLabel: "images",
    cost: () => computeCost({ features: ["image"], resolution: "720p" }).total,
  },
  {
    id: "performance",
    label: "Perform Anywhere renders",
    shortLabel: "performance renders",
    cost: () => computeCost({ features: ["video", "motion"], resolution: "720p" }).total,
  },
] as const;
export type AuraValueScenarioId = (typeof AURA_VALUE_SCENARIOS)[number]["id"];
export function auraValueEstimate(balance: number, scenario: AuraValueScenarioId): { cost: number; count: number } {
  const target = AURA_VALUE_SCENARIOS.find((item) => item.id === scenario);
  if (!target) throw new Error(`Unknown Aura value scenario: ${scenario}`);
  const cost = target.cost();
  return { cost, count: Math.max(0, Math.floor(balance / cost)) };
}

export const SOUL_IMAGE_AURA = SOUL_IMAGE_MODEL;
