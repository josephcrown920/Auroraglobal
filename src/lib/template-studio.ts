// ─── One-Tap Template Studio — manifest & cost helper ────────────────────────
//
// The single source of truth for the /templates page. Each template maps to an
// existing orchestrator flow (image / image→video / image→video→lipsync) built
// from the SAME server functions the Canvas uses (generatePerformanceShot,
// generateVideoFromImage, lipSyncVideo). No new models or generation kinds.
//
// Cost is computed per-stage through pricing.ts `computeCost` so the drawer's
// preview is exactly the sum of what each stage actually charges (preview ==
// charge == refund). This file is intentionally client-safe — it imports only
// pricing.ts and static assets, never a *.server module.

import { computeCost, type Feature, type Resolution } from "./pricing";

// ── Thumbnails (direct file imports resolve to a URL string) ────────────────
import stillNeon from "@/assets/josh/generated/still-01-neon-closeup.jpg";
import stillStage from "@/assets/josh/generated/still-03-stage-mic.jpg";
import stillStudioGel from "@/assets/josh/generated/still-05-studio-gel.jpg";
import stillRooftopSunset from "@/assets/josh/generated/still-06-rooftop-sunset.jpg";
import stillBooth from "@/assets/josh/generated/still-07-booth-headphones.jpg";
import stillAlley from "@/assets/josh/generated/still-08-alley-mural.jpg";
import stillCarGolden from "@/assets/josh/generated/still-11-car-golden.jpg";
import stillRooftopDay from "@/assets/josh/generated/still-17-rooftop-day.jpg";
import clipNeon from "@/assets/josh/generated/clip-01-neon-closeup.mp4";
import clipStage from "@/assets/josh/generated/clip-03-stage-mic.mp4";
import kidsMeadow from "@/assets/kids/showcase-meadow.jpg";
import kidsBedtime from "@/assets/kids/showcase-bedtime.jpg";
import kidsBedtimeClip from "@/assets/kids/showcase-bedtime.mp4";
// .asset.json imports expose { url }
import blueFullbody from "@/assets/josh/josh-blue-fullbody.png.asset.json";
import productLipstick from "@/assets/ugc/product-lipstick-car.jpg.asset.json";

// ── Types ────────────────────────────────────────────────────────────────────
export type TemplateFlow = "image" | "video" | "lipsync";
export type TemplateInputKind = "image" | "audio" | "text";
export type TemplateCategory = "Lip-sync" | "Motion" | "Portrait" | "UGC & Ads" | "Kids";

export type TemplateInput = {
  kind: TemplateInputKind;
  label: string;
  hint?: string;
  required: boolean;
  /** `accept` for file inputs (image/audio). */
  accept?: string;
};

export type StudioTemplate = {
  id: string;
  title: string;
  category: TemplateCategory;
  blurb: string;
  thumbnail: string;
  /** Optional looping preview clip (mp4) shown instead of the still. */
  thumbnailVideo?: string;
  flow: TemplateFlow;
  /** Pro-only templates route to a locked/upgrade prompt for free users. */
  premium?: boolean;
  inputs: TemplateInput[];
  // ── generation params (defaults applied by the runner when omitted) ──
  imagePrompt: string;
  imageModel: string;
  /** If a text input is supplied it is appended to `imagePrompt`. */
  videoPrompt?: string;
  videoModel?: string;
  cameraMovement?: string;
  durationSeconds?: number;
  resolution?: Resolution;
  lipsyncModel?: string;
};

// ── Shared defaults (kept in step with pricing tiers) ────────────────────────
export const TEMPLATE_DEFAULTS = {
  imageModel: "google/gemini-3-pro-image-preview",
  videoModel: "seedance-2.0-fast",
  lipsyncModel: "fal-ai/sync-lipsync/v2",
  durationSeconds: 5,
  resolution: "720p" as Resolution,
};

const IDENTITY =
  "Preserve the exact facial likeness, skin tone, hair and identity from the uploaded reference photo with no drift.";

// ── Input builders ───────────────────────────────────────────────────────────
const IMG = (label = "Your photo", hint?: string): TemplateInput => ({
  kind: "image",
  label,
  hint,
  required: true,
  accept: "image/*",
});
const AUD = (label = "Your song or audio", hint?: string): TemplateInput => ({
  kind: "audio",
  label,
  hint,
  required: true,
  accept: "audio/*",
});
const TXT = (label: string, required: boolean, hint?: string): TemplateInput => ({
  kind: "text",
  label,
  hint,
  required,
});

// ── Manifest ─────────────────────────────────────────────────────────────────
export const STUDIO_TEMPLATES: StudioTemplate[] = [
  // ───────────── Lip-sync ─────────────
  {
    id: "concert-lipsync",
    title: "Concert Lip-sync",
    category: "Lip-sync",
    blurb: "Your photo + your song → a stage performance that sings every word.",
    thumbnail: stillStage,
    thumbnailVideo: clipStage,
    flow: "lipsync",
    premium: true,
    inputs: [
      IMG("Your photo", "A clear front-facing photo works best"),
      AUD("Your song or vocal", "MP3 / WAV, up to ~30s"),
    ],
    imagePrompt: `Portrait of the subject performing on a concert stage, holding a vintage SM7B microphone on a boom, dramatic spotlights and atmospheric haze, crowd silhouettes in front. ${IDENTITY} Vertical 9:16, photorealistic, 4K.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "The subject sings into the microphone, expressive, subtle head sway, locked confident camera.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "static",
    lipsyncModel: TEMPLATE_DEFAULTS.lipsyncModel,
  },
  {
    id: "music-video-mini",
    title: "Music Video Mini",
    category: "Lip-sync",
    blurb: "A cinematic neon music-video moment, lip-synced to your track.",
    thumbnail: stillNeon,
    thumbnailVideo: clipNeon,
    flow: "lipsync",
    premium: true,
    inputs: [IMG("Your photo"), AUD("Your song or vocal")],
    imagePrompt: `Cinematic vertical 9:16 close-up music-video still of the subject under glowing magenta and cyan neon studio lighting, looking into camera, shallow depth of field. ${IDENTITY} Photorealistic, 4K.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "Confident performance energy, subtle head movement, neon lights softly flickering, cinematic push-in.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "push_in",
    lipsyncModel: TEMPLATE_DEFAULTS.lipsyncModel,
  },

  // ───────────── Motion ─────────────
  {
    id: "cinematic-reel",
    title: "Cinematic Selfie Reel",
    category: "Motion",
    blurb: "One photo → a golden-hour cinematic clip with living motion.",
    thumbnail: stillRooftopSunset,
    flow: "video",
    inputs: [IMG("Your photo")],
    imagePrompt: `Cinematic vertical 9:16 portrait of the subject on a city rooftop at golden hour, skyline behind, warm rim light, slight wind in the hair. ${IDENTITY} Photorealistic, 4K.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "Hair drifting in the wind, clouds moving behind, gentle natural micro-expressions, cinematic push-in.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "push_in",
  },
  {
    id: "rooftop-golden",
    title: "Golden Hour Orbit",
    category: "Motion",
    blurb: "A slow cinematic orbit around you in warm golden light.",
    thumbnail: stillCarGolden,
    flow: "video",
    inputs: [IMG("Your photo")],
    imagePrompt: `Vertical 9:16 portrait of the subject leaning against a classic car at sunset, warm golden light, lens flare, street-fashion styling. ${IDENTITY} Photorealistic, 4K.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "Slow cinematic camera orbit around the subject, golden particles in the light, natural movement.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "orbit_cw",
  },
  {
    id: "neon-night-move",
    title: "Neon Night Move",
    category: "Motion",
    blurb: "A moody street-mural clip drenched in neon.",
    thumbnail: stillAlley,
    flow: "video",
    inputs: [IMG("Your photo")],
    imagePrompt: `Vertical 9:16 portrait of the subject leaning against a colourful graffiti mural in an urban alley at night, neon signage glow, street fashion. ${IDENTITY} Photorealistic, 4K.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "Subtle confident sway, flickering neon reflections, slow counter-clockwise camera drift.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "orbit_ccw",
  },

  // ───────────── Portrait ─────────────
  {
    id: "editorial-cover",
    title: "Editorial Cover",
    category: "Portrait",
    blurb: "A magazine-grade Rembrandt-lit cover portrait.",
    thumbnail: stillStudioGel,
    flow: "image",
    inputs: [IMG("Your photo")],
    imagePrompt: `Editorial magazine cover portrait of the subject, Rembrandt lighting, 85mm lens, refined styling, subtle film grain, fashion-campaign quality. ${IDENTITY} 4K.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
  },
  {
    id: "blue-performance",
    title: "Blue Performance",
    category: "Portrait",
    blurb: "A full-body royal-blue cyclorama editorial shot.",
    thumbnail: blueFullbody.url,
    flow: "image",
    inputs: [IMG("Your photo")],
    imagePrompt: `Full-body editorial portrait of the subject standing centered on a seamless royal-blue cyclorama. Monochromatic blue ambient light wrapping the body, soft rim light from camera-left, deep cyan shadow falloff, faint smoke, outfit recolored to complementary cobalt. ${IDENTITY} Shot on 35mm, 4K, fashion campaign quality.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
  },
  {
    id: "neon-portrait",
    title: "Neon Studio Portrait",
    category: "Portrait",
    blurb: "A tight neon-lit close-up with cinematic falloff.",
    thumbnail: stillBooth,
    flow: "image",
    inputs: [IMG("Your photo")],
    imagePrompt: `Tight vertical 9:16 close-up portrait of the subject under glowing magenta and cyan neon studio lighting, looking straight into camera, shallow depth of field. ${IDENTITY} Photorealistic, 4K.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
  },
  {
    id: "custom-scene",
    title: "Custom Scene",
    category: "Portrait",
    blurb: "Upload a photo and describe any scene — we render you into it.",
    thumbnail: stillRooftopDay,
    flow: "image",
    inputs: [
      IMG("Your photo"),
      TXT("Describe your scene", true, "e.g. standing on a beach at sunset in a white linen suit"),
    ],
    imagePrompt: `Cinematic photorealistic portrait of the subject. ${IDENTITY} 4K, natural lighting, sharp focus.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
  },

  // ───────────── UGC & Ads ─────────────
  {
    id: "product-lifestyle",
    title: "Product Lifestyle Ad",
    category: "UGC & Ads",
    blurb: "Drop your product photo → a cinematic lifestyle ad clip.",
    thumbnail: productLipstick.url,
    flow: "video",
    inputs: [IMG("Product photo", "A clean shot of your product")],
    imagePrompt:
      "Editorial lifestyle product photograph: the EXACT uploaded product placed naturally on a warm walnut cafe table with a soft-focus latte, an open notebook and golden-hour window light from camera-right. Shallow depth of field, 50mm, Kodak Portra 400 grain, magazine colour. Preserve the product's label, shape, colours and proportions exactly — do not redesign it. No people in frame.",
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "Slow cinematic push-in on the product, steam rising from the latte, soft particles in the light beam, locked tripod feel.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "push_in",
  },
  {
    id: "app-hero",
    title: "App Hero · iPhone",
    category: "UGC & Ads",
    blurb: "Drop your app screenshot → a photoreal iPhone-in-hand hero shot.",
    thumbnail: stillRooftopDay,
    flow: "image",
    inputs: [IMG("App screenshot", "A full-screen screenshot of your app")],
    imagePrompt:
      "Photorealistic hero shot of a person's hand holding a brand-new iPhone 15 Pro in titanium black. The phone screen displays the EXACT uploaded app UI screenshot, pixel-perfect, no distortion. Soft natural window light from camera-left, clean white seamless backdrop with a subtle gradient, professional product photography, 50mm f/2.8, ultra-sharp screen, gentle hand shadow. Preserve the screen content exactly. No text overlays, no logos.",
    imageModel: TEMPLATE_DEFAULTS.imageModel,
  },

  // ───────────── Kids ─────────────
  {
    id: "kids-storybook",
    title: "Storybook Character",
    category: "Kids",
    blurb: "Turn a photo into a warm hand-painted storybook character.",
    thumbnail: kidsMeadow,
    flow: "image",
    inputs: [IMG("A photo", "A clear, friendly photo")],
    imagePrompt:
      "Transform the uploaded photo into a charming hand-painted children's storybook character: soft watercolour illustration, warm golden light, whimsical friendly style, cozy picture-book meadow background. Keep the likeness recognisable and wholesome. No text.",
    imageModel: TEMPLATE_DEFAULTS.imageModel,
  },
  {
    id: "kids-bedtime",
    title: "Bedtime Reel",
    category: "Kids",
    blurb: "A gentle, dreamy bedtime clip from a single photo.",
    thumbnail: kidsBedtime,
    thumbnailVideo: kidsBedtimeClip,
    flow: "video",
    inputs: [IMG("A photo")],
    imagePrompt:
      "Transform the uploaded photo into a soft, dreamy children's storybook bedtime scene: cozy bedroom, warm nightlight glow, gentle watercolour illustration, twinkling stars through the window. Keep the likeness wholesome and recognisable. No text.",
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "Very gentle drifting motion, stars softly twinkling, a calm slow push-in, dreamy bedtime mood.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "push_in",
  },
];

// Category display order for the gallery.
export const CATEGORY_ORDER: TemplateCategory[] = [
  "Lip-sync",
  "Motion",
  "Portrait",
  "UGC & Ads",
  "Kids",
];

export function getStudioTemplate(id: string): StudioTemplate | undefined {
  return STUDIO_TEMPLATES.find((t) => t.id === id);
}

/** The billable features for each stage of a template's flow, in run order. */
export function templateStages(flow: TemplateFlow): Feature[][] {
  if (flow === "image") return [["image"]];
  if (flow === "video") return [["image"], ["video"]];
  return [["image"], ["video"], ["lipsync"]];
}

/**
 * Total Aura for a template = the SUM of each stage's `computeCost`, matching
 * exactly what generatePerformanceShot / generateVideoFromImage / lipSyncVideo
 * each charge. Preview can therefore never disagree with the real charge.
 */
export function templateCost(t: StudioTemplate): number {
  const stages = templateStages(t.flow);
  let total = 0;
  for (const features of stages) {
    if (features.includes("video")) {
      total += computeCost({
        features,
        model: t.videoModel ?? TEMPLATE_DEFAULTS.videoModel,
        durationSeconds: t.durationSeconds ?? TEMPLATE_DEFAULTS.durationSeconds,
        resolution: t.resolution ?? TEMPLATE_DEFAULTS.resolution,
      }).total;
    } else if (features.includes("lipsync")) {
      total += computeCost({
        features,
        model: t.lipsyncModel ?? TEMPLATE_DEFAULTS.lipsyncModel,
      }).total;
    } else {
      total += computeCost({ features }).total;
    }
  }
  return total;
}

/** Human labels for the required inputs (used in card meta + validation). */
export function requiredInputKinds(t: StudioTemplate): TemplateInputKind[] {
  return t.inputs.filter((i) => i.required).map((i) => i.kind);
}
