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
import stillStreetGolden from "@/assets/josh/generated/still-02-street-golden.jpg";
import clipStreetGolden from "@/assets/josh/generated/clip-02-street-golden.mp4";
import stillStage from "@/assets/josh/generated/still-03-stage-mic.jpg";
import stillCafeSelfie from "@/assets/josh/generated/still-04-cafe-selfie.jpg";
import stillStudioGel from "@/assets/josh/generated/still-05-studio-gel.jpg";
import clipStudioGel from "@/assets/josh/generated/clip-05-studio-gel.mp4";
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
import thumbEditorialCover from "@/assets/generated_thumbs/editorial-cover.jpg";
import thumbNeonStreet from "@/assets/generated_thumbs/neon-street.jpg";
import thumbUrbanAlley from "@/assets/generated_thumbs/urban-alley.jpg";
import thumbUrbanSubway from "@/assets/generated_thumbs/urban-subway.jpg";
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

/**
 * AutoCut edit styles — client-safe mirror of autocut.server.ts STYLES.
 * /edit validates its `?style=` search param against this list, and the
 * Editing templates below deep-link into /edit with one pre-selected.
 */
export const AUTOCUT_STYLE_IDS = ["hype", "cinematic", "talking_head", "tiktok_hook"] as const;
export type AutocutStyle = (typeof AUTOCUT_STYLE_IDS)[number];

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

  // ── autocut params (dispatch === "autocut") ──
  /** Pre-selected AutoCut edit style — /edit opens with this style active. */
  autocutStyle?: AutocutStyle;
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

  {
    id: "editorial-cover",
    title: "Editorial Cover",
    category: "Motion",
    blurb: "Turn your photo into a glossy magazine-cover moment.",
    thumbnail: thumbEditorialCover,
    kinds: ["image"],
    dispatch: "studio",
    inputs: [IMG("Your photo", "A clear front-facing or ¾ portrait")],
    imagePrompt: `High-fashion magazine cover photograph of the subject, vertical 9:16. Seamless studio backdrop, dramatic editorial lighting with a strong key and soft fill, confident direct gaze into camera, glossy high-end retouching, clean negative space at the top of the frame for a masthead. Shot on medium format, razor sharp. ${IDENTITY} No text, no letters, no watermark.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
  },
  {
    id: "neon-street",
    title: "Neon Street",
    category: "Motion",
    blurb: "Walk through rain-slicked neon like a movie still come alive.",
    thumbnail: thumbNeonStreet,
    kinds: ["image", "video"],
    dispatch: "studio",
    inputs: [IMG("Your photo")],
    imagePrompt: `Cinematic vertical 9:16 night photograph of the subject walking toward camera down a rain-slicked city street glowing with pink and cyan neon storefront signs, reflections in the wet asphalt, atmospheric haze, shallow depth of field, 35mm anamorphic film-still aesthetic. ${IDENTITY} Photorealistic, 4K.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "The subject walks slowly toward camera with confident stride, neon signs flickering and reflecting in the wet street, light rain drifting through the glow, cinematic slow pull-out keeping the subject centered.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "pull_out",
  },
  {
    id: "rooftop-golden-hour",
    title: "Rooftop Golden",
    category: "Motion",
    blurb: "A warm rooftop golden-hour portrait with drifting skyline light.",
    thumbnail: stillRooftopSunset,
    thumbnailVideo: clipRooftopSunset,
    kinds: ["image", "video"],
    dispatch: "studio",
    inputs: [IMG("Your photo")],
    imagePrompt: `Vertical 9:16 golden-hour portrait of the subject standing at the edge of a city rooftop, sun low on the horizon behind the skyline, warm amber rim light wrapping the face, gentle lens flare, relaxed confident pose. ${IDENTITY} Photorealistic, 4K.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "Golden sunlight shimmering, clouds drifting slowly behind the skyline, hair moving gently in the rooftop breeze, subtle natural micro-expressions, slow cinematic zoom in.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "zoom_in",
  },
  {
    id: "urban-alley",
    title: "Urban Alley",
    category: "Motion",
    blurb: "A gritty alley editorial with a shaft of sunlight cutting through.",
    thumbnail: thumbUrbanAlley,
    kinds: ["image", "video"],
    dispatch: "studio",
    inputs: [IMG("Your photo")],
    imagePrompt: `Vertical 9:16 cinematic photograph of the subject leaning against a brick wall in a narrow urban alley, fire escapes overhead, a diagonal shaft of sunlight cutting through with visible dust in the beam, gritty street-fashion editorial styling, shallow depth of field. ${IDENTITY} Photorealistic, 4K.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "Dust particles drifting through the sunbeam, the subject shifts weight and glances toward camera, fabric moving naturally, slow smooth pan from left to right across the alley.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "pan_right",
  },
  {
    id: "urban-subway",
    title: "Urban Subway",
    category: "Motion",
    blurb: "A moody subway-platform scene as a train streaks past behind you.",
    thumbnail: thumbUrbanSubway,
    kinds: ["image", "video"],
    dispatch: "studio",
    inputs: [IMG("Your photo")],
    imagePrompt: `Vertical 9:16 cinematic photograph of the subject standing on an empty subway platform at night, warm tungsten platform lights against cool fluorescent tunnel glow, a motion-blurred train streaking past behind, moody cinematic colour grade, film-still aesthetic. ${IDENTITY} Photorealistic, 4K.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "The train rushes past behind the subject in a continuous motion blur, wind from the train tugging at clothes and hair, the subject holds a calm steady gaze into camera, locked-off static frame.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "static",
  },
  {
    id: "colors-wide",
    title: "Colors Wide",
    category: "Motion",
    blurb: "A full-body performance on a bold single-colour cyclorama set.",
    thumbnail: "/josh/generated2/colors-royal-blue.webp",
    kinds: ["image", "video"],
    dispatch: "studio",
    inputs: [
      IMG("Your photo"),
      TXT("Set colour", false, "e.g. royal blue, hot pink, neon green — default royal blue"),
    ],
    imagePrompt: `Wide full-body vertical 9:16 photograph of the subject performing on a seamless single-colour cyclorama studio set (royal blue unless another colour is specified), the floor and infinity wall the same saturated colour, two hard rim lights, bold fashion-forward pose with strong silhouette. ${IDENTITY} Photorealistic, 4K, COLORS-show performance aesthetic.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "The subject performs with confident energy — rhythmic body movement, sharp poses hitting on the beat, coloured light pulsing subtly on the cyclorama, slow cinematic orbit clockwise around the performer.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "orbit_cw",
  },
  {
    id: "colors-closeup",
    title: "Colors Close-Up",
    category: "Motion",
    blurb: "A tight, intense performance close-up drenched in one colour.",
    thumbnail: "/josh/generated2/colors-neon-green.webp",
    kinds: ["image", "video"],
    dispatch: "studio",
    inputs: [
      IMG("Your photo"),
      TXT("Set colour", false, "e.g. neon green, crimson, violet — default neon green"),
    ],
    imagePrompt: `Tight vertical 9:16 close-up portrait of the subject on a seamless single-colour studio set (neon green unless another colour is specified), the coloured backdrop filling the entire frame behind, face lit with a crisp key light and a coloured edge light, intense direct gaze, sweat-sheen skin texture. ${IDENTITY} Photorealistic, 4K, COLORS-show performance aesthetic.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "Intense close-up performance energy — the subject delivers to camera with sharp head movements and expressive eyes, coloured light breathing gently on the backdrop, slow confident push-in toward the face.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "push_in",
  },
  {
    id: "music-video-scene",
    title: "Music Video Scene",
    category: "Motion",
    blurb: "A gel-lit studio set piece straight out of a big-budget video.",
    thumbnail: stillStudioGel,
    thumbnailVideo: clipStudioGel,
    kinds: ["image", "video"],
    dispatch: "studio",
    inputs: [IMG("Your photo")],
    imagePrompt: `Cinematic vertical 9:16 music-video still of the subject on a professional studio set washed in saturated magenta and amber gel lighting, atmospheric haze catching the beams, strong backlight silhouette edge, high-budget production design. ${IDENTITY} Photorealistic, 4K.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "The subject performs with charismatic energy, gel lights sweeping slowly across the set, haze drifting through the beams, cinematic counter-clockwise orbit around the performer.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "orbit_ccw",
  },
  {
    id: "urban-cut",
    title: "Urban Cut",
    category: "Motion",
    blurb: "A punchy golden-hour street clip cut for the feed.",
    thumbnail: stillStreetGolden,
    thumbnailVideo: clipStreetGolden,
    kinds: ["image", "video"],
    dispatch: "studio",
    inputs: [IMG("Your photo")],
    imagePrompt: `Vertical 9:16 golden-hour street photograph of the subject mid-stride crossing an urban street, low sun flaring between buildings, long shadows on the asphalt, candid street-style editorial energy, shallow depth of field. ${IDENTITY} Photorealistic, 4K.`,
    imageModel: TEMPLATE_DEFAULTS.imageModel,
    videoPrompt:
      "Fast confident push-in toward the subject as they walk, sun flare pulsing between buildings, coat and hair moving with the stride, punchy music-video pacing.",
    videoModel: TEMPLATE_DEFAULTS.videoModel,
    cameraMovement: "push_in",
  },

  // ───────────── UGC/Ad ─────────────
  {
    id: "grwm-reel",
    title: "Get Ready With Me",
    category: "UGC/Ad",
    blurb: "Your selfie + your routine → a native GRWM talking reel.",
    thumbnail: stillCafeSelfie,
    kinds: ["ugc_ad"],
    dispatch: "ugc",
    ugcAspect: "9:16",
    durationSeconds: 10,
    inputs: [
      IMG("Your photo / selfie", "A clear front-facing photo — natural light works best"),
      TXT(
        "What's the occasion + one hook line?",
        true,
        "e.g. getting ready for a first date — I almost cancelled, but this look changed my mind",
      ),
    ],
  },
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
  // CutLab presets: each deep-links into the CapCut-style /edit editor with a
  // real AutoCut style pre-selected. Same backend, same COST_AUTOCUT charge.
  {
    id: "autocut-hype",
    title: "AutoCut — Hype",
    category: "Editing",
    blurb: "Fast beat-synced cuts, high energy — drop clips, get a hype 9:16 short.",
    thumbnail: stillCourtBall,
    thumbnailVideo: clipCourtBall,
    kinds: ["autocut"],
    dispatch: "autocut",
    autocutStyle: "hype",
    inputs: [],
  },
  {
    id: "autocut-cinematic",
    title: "AutoCut — Cinematic",
    category: "Editing",
    blurb: "Slow crossfades and epic pacing — your clips cut like a short film.",
    thumbnail: stillRooftopSunset,
    thumbnailVideo: clipRooftopSunset,
    kinds: ["autocut"],
    dispatch: "autocut",
    autocutStyle: "cinematic",
    inputs: [],
  },
  {
    id: "autocut-talking-head",
    title: "AutoCut — Talking Head",
    category: "Editing",
    blurb: "Speaker-led edit with B-roll mixing — perfect for vlogs and explainers.",
    thumbnail: ugcHomeSelfie.url,
    kinds: ["autocut"],
    dispatch: "autocut",
    autocutStyle: "talking_head",
    inputs: [],
  },
  {
    id: "autocut-tiktok-hook",
    title: "AutoCut — TikTok Hook",
    category: "Editing",
    blurb: "A 3-second opener then a story arc — cut for the FYP scroll.",
    thumbnail: "/josh/generated2/viral-11-captioned-hook.webp",
    kinds: ["autocut"],
    dispatch: "autocut",
    autocutStyle: "tiktok_hook",
    inputs: [],
  },
];

/**
 * Landing "Viral Presets" tag → manifest template id. The single source of
 * truth for the ViralPresetsSection tag cloud: every advertised name MUST
 * resolve to a runnable template here (enforced by template-studio.test.ts),
 * so the landing page can never advertise a preset that doesn't exist.
 */
export const VIRAL_PRESET_TAGS: ReadonlyArray<{ tag: string; templateId: string }> = [
  { tag: "Concert Lip-sync", templateId: "concert-lipsync" },
  { tag: "Music Video Mini", templateId: "music-video-mini" },
  { tag: "Cinematic Selfie Reel", templateId: "cinematic-reel" },
  { tag: "Golden Hour Orbit", templateId: "rooftop-golden" },
  { tag: "Neon Night Move", templateId: "neon-night-move" },
  { tag: "UGC Talking Ad", templateId: "ugc-talking-ad" },
  { tag: "Product Lifestyle Ad", templateId: "product-lifestyle" },
  { tag: "App Hero", templateId: "app-hero" },
  { tag: "Product Promo", templateId: "product-promo-video" },
  { tag: "Creator Walk & Talk", templateId: "ugc-creator-walk" },
  { tag: "Virtual Try-On", templateId: "fashion-tryon" },
  { tag: "Beat-Drop Reel", templateId: "beat-reel" },
  { tag: "Viral Spin", templateId: "viral-spin" },
  { tag: "Trend Remix", templateId: "trend-remix-spin" },
  { tag: "Storybook Character", templateId: "kids-storybook" },
  { tag: "Bedtime Reel", templateId: "kids-bedtime" },
  { tag: "Looping Officers", templateId: "looping-officers" },
  { tag: "AutoCut Hype", templateId: "autocut-hype" },
  { tag: "AutoCut Cinematic", templateId: "autocut-cinematic" },
  { tag: "Talking Head", templateId: "autocut-talking-head" },
  { tag: "TikTok Hook", templateId: "autocut-tiktok-hook" },
  { tag: "Editorial Cover", templateId: "editorial-cover" },
  { tag: "Neon Street", templateId: "neon-street" },
  { tag: "Rooftop Golden", templateId: "rooftop-golden-hour" },
  { tag: "Urban Alley", templateId: "urban-alley" },
  { tag: "Urban Subway", templateId: "urban-subway" },
  { tag: "Colors Wide", templateId: "colors-wide" },
  { tag: "Colors Close-Up", templateId: "colors-closeup" },
  { tag: "Music Video Scene", templateId: "music-video-scene" },
  { tag: "Urban Cut", templateId: "urban-cut" },
  { tag: "Get Ready With Me", templateId: "grwm-reel" },
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
