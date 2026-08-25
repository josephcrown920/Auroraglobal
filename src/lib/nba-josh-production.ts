import { z } from "zod";
import { computeCost } from "./pricing";

export const NBA_JOSH_TEMPLATE = "nba-josh-looping-officers" as const;
export const NBA_JOSH_STILL_MODEL = "fal-ai/seedream-4.5" as const;
export const NBA_JOSH_VIDEO_MODEL = "seedance-2.0-fast" as const;
export const NBA_JOSH_DURATION_SECONDS = 15 as const;
export const NBA_JOSH_LAYER_A_SECONDS = 10 as const;
export const NBA_JOSH_VARIATION_LIMIT = 3 as const;

export const NbaJoshAssetRoleSchema = z.enum([
  "identity",
  "wardrobe",
  "accessory",
  "scene",
  "audio",
  "background",
]);
export type NbaJoshAssetRole = z.infer<typeof NbaJoshAssetRoleSchema>;

const AssetSourceSchema = z.enum(["bundled", "user-upload"]);

export const NbaJoshAssetSchema = z.object({
  id: z.string().min(1).max(100),
  role: NbaJoshAssetRoleSchema,
  label: z.string().min(1).max(180),
  source: AssetSourceSchema,
  sourceFilename: z.string().min(1).max(255).optional(),
  previewUrl: z.string().min(1).max(4000),
  generationUrl: z.string().url().optional(),
  approved: z.boolean().default(false),
});
export type NbaJoshAsset = z.infer<typeof NbaJoshAssetSchema>;

const ApprovalSchema = z.object({
  approved: z.boolean(),
  planHash: z.string().min(1).optional(),
  approvedAt: z.string().datetime().optional(),
});

const QuoteSchema = z.object({
  stills: z.number().int().min(0),
  preview: z.number().int().min(0),
  video: z.number().int().min(0),
  currency: z.literal("Aura"),
});

export const NbaJoshOutfitSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  refs: z.array(NbaJoshAssetSchema).max(8),
  prompt: z.string().min(80).max(5000),
  stillModel: z.literal(NBA_JOSH_STILL_MODEL),
  videoModel: z.literal(NBA_JOSH_VIDEO_MODEL),
  variationCount: z.number().int().min(1).max(NBA_JOSH_VARIATION_LIMIT),
  stillStatus: z.enum(["idle", "awaiting_approval", "queued", "processing", "succeeded", "failed"]),
  videoStatus: z.enum([
    "idle",
    "awaiting_motion_approval",
    "preview_queued",
    "preview_succeeded",
    "queued",
    "processing",
    "succeeded",
    "failed",
  ]),
  stillUrls: z.array(z.string().url()).max(NBA_JOSH_VARIATION_LIMIT),
  selectedStillUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  stillGenerationIds: z.array(z.string().uuid()).max(NBA_JOSH_VARIATION_LIMIT),
  videoGenerationId: z.string().uuid().optional(),
  stillError: z.string().max(1000).optional(),
  videoError: z.string().max(1000).optional(),
  approvals: z.object({
    still: ApprovalSchema,
    motion: ApprovalSchema,
  }),
  quote: QuoteSchema,
});
export type NbaJoshOutfit = z.infer<typeof NbaJoshOutfitSchema>;

export const NbaJoshProductionSchema = z.object({
  template: z.literal(NBA_JOSH_TEMPLATE),
  authorization: z.object({
    creatorAttested: z.boolean(),
    likeness: z.boolean(),
    audio: z.boolean(),
    media: z.boolean(),
  }),
  identityRefs: z.array(NbaJoshAssetSchema).min(1).max(4),
  audioRef: NbaJoshAssetSchema,
  delivery: z.object({
    durationSeconds: z.literal(NBA_JOSH_DURATION_SECONDS),
    aspectRatio: z.literal("16:9"),
    fps: z.literal(60),
  }),
  layers: z.tuple([
    z.object({
      id: z.literal("layer-a"),
      role: z.literal("foreground"),
      durationSeconds: z.literal(NBA_JOSH_LAYER_A_SECONDS),
      status: z.enum(["missing", "ready", "processing", "ready_for_delivery"]),
      url: z.string().url().optional(),
    }),
    z.object({
      id: z.literal("layer-b"),
      role: z.literal("background"),
      durationSeconds: z.literal(NBA_JOSH_DURATION_SECONDS),
      status: z.enum(["missing", "ready"]),
      asset: NbaJoshAssetSchema,
    }),
  ]),
  outfits: z.array(NbaJoshOutfitSchema).min(1).max(3),
  timeline: z.array(z.object({
    start: z.number().min(0).max(15),
    end: z.number().min(0).max(15),
    label: z.string().min(1).max(80),
    direction: z.string().min(1).max(600),
  })).length(5),
  compositeRecipe: z.object({
    loop: z.string().min(1).max(500),
    blur: z.string().min(1).max(500),
    grade: z.string().min(1).max(500),
    vignette: z.string().min(1).max(500),
    export: z.string().min(1).max(500),
  }),
  revision: z.number().int().min(1),
});
export type NbaJoshProduction = z.infer<typeof NbaJoshProductionSchema>;

const JOSH_LOCKED_PROMPT =
  "NBA Josh, 6'3 tall lean long-limbed athletic build, long fully red dreadlocks past the shoulders, exact shoulder tattoos: NBA with stars and JOSH gothic lettering on the right, portrait tattoo on the left, full cloud rose and star sleeves on both forearms, zero face or neck tattoos, diamond NBA JOSH 444 pendant on a heavy Cuban chain, iced-out AP watch, vintage silver microphone hanging from above always visible, calm unbothered energy.";

function bundledAsset(
  id: string,
  role: NbaJoshAssetRole,
  label: string,
  previewUrl: string,
  sourceFilename: string,
): NbaJoshAsset {
  return { id, role, label, source: "bundled", sourceFilename, previewUrl, approved: false };
}

function outfit(
  id: string,
  name: string,
  refs: NbaJoshAsset[],
  wardrobeDirection: string,
): NbaJoshOutfit {
  return {
    id,
    name,
    refs,
    prompt: `${JOSH_LOCKED_PROMPT} ${wardrobeDirection} Rain-soaked wet city street at night, saturated blue and red police-light reflections, the camera tracks calmly with Josh as he delivers his flow into the hanging microphone. Aggressive officers sprint at full intensity behind him, legs pumping and lights strobing, but an impossible invisible-treadmill effect keeps their distance from Josh exactly unchanged. He never runs or panics. Cinematic 16:9 performance plate, no text, no extra tattoos.`,
    stillModel: NBA_JOSH_STILL_MODEL,
    videoModel: NBA_JOSH_VIDEO_MODEL,
    variationCount: 2,
    stillStatus: "awaiting_approval",
    videoStatus: "idle",
    stillUrls: [],
    stillGenerationIds: [],
    approvals: {
      still: { approved: false },
      motion: { approved: false },
    },
    quote: { stills: 0, preview: 0, video: 0, currency: "Aura" },
  };
}

export function defaultNbaJoshProduction(): NbaJoshProduction {
  const identityRefs = [
    bundledAsset(
      "identity-sheet",
      "identity",
      "Identity + tattoo sheet",
      "/josh/identity-reference.jpeg",
      "IMG_4236_1787624159897.jpeg",
    ),
    bundledAsset(
      "identity-profile",
      "identity",
      "Blue-lit profile",
      "/josh/josh-blue-portrait.webp",
      "IMG_1011_1787624159897.png",
    ),
  ];
  const layerB = bundledAsset(
    "officers-layer-b",
    "background",
    "Officers background clip",
    "/josh/looping-officers-hero.png",
    "supplied officers clip — upload required for delivery",
  );
  return {
    template: NBA_JOSH_TEMPLATE,
    authorization: { creatorAttested: false, likeness: false, audio: false, media: false },
    identityRefs,
    audioRef: bundledAsset(
      "the-one-hook-20s",
      "audio",
      "The One hook · canonical 20s cut",
      "/audio/the-one-hook2-20s.mp3",
      "The_one_hook2_20secs_1787628338902.mp3",
    ),
    delivery: { durationSeconds: 15, aspectRatio: "16:9", fps: 60 },
    layers: [
      { id: "layer-a", role: "foreground", durationSeconds: 10, status: "missing" },
      { id: "layer-b", role: "background", durationSeconds: 15, status: "missing", asset: layerB },
    ],
    outfits: [
      outfit(
        "outfit-black-denim",
        "Black distressed denim",
        [bundledAsset("wardrobe-black-denim", "wardrobe", "Black distressed denim", "/josh/looping-officers-city.png", "IMG_3847_1787628965481.png")],
        "Black distressed denim with a sharp street silhouette.",
      ),
      outfit(
        "outfit-red-leather",
        "Red leather statement",
        [bundledAsset("wardrobe-red-leather", "wardrobe", "Red leather performance jersey", "/josh/looping-officers-rain-red.png", "IMG_3769_1787628965481.png")],
        "Red leather jacket over a dark tee, bold against blue night light.",
      ),
      outfit(
        "outfit-chicago-black",
        "Chicago black",
        [bundledAsset("wardrobe-chicago", "wardrobe", "Black shirt performance", "/josh/looping-officers-fire.png", "IMG_3821_1787628965481.png")],
        "Black leather Chicago jacket with the required jewelry catching the practicals.",
      ),
    ],
    timeline: [
      { start: 0, end: 3, label: "Opening", direction: "Hold the calm foreground performance while the hanging microphone enters frame." },
      { start: 3, end: 8, label: "Build", direction: "Push closer as the officers accelerate behind him without gaining ground." },
      { start: 8, end: 12, label: "Tension peak", direction: "Let the treadmill chaos peak while Josh stays centered and composed." },
      { start: 12, end: 14, label: "Glance / smirk", direction: "Josh turns, catches the officers, and gives a small knowing smirk." },
      { start: 14, end: 15, label: "Exit", direction: "He walks away cleanly; the exhausted officers remain empty-handed." },
    ],
    compositeRecipe: {
      loop: "Loop Layer B cleanly to exactly 15 seconds with no speed change.",
      blur: "Keep the officers readable but soften the background one treatment step behind Layer A.",
      grade: "Cool wet-night blues with restrained red accents from hair and wardrobe.",
      vignette: "Subtle edge vignette, never covering the microphone or tattoos.",
      export: "Deliver Layer A and Layer B separately as 16:9 60fps media plus this recipe.",
    },
    revision: 1,
  };
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !["approvals", "quote", "stillStatus", "videoStatus", "stillUrls", "stillGenerationIds", "selectedStillUrl", "videoUrl", "videoGenerationId", "stillError", "videoError"].includes(key))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

/** Stable, server-recomputable signature of creative inputs and paid parameters. */
export function nbaJoshPlanHash(plan: NbaJoshProduction): string {
  const input = JSON.stringify(stableValue(plan));
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ (code + i), 2246822519);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}-${(second >>> 0).toString(16).padStart(8, "0")}`;
}

export function quoteNbaJoshStill(variationCount: number) {
  const unit = computeCost({ features: ["image"], model: NBA_JOSH_STILL_MODEL }).total;
  return unit * variationCount;
}

export function quoteNbaJoshPreview() {
  return Math.max(1, Math.ceil(computeCost({
    features: ["video"],
    model: NBA_JOSH_VIDEO_MODEL,
    resolution: "480p",
    durationSeconds: 5,
  }).total * 0.5));
}

export function quoteNbaJoshVideo() {
  return computeCost({
    features: ["video"],
    model: NBA_JOSH_VIDEO_MODEL,
    resolution: "720p",
    durationSeconds: NBA_JOSH_LAYER_A_SECONDS,
  }).total;
}

export function refreshNbaJoshQuotes(plan: NbaJoshProduction): NbaJoshProduction {
  const preview = quoteNbaJoshPreview();
  const video = quoteNbaJoshVideo();
  return {
    ...plan,
    outfits: plan.outfits.map((item) => ({
      ...item,
      quote: { stills: quoteNbaJoshStill(item.variationCount), preview, video, currency: "Aura" },
    })),
  };
}

export function resetNbaJoshOutfit(outfit: NbaJoshOutfit): NbaJoshOutfit {
  return {
    ...outfit,
    stillStatus: "awaiting_approval",
    videoStatus: "idle",
    stillUrls: [],
    selectedStillUrl: undefined,
    videoUrl: undefined,
    stillGenerationIds: [],
    videoGenerationId: undefined,
    stillError: undefined,
    videoError: undefined,
    approvals: { still: { approved: false }, motion: { approved: false } },
  };
}

export function validateNbaJoshProduction(value: unknown): NbaJoshProduction {
  const parsed = NbaJoshProductionSchema.parse(value);
  for (const outfit of parsed.outfits) {
    if (!outfit.refs.every((ref) => ref.role !== "identity")) {
      throw new Error(`Outfit "${outfit.name}" cannot contain identity references`);
    }
  }
  if (parsed.layers[1].asset.role !== "background") throw new Error("Layer B must use a background asset");
  return refreshNbaJoshQuotes(parsed);
}

export function productionReadiness(plan: NbaJoshProduction) {
  const identityReady = plan.identityRefs.some((ref) => Boolean(ref.generationUrl));
  const audioReady = Boolean(plan.audioRef.generationUrl);
  const layerBReady = Boolean(plan.layers[1].asset.generationUrl);
  const authorizationReady = Object.values(plan.authorization).every(Boolean);
  return { identityReady, audioReady, layerBReady, authorizationReady, readyForPaidWork: identityReady && authorizationReady };
}