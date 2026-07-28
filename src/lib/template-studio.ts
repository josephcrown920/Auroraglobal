// ─── One-Tap Template Studio — manifest & cost helper ────────────────────────
//
// The single source of truth for the /templates page. Each template declares the
// ordered orchestrator `kinds` it routes through and a `dispatch` backend, so the
// gallery, the drawer and the cost preview all read from ONE manifest.
//
// Three dispatch backends — all EXISTING paths, no new models or kinds:
//   • "studio" — chains the same server functions the Canvas uses
//     (generatePerformanceShot → generateVideoFromImage → lipSyncVideo), gated by
//     `kinds` (image / image→video / image→video→lipsync).
//   • "ugc"    — generateUGCAd (async job on the generations queue).
//   • "spin"   — the existing /spin experience (one prompt → 30 pieces).
//
// Studio cost is computed per orchestrator kind through pricing.ts `computeCost`
// so the preview is exactly what each stage charges (preview == charge == refund).
// UGC and AutoCut flat costs are imported directly from pricing.ts (the single
// source) — no mirrors, no drift. Spin discloses its real upfront batch charge
// (SPIN_PIECE_COUNT × SPIN_PIECE_COST). This file is intentionally client-safe
// and never imports a *.server module.

import { computeCost, COST_UGC_AD, COST_AUTOCUT, type Resolution } from "./pricing";
// SPIN_PIECE_COST intentionally not imported here: spin dispatch templates
// navigate to /spin (no credit charge in the drawer) so templateCost returns 0.
import { AUDIO_ACCEPT } from "./utils";

// ── Thumbnails (direct file imports resolve to a URL string) ────────────────
// Josh reference photos live in /public — referenced by URL string directly.
const JOSH_LOOPING_OFFICERS_THUMB = "/josh-officers-bg.webp";

import stillNeon from "@/assets/josh/generated/still-01-neon-closeup.jpg";
import stillStage from "@/assets/josh/generated/still-03-stage-mic.jpg";
import stillRooftopSunset from "@/assets/josh/generated/still-06-rooftop-sunset.jpg";
import stillAlley from "@/assets/josh/generated/still-08-alley-mural.jpg";
import stillCarGolden from "@/assets/josh/generated/still-11-car-golden.jpg";
import stillCourtBall from "@/assets/josh/generated/still-13-court-ball.jpg";
import stillFitcheckMirror from "@/assets/josh/generated/still-15-fitcheck-mirror.jpg";
import stillBoardwalk from "@/assets/josh/generated/still-18-boardwalk.jpg";
import clipNeon from "@/assets/josh/generated/clip-01-neon-closeup.mp4";
import clipCarOrbit from "@/assets/josh/generated/clip-14-car-orbit.mp4";
import clipStage from "@/assets/josh/generated/clip-03-stage-mic.mp4";
import clipAlleyNeon from "@/assets/josh/generated/clip-15-alley-neon.mp4";
import clipRooftopSunset from "@/assets/josh/generated/clip-06-rooftop-sunset.mp4";
import clipCourtBall from "@/assets/josh/generated/clip-13-court-ball.mp4";
import kidsMeadow from "@/assets/kids/showcase-meadow.jpg";
import kidsBedtime from "@/assets/kids/showcase-bedtime.jpg";
import kidsBedtimeClip from "@/assets/kids/showcase-bedtime.mp4";
// .asset.json imports expose { url }
import productLipstick from "@/assets/ugc/product-lipstick-car.jpg.asset.json";
import productLifestyleCafe from "@/assets/generated_thumbs/product-lifestyle-cafe-table.png";
import ugcCarProductHold from "@/assets/ugc/ugc-car-product-hold.webp.asset.json";
import ugcHomeSelfie from "@/assets/ugc/ugc-home-selfie.webp.asset.json";

// ── Types ────────────────────────────────────────────────────────────────────
export type TemplateInputKind = "image" | "audio" | "text";

/** The six spec categories, in display order. */
export type TemplateCategory = "Lip-sync" | "Motion" | "UGC/Ad" | "Spin" | "Kids" | "Editing";

/**
 * Orchestrator kinds a template routes through. `image` / `video` / `lipsync`
 * are the studio orchestrator GenerateKinds (see orchestrator.server.ts); `ugc_ad`
 * and `spin` are the batch job kinds those dispatch backends enqueue. Mirrored here
 * as a client-safe literal so this manifest never imports a *.server module.
 */
export type OrchestratorKind = "image" | "video" | "lipsync" | "ugc_ad" | "spin" | "autocut";

/** Which backend runs a template on submit. */
export type TemplateDispatch = "studio" | "ugc" | "spin" | "autocut" | "beat-reel";

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
  /** Ordered orchestrator kinds — the single source of truth for flow + cost. */
  kinds: OrchestratorKind[];
  /** Which backend dispatches this template on submit. */
  dispatch: TemplateDispatch;
  /** Pro-only templates route free users to the upgrade prompt. */
  premium?: boolean;
  inputs: TemplateInput[];

  // ── studio-pipeline params (dispatch === "studio") ──
  imagePrompt?: string;
  imageModel?: string;
  /** If a text input is supplied it is appended to `imagePrompt`. */
  videoPrompt?: string;
  videoModel?: string;
  cameraMovement?: string;
  durationSeconds?: number;
  resolution?: Resolution;
  lipsyncModel?: string;

  /**
   * Pre-fill the image input with this URL so users can generate immediately.
   * Must be an absolute URL or a public-dir path starting with "/".
   * The drawer converts "/" paths to an absolute URL using window.location.origin.
   */
  defaultImageUrl?: string;

  /**
   * Additional background / scene reference image passed alongside the user's
   * photo in the image generation step (appended to imageUrls[]).
   * Lets the model see the intended background composition as a visual guide.
   */
  backgroundImageUrl?: string;

  // ── ugc params (dispatch === "ugc") ──
  ugcAspect?: "9:16" | "16:9" | "1:1" | "4:5";

  // ── spin params (dispatch === "spin") ──
  /** Optional preset appended in front of the user's idea before /spin. */
  spinPreset?: string;
};

// ── Shared defaults (kept in step with pricing tiers) ────────────────────────
export const TEMPLATE_DEFAULTS = {
  imageModel: "google/gemini-3-pro-image-preview",
  videoModel: "seedance-2.0-fast",
  lipsyncModel: "fal-ai/sync-lipsync/v2",
  durationSeconds: 5,
  resolution: "720p" as Resolution,
};

// Re-export flat-rate costs from pricing.ts so UI consumers (ugc.tsx, drawer, etc.)
// can import them from one place without pulling in server-only modules.
export { COST_UGC_AD, COST_AUTOCUT };
// Batch size for the Spin experience — every "1 → N" label reads from this.
export const SPIN_PIECE_COUNT = 50; // === SPIN_COUNT in spin-engine.ts

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
  accept: AUDIO_ACCEPT,
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
    kinds: ["image", "video", "lipsync"],
    dispatch: "studio",
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
    kinds: ["image", "video", "lipsync"],
    dispatch: "studio",
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
    thumbnailVideo: clipRooftopSunset,
    kinds: ["image", "video"],
    dispatch: "studio",
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
    thumbnailVideo: clipCarOrbit,
    kinds: ["image", "video"],
    dispatch: "studio",
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
    thumbnailVideo: clipAlleyNeon,
    kinds: ["image", "video"],
    dispatch: "studio",
    inputs: [IMG("Your photo")],
    imagePrompt: `Vertical 9:16 portrait of the subject leaning against a colourful graffiti mural in an urban alley at night, neon signage glow, street fashion. ${IDENTITY} Photorealistic, 4K.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "Subtle confident sway, flickering neon reflections, slow counter-clockwise camera drift.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "orbit_ccw",
  },

  // ───────────── UGC/Ad ─────────────
  {
    id: "ugc-talking-ad",
    title: "UGC Talking Ad",
    category: "UGC/Ad",
    blurb: "Your face + what you're selling → a native talking UGC ad.",
    thumbnail: productLipstick.url,
    kinds: ["ugc_ad"],
    dispatch: "ugc",
    ugcAspect: "9:16",
    durationSeconds: 8,
    inputs: [
      IMG("Your photo / avatar", "A clear front-facing photo of the presenter"),
      TXT("What are you promoting?", true, "e.g. a matte rose-gold lipstick that lasts all day"),
    ],
  },
  {
    id: "product-lifestyle",
    title: "Product Lifestyle Ad",
    category: "UGC/Ad",
    blurb: "Drop your product photo → a cinematic lifestyle ad clip.",
    thumbnail: productLifestyleCafe,
    kinds: ["image", "video"],
    dispatch: "studio",
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
    category: "UGC/Ad",
    blurb: "Drop your app screenshot → a photoreal iPhone-in-hand hero shot.",
    thumbnail: stillFitcheckMirror,
    kinds: ["image"],
    dispatch: "studio",
    inputs: [IMG("App screenshot", "A full-screen screenshot of your app")],
    imagePrompt:
      "Photorealistic hero shot of a person's hand holding a brand-new iPhone 15 Pro in titanium black. The phone screen displays the EXACT uploaded app UI screenshot, pixel-perfect, no distortion. Soft natural window light from camera-left, clean white seamless backdrop with a subtle gradient, professional product photography, 50mm f/2.8, ultra-sharp screen, gentle hand shadow. Preserve the screen content exactly. No text overlays, no logos.",
    imageModel: TEMPLATE_DEFAULTS.imageModel,
  },

  // ── Grok Imagine-style templates (product promo, UGC walk, fashion try-on) ──
  {
    id: "product-promo-video",
    title: "Product Promo · Cinematic",
    category: "UGC/Ad",
    blurb: "Drop your product photo, write one line — Aurora turns it into a cinematic commercial.",
    thumbnail: ugcCarProductHold.url,
    kinds: ["image", "video"],
    dispatch: "studio",
    inputs: [
      IMG("Product photo", "Any clear shot of your product — bottle, device, package, etc."),
      TXT("What makes it special?", true, "e.g. ultra-hydrating serum with visible results in 3 days"),
    ],
    imagePrompt:
      "Cinematic luxury editorial product photograph. The EXACT product from the reference image — preserve its label, shape, colours and proportions exactly. Placed in a beautifully lit aspirational setting: rich textures, soft bokeh background, warm directional light, 9:16 vertical format. Photorealistic, shallow depth of field, high-end commercial aesthetic. No people in frame.",
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "Slow cinematic push-in on the product, subtle light shimmer and dust particles drifting through the beam, premium brand commercial feel.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "push_in",
    durationSeconds: 6,
  },
  {
    id: "ugc-creator-walk",
    title: "Creator UGC · Walk & Talk",
    category: "UGC/Ad",
    blurb: "Your selfie + your words → authentic walking-toward-camera UGC, ready to post.",
    thumbnail: ugcHomeSelfie.url,
    kinds: ["ugc_ad"],
    dispatch: "ugc",
    ugcAspect: "9:16",
    durationSeconds: 10,
    inputs: [
      IMG("Your photo / selfie", "A clear front-facing photo — the more natural the better"),
      TXT(
        "What do you want to say?",
        true,
        "e.g. I just tried this serum and it's honestly a game changer — the texture alone is insane",
      ),
    ],
  },
  {
    id: "fashion-tryon",
    title: "Virtual Try-On",
    category: "Motion",
    blurb: "Your portrait + any outfit photo → see yourself wearing it in a styled animation.",
    thumbnail: stillFitcheckMirror,
    thumbnailVideo: clipCarOrbit,
    kinds: ["image", "video"],
    dispatch: "studio",
    inputs: [
      IMG("Your portrait", "A clear front-facing or 3/4 photo of yourself"),
      IMG("Outfit / look", "A photo of the clothing or style you want to wear"),
    ],
    imagePrompt:
      `Editorial fashion photograph. Show the EXACT person from the first reference image wearing the EXACT outfit from the second reference image. Preserve the person's facial features, skin tone, body proportions, and hair faithfully. Render the outfit with accurate fabric texture, colour, and cut. Professional fashion editorial lighting, 3:4 portrait format, shallow depth of field, high-end styling. ${IDENTITY}`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "Slow graceful fashion editorial movement — the person shifts their pose naturally, fabric catches the light, confident energy, camera holds still.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "static",
    durationSeconds: 5,
  },

  {
    id: "beat-reel",
    title: "Beat-Drop Reel",
    category: "Motion",
    blurb: "Portrait + outfit photo → 9:16 fashion reel with a snap-zoom jump-cut at the beat drop.",
    thumbnail: stillFitcheckMirror,
    thumbnailVideo: clipAlleyNeon,
    kinds: ["image", "video"],
    dispatch: "beat-reel",
    inputs: [
      IMG("Your portrait", "A clear front-facing or ¾ photo of you"),
      IMG("Outfit / look", "A photo of the clothing or style you want to wear"),
    ],
    imagePrompt:
      `Editorial fashion photograph. Show the EXACT person from the first reference image wearing the EXACT outfit from the second reference image. Preserve the person's facial features, skin tone, body proportions, and hair faithfully. Render the outfit with accurate fabric texture, colour, and cut. Professional fashion editorial lighting, VERTICAL 9:16 portrait format for mobile short-form video, urban streetwear aesthetic, shallow depth of field, high-end styling. ${IDENTITY}`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "Vertical 9:16 fashion reel. At EXACTLY the midpoint of the clip a sudden snap-zoom jump-cut fires — the camera lurches instantly close to the outfit, like a beat-drop. The cut is abrupt and dramatic, not a smooth zoom. First half: wide confident stance. Second half: tight close-up on outfit detail. Urban fashion editorial, cinematic lighting, camera locked off except for the snap-zoom moment.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "static",
    durationSeconds: 5,
  },

  // ───────────── Spin ─────────────
  {
    id: "viral-spin",
    title: "Viral Spin · 1 → 30",
    category: "Spin",
    blurb: "One idea → 30 scroll-stopping pieces across every short-form format.",
    // Talking-head hook frame from the viral-output pool — reads as creator
    // content output rather than a generic headphones portrait.
    thumbnail: "/josh/generated2/viral-01-lyric-hook.webp",
    kinds: ["spin"],
    dispatch: "spin",
    inputs: [
      TXT("Describe your idea", true, "e.g. hot-pink cyclorama magazine cover, hair-flip hook"),
    ],
  },
  {
    id: "trend-remix-spin",
    title: "Trend Remix · 1 → 30",
    category: "Spin",
    blurb: "Turn a single trend into a full 30-piece content drop.",
    thumbnail: stillBoardwalk,
    kinds: ["spin"],
    dispatch: "spin",
    spinPreset: "Trend remix, bold high-contrast colour grade, punchy captions",
    inputs: [TXT("What's the trend?", true, "e.g. slow-mo outfit reveal to a viral audio")],
  },

  // ───────────── Kids ─────────────
  {
    id: "kids-storybook",
    title: "Storybook Character",
    category: "Kids",
    blurb: "Turn a photo into a warm hand-painted storybook character.",
    thumbnail: kidsMeadow,
    kinds: ["image"],
    dispatch: "studio",
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
    kinds: ["image", "video"],
    dispatch: "studio",
    inputs: [IMG("A photo")],
    imagePrompt:
      "Transform the uploaded photo into a soft, dreamy children's storybook bedtime scene: cozy bedroom, warm nightlight glow, gentle watercolour illustration, twinkling stars through the window. Keep the likeness wholesome and recognisable. No text.",
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "Very gentle drifting motion, stars softly twinkling, a calm slow push-in, dreamy bedtime mood.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "push_in",
  },

  // ───────────── Motion (NBA Josh) ─────────────
  {
    id: "looping-officers",
    title: "Looping Officers",
    category: "Motion",
    blurb:
      "NBA Josh stands calm in the foreground. Officers loop endlessly behind him — running hard, going nowhere. Cinematic 16:9 night scene.",
    thumbnail: JOSH_LOOPING_OFFICERS_THUMB,
    kinds: ["image", "video"],
    dispatch: "studio",
    defaultImageUrl: "/josh-ref-3.jpeg",
    backgroundImageUrl: "/josh-officers-bg.webp",
    inputs: [
      IMG(
        "Josh reference photo",
        "Pre-filled — upload a replacement if needed",
      ),
    ],
    imagePrompt: `Cinematic 16:9 music video still. A tall athletic Black male rapper, 6ft 3in, lean build, with long bright red-tipped dreadlocks, alien-frame red sunglasses with circular green reptile-eye lenses, a large diamond "NEVER JXST" chain, arm tattoos with "NBA JOSH" lettering on the right forearm, wearing a maroon and black Z-brand athletic jersey. He stands in the BOTTOM RIGHT of the frame, shot from waist up, facing slightly left toward camera. Dark wet urban street at night. Dramatic overhead streetlight, high contrast cinematic atmosphere, shallow depth of field. Two police officers in full navy uniform run aggressively in the TOP LEFT of frame, full body visible, arms pumping intensely, leaning forward, urgent expressions — motion blur on their bodies. The rapper looks calm, fearless, completely unbothered. Photorealistic, 4K music video aesthetic. ${IDENTITY}`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "The rapper performs his hook in the bottom right with calm fearless energy and subtle hand gestures. The officers in the top left keep running in place — stuck in a looping glitch, never advancing. Static locked-off camera, zero movement. Near the end the rapper glances over his left shoulder with a cool smirk, then casually turns and walks out of frame while the officers are still running.",
    videoModel: "kling-3.0",
    cameraMovement: "static",
    durationSeconds: 10,
    resolution: "720p",
  },

  // ───────────── Editing ─────────────
  {
    id: "autocut-hype",
    title: "AutoCut — Hype",
    category: "Editing",
    blurb: "Drop your clips and Aurora cuts a beat-synced, fast-paced 9:16 short for you.",
    thumbnail: stillCourtBall,
    thumbnailVideo: clipCourtBall,
    kinds: ["autocut"],
    dispatch: "autocut",
    inputs: [],
  },
];

// Category display order for the gallery.
export const CATEGORY_ORDER: TemplateCategory[] = ["Lip-sync", "Motion", "UGC/Ad", "Spin", "Kids", "Editing"];

export function getStudioTemplate(id: string): StudioTemplate | undefined {
  return STUDIO_TEMPLATES.find((t) => t.id === id);
}

/**
 * Total Aura for a template.
 *  - studio: the SUM of each orchestrator kind's `computeCost`, matching exactly
 *    what generatePerformanceShot / generateVideoFromImage / lipSyncVideo charge.
 *  - ugc:  the flat COST_UGC_AD reserved by generateUGCAd.
 *  - spin: SPIN_PIECE_COUNT × SPIN_PIECE_COST — spinThirty charges the whole
 *    batch upfront (10 Aura per piece; failed pieces auto-refund their Aura).
 * Preview can therefore never disagree with the real charge.
 */
export function templateCost(t: StudioTemplate): number {
  if (t.dispatch === "ugc") return COST_UGC_AD;
  // Spin templates navigate to /spin where the user explicitly pays 300 Aura.
  // No credits are charged in the template drawer itself → cost = 0 (Free).
  if (t.dispatch === "spin") return 0;
  if (t.dispatch === "autocut") return COST_AUTOCUT;
  // beat-reel: image composite + full-quality video (same stack the page charges)
  if (t.dispatch === "beat-reel") {
    return (
      computeCost({ features: ["image"] }).total +
      computeCost({
        features: ["video"],
        model: t.videoModel ?? TEMPLATE_DEFAULTS.videoModel,
        durationSeconds: t.durationSeconds ?? TEMPLATE_DEFAULTS.durationSeconds,
        resolution: t.resolution ?? TEMPLATE_DEFAULTS.resolution,
      }).total
    );
  }

  let total = 0;
  for (const kind of t.kinds) {
    if (kind === "image") {
      total += computeCost({ features: ["image"] }).total;
    } else if (kind === "video") {
      total += computeCost({
        features: ["video"],
        model: t.videoModel ?? TEMPLATE_DEFAULTS.videoModel,
        durationSeconds: t.durationSeconds ?? TEMPLATE_DEFAULTS.durationSeconds,
        resolution: t.resolution ?? TEMPLATE_DEFAULTS.resolution,
      }).total;
    } else if (kind === "lipsync") {
      total += computeCost({
        features: ["lipsync"],
        model: t.lipsyncModel ?? TEMPLATE_DEFAULTS.lipsyncModel,
      }).total;
    }
  }
  return total;
}

/** Short flow label for a card badge, derived from the manifest (no hardcoding). */
export function templateFlowLabel(t: StudioTemplate): string {
  if (t.dispatch === "spin") return `1 → ${SPIN_PIECE_COUNT}`;
  if (t.dispatch === "ugc") return "Talking ad";
  if (t.dispatch === "autocut") return "Auto edit";
  if (t.dispatch === "beat-reel") return "Reel";
  if (t.kinds.includes("lipsync")) return "Lip-sync";
  if (t.kinds.includes("video")) return "Video";
  return "Image";
}
