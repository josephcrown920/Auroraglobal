// Spin viral-engine: turns ONE prompt into N genuinely-varied post specs.
//
// This module is PURE and client-safe (no server-only imports) so the /spin
// route can import the types + count, and the server function can import the
// prompt/schema/generators. The LLM is asked to fill SpinPlanSchema; if it is
// unavailable the deterministic buildFallbackSpecs() still produces N unique
// looks by rotating curated variation axes — so the feature never regresses to
// near-identical outputs even with zero API keys.

import { z } from "zod";
import { PRICING, VIDEO_TIER_AURA, LIPSYNC_TIER_AURA } from "./pricing";
// Template card illustrations — AI-generated images served from /public/josh/
const creatorsTemplateImg      = "/josh/generated2/viral-03-cover-reveal.webp";
const rapperTemplateImg        = "/josh/generated2/viral-10-performance.webp";
const productShowcaseTemplateImg = "/josh/generated2/viral-12-single-cover.webp";
const fitnessTemplateImg       = "/josh/generated2/viral-09-vertical-poster.webp";
const fashionTemplateImg       = "/josh/generated2/colors-royal-blue.webp";
const beautyTemplateImg        = "/josh/generated2/colors-sunset-orange.webp";

// Kept at 30 for credit parity (1 Aura per piece, charged upfront). The engine
// is count-driven so this can grow later without code changes.
export const SPIN_COUNT = 30;
// 1 Aura per spin piece — the single client-safe source for the per-piece
// charge. spin.functions.ts (server) and every cost label import THIS constant
// so the disclosed price can never drift from what is actually charged.
export const SPIN_PIECE_COST = 1;

// ─── Video mode (Product Showcase only) ──────────────────────────────────────
// A person uploads a product photo + a short script and gets SPIN_COUNT
// TALKING videos instead of stills: each one is the avatar holding the SAME
// product in a different outfit/location/angle, speaking the SAME script.
// This is a real multi-stage render per piece (styled still → image-to-video
// → lip-sync), so it is priced through the SAME stacked engine every other
// video/lipsync feature uses (src/lib/pricing.ts) — never a made-up number —
// at the PREMIUM tier on purpose: this is the flagship, most expensive thing
// Spin can produce, and the price must reflect that.
export type SpinMode = "photo" | "video";
export const SPIN_VIDEO_DURATION_SECONDS = 15;
// Forced models (not left to orchestrator default) so the price we quote is
// the price we actually pay the provider for — both sit in the "premium" tier
// (see VIDEO_MODEL_TIERS / LIPSYNC_MODEL_TIERS in pricing.ts).
export const SPIN_VIDEO_MODEL = "wan-2.5";
export const SPIN_VIDEO_LIPSYNC_MODEL = "fal-ai/sync-lipsync/v2";

// Mirrors computeCost()'s formula (image base-only + video/lipsync scaled by
// length, 720p reference) but tiers video and lip-sync INDEPENDENTLY at
// "premium" — computeCost() only accepts a single `model` string to tier
// both features at once, which can't correctly resolve two distinct model
// namespaces (video models vs. lip-sync models never share a name), so the
// arithmetic is inlined here instead, pulling every number straight from the
// canonical pricing.ts tables so it can never drift from them.
const spinVideoLengthFactor = SPIN_VIDEO_DURATION_SECONDS / PRICING.referenceSeconds;
export const SPIN_VIDEO_PIECE_COST = Math.max(
  1,
  Math.ceil(PRICING.base.image + VIDEO_TIER_AURA.premium * spinVideoLengthFactor + LIPSYNC_TIER_AURA.premium * spinVideoLengthFactor),
);

// ─── Variation axes ───────────────────────────────────────────────────────────
// Location(10) × Outfit(11) are coprime → LCM = 110, so every (location,outfit)
// pair is unique for all i < 110, guaranteeing all SPIN_COUNT fallback specs
// differ across both axes simultaneously.

export const SPIN_LOCATIONS = [
  "a sunlit city rooftop",
  "a neon-lit downtown street at night",
  "a minimalist luxury apartment",
  "a bright modern gym",
  "the driver's seat of a parked car",
  "a sandy beach at sunset",
  "a cozy aesthetic café",
  "a clean photo studio with a seamless backdrop",
  "a leafy park path",
  "a rooftop infinity pool",
];

export const SPIN_OUTFITS = [
  "a casual oversized tee and jeans",
  "sleek matching gymwear",
  "an elevated streetwear fit",
  "a tailored luxury outfit",
  "a cozy oversized knit",
  "a sporty athleisure set",
  "a chic monochrome look",
  "a relaxed linen summer outfit",
  "a bold statement jacket",
  "a fitted crop top and high-waist trousers",
  "a classic white button-down and tailored shorts",
];

export const SPIN_CAMERAS = [
  "handheld selfie angle, 9:16 vertical",
  "tripod eye-level shot, 9:16 vertical",
  "cinematic low angle looking up, 9:16 vertical",
  "first-person POV angle, 9:16 vertical",
  "mirror-selfie framing, 9:16 vertical",
  "elevated overhead angle, 9:16 vertical",
  "tight over-the-shoulder, 9:16 vertical",
  "drone-style wide environmental, 9:16 vertical",
];

export const SPIN_LIGHTING = [
  "soft natural daylight, golden hour glow, cinematic depth of field",
  "warm golden-hour backlight, lens flare, shallow DOF",
  "moody neon accent lights, cyberpunk palette, atmospheric haze",
  "high-key studio softbox, beauty-dish fill, sharp detail",
  "dramatic low-key shadows, single hard key light, noir contrast",
  "cool overcast diffused light, even skin tones, editorial look",
  "punchy on-camera flash, high-contrast street style",
  "sunset rim light from behind, silhouette edge separation, cinematic grade",
];

export const SPIN_MOODS = [
  "confident and powerful",
  "playful and fun",
  "chill and relaxed",
  "high-energy and hyped",
  "warm and approachable",
  "mysterious and alluring",
  "joyful and radiant",
  "focused and determined",
];

export const SPIN_FRAMING = [
  "tight close-up",
  "mid-shot from the waist up",
  "full-body shot",
  "over-the-shoulder framing",
  "wide environmental shot",
];

// Ordinary, everyday candid poses — the DEFAULT body language for every post.
// Deliberately contains NO performer/microphone/fist gestures: the reference
// photo is of a regular person, not an artist, unless the content type below
// specifically calls for a performance beat. This is what actually prevents
// "same pose repeated 30x" — the topic idea's literal wording (e.g. "gripping
// a mic, fist pointed at camera") never reaches the render prompt as body
// language, only this rotating, decoupled pose bank does.
export const SPIN_CANDID_POSES = [
  "walking naturally mid-stride, relaxed arms",
  "laughing candidly, head tilted slightly",
  "adjusting hair with one hand, looking off-camera",
  "looking back over one shoulder with a soft smile",
  "hands in pockets, casual relaxed stance",
  "sipping a drink, eyes on the camera",
  "leaning against a wall, one leg crossed",
  "checking phone, half-smile",
  "stretching arms overhead, playful energy",
  "sitting casually, chin resting on hand",
  "twirling hair, candid glance to the side",
  "hands gently framing face, soft gaze",
];

// Only used for the "Lip-sync clip" content type (a small minority of the 30
// posts) — a mic-in-hand performance beat is only appropriate there, never as
// the default look for every post.
export const SPIN_PERFORMANCE_POSES = [
  "holding a mic close to lips mid-lyric, eyes closed",
  "singing into a mic with one hand raised, energetic stance",
  "mic in hand, confident performance stance, mid-verse expression",
];

// Hip-hop / rapper aesthetic pose bank — used ONLY when the "rapper" template
// is explicitly selected. Unlike the default candid pool, mic/fist/chain
// gestures are the intended look here (the user picked this template for
// exactly that vibe), but they still rotate across 12 distinct poses so the
// batch doesn't collapse into one repeated pose.
export const SPIN_RAPPER_POSES = [
  "mic gripped close to mouth mid-verse, eyes intense",
  "fist raised toward camera, confident stance",
  "arms crossed, chain visible, cool stare",
  "leaning back against a car, hand on chain",
  "one hand up mid-bar, mouth open mid-rhyme",
  "walking toward camera, hands in jacket pockets",
  "pointing at camera, one eyebrow raised",
  "adjusting a cap, sideways glance",
  "both hands out, palms up mid-hook",
  "sitting on a ledge, elbows on knees, moody stare",
  "hand on chin, thoughtful pause between verses",
  "shoulders squared, direct eye contact with camera",
];

// Product-showcase pose bank — used ONLY when the "product_showcase" template
// is selected. Every pose keeps the product visibly in hand/frame — that is
// the entire point of the template (holding the SAME product from the
// reference photo across 30 different outfits/locations/angles) — while still
// rotating the actual gesture so it isn't the same held-up-to-camera shot 30x.
export const SPIN_PRODUCT_POSES = [
  "holding the product up toward camera at eye level, warm smile",
  "cradling the product in both hands, looking down at it admiringly",
  "presenting the product toward camera with one open palm",
  "casually holding the product at hip height while looking off-camera",
  "unboxing gesture, product half-raised, excited expression",
  "resting the product on one shoulder, playful pose",
  "pointing at the product with the other hand, explainer energy",
  "holding the product close to face, mirror-selfie style",
  "walking while holding the product naturally at side",
  "sitting, product held in lap with both hands",
  "one hand raising the product toward the light, admiring gaze",
  "close-up hand detail cradling the product, product in sharp focus",
];

export const SPIN_CONTENT_TYPES = [
  "Talking-head hook",
  "Lip-sync clip",
  "Carousel cover",
  "Story-style post",
  "Caption hook visual",
  "Meme edit",
  "Behind-the-scenes",
  "POV scenario",
];

const HOOK_TEMPLATES = [
  (b: string) => `POV: ${b}`,
  (b: string) => `Wait for it… ${b}`,
  (b: string) => `Nobody talks about ${b}`,
  (b: string) => `3 things about ${b}`,
  (b: string) => `How I ${b}`,
  (b: string) => `The truth about ${b}`,
  (b: string) => `Day in my life: ${b}`,
  (b: string) => `Stop scrolling — ${b}`,
];

const CAPTION_TEMPLATES = [
  (b: string) => `${b} ✨ #fyp #viral`,
  (b: string) => `saving this one 📌 ${b}`,
  (b: string) => `which look wins? 👀 ${b}`,
  (b: string) => `${b} — drop a 🔥 if you'd post it`,
  (b: string) => `same me, new vibe 💫 ${b}`,
  (b: string) => `made in seconds with Aurora ⚡ ${b}`,
];

// ─── Templates ────────────────────────────────────────────────────────────────
// Most people don't know how to write a good prompt. A template pre-selects
// the whole vibe (topic seed + outfit/location pools + which pose bank is
// used) so a user can just drop a reference photo and tap ONE card — no
// typing required — and still get a genuinely-varied, on-aesthetic batch.
// "default" is the plain, aesthetic-agnostic regular-person behavior that
// existed before templates; every other template swaps in its own pools.

export type SpinTemplateId = "default" | "rapper" | "product_showcase" | "fitness_creator" | "fashion_lookbook" | "beauty_glam";

export interface SpinTemplate {
  id: SpinTemplateId;
  label: string;
  emoji: string;
  blurb: string;
  /** Prefills the prompt box when the user hasn't typed their own idea. */
  topicSeed: string;
  /** True if this template requires the reference photo to already show a
   * held object (a product) that must stay in-frame across every post. */
  requiresHeldObject?: boolean;
  /** Illustration image shown on the template picker card. Bundled asset path
   * (resolved to a URL by Vite) — kept optional so a template can ship without
   * one and just show the emoji. */
  image?: string;
}

export const SPIN_TEMPLATES: SpinTemplate[] = [
  {
    id: "default",
    label: "Creators",
    emoji: "✨",
    blurb: "Everyday candid content — any topic, ordinary poses.",
    topicSeed: "day in my life",
    image: creatorsTemplateImg,
  },
  {
    id: "rapper",
    label: "Rapper / Hip-Hop Artist",
    emoji: "🎤",
    blurb: "Trap & hip-hop aesthetic — mic, chains, street style, moody lighting.",
    topicSeed: "rapper flexing my new single",
    image: rapperTemplateImg,
  },
  {
    id: "product_showcase",
    label: "Product Showcase",
    emoji: "🛍️",
    blurb: "Holding YOUR product across 30 different outfits, locations & angles — great for ads.",
    topicSeed: "showing off this product",
    requiresHeldObject: true,
    image: productShowcaseTemplateImg,
  },
  {
    id: "fitness_creator",
    label: "Fitness Creator",
    emoji: "💪",
    blurb: "Gym, activewear, high-energy candid fitness content.",
    topicSeed: "fitness creator gym day",
    image: fitnessTemplateImg,
  },
  {
    id: "fashion_lookbook",
    label: "Fashion Lookbook",
    emoji: "👗",
    blurb: "OOTD-style outfit changes across varied backdrops.",
    topicSeed: "outfit of the day lookbook",
    image: fashionTemplateImg,
  },
  {
    id: "beauty_glam",
    label: "Beauty / Glam",
    emoji: "💋",
    blurb: "Mirror selfies, vanity shots, glam beauty-influencer energy.",
    topicSeed: "glam get-ready-with-me",
    image: beautyTemplateImg,
  },
];

// Per-template outfit/location pools. Falls back to the neutral SPIN_OUTFITS /
// SPIN_LOCATIONS pools for any template that doesn't need its own aesthetic
// (kept the SAME LENGTH as the base pools so pick()'s coprime-index math still
// guarantees unique (location, outfit) pairs across a 30-post batch).

const SPIN_RAPPER_OUTFITS = [
  "an oversized streetwear hoodie",
  "a designer tracksuit",
  "a leather jacket with chains",
  "a fitted cap and baggy jeans",
  "a bomber jacket streetwear fit",
  "a graphic tee with gold chains",
  "a denim jacket with fresh sneakers",
  "an all-black stealth fit",
  "a varsity jacket",
  "a puffer vest streetwear look",
  "a silk bomber with tailored joggers",
];

const SPIN_RAPPER_LOCATIONS = [
  "a neon-lit alley at night",
  "a rooftop at night with city lights",
  "a recording studio booth",
  "the interior of a luxury car",
  "a graffiti wall backdrop",
  "a city street at dusk",
  "a penthouse balcony at night",
  "an underground parking garage",
  "a nightclub VIP area",
  "an urban basketball court",
];

const SPIN_PRODUCT_LOCATIONS = [
  "a bright modern kitchen counter",
  "a cozy living room",
  "a sunlit city street",
  "a clean photo studio with a seamless backdrop",
  "a minimalist luxury apartment",
  "an outdoor café table",
  "a car interior",
  "a bathroom vanity mirror",
  "a rooftop terrace",
  "a bright storefront window",
];

const TEMPLATE_OUTFIT_POOLS: Record<SpinTemplateId, readonly string[]> = {
  default: SPIN_OUTFITS,
  rapper: SPIN_RAPPER_OUTFITS,
  product_showcase: SPIN_OUTFITS,
  fitness_creator: SPIN_OUTFITS,
  fashion_lookbook: SPIN_OUTFITS,
  beauty_glam: SPIN_OUTFITS,
};

const TEMPLATE_LOCATION_POOLS: Record<SpinTemplateId, readonly string[]> = {
  default: SPIN_LOCATIONS,
  rapper: SPIN_RAPPER_LOCATIONS,
  product_showcase: SPIN_PRODUCT_LOCATIONS,
  fitness_creator: SPIN_LOCATIONS,
  fashion_lookbook: SPIN_LOCATIONS,
  beauty_glam: SPIN_LOCATIONS,
};

/** Which pose bank a template draws from. "lipsync_exception" mirrors the
 * pre-template default behavior: candid poses for everything except a couple
 * of Lip-sync-clip posts, which may borrow a mic pose. */
const TEMPLATE_POSE_MODE: Record<SpinTemplateId, "candid_default" | "rapper" | "product"> = {
  default: "candid_default",
  rapper: "rapper",
  product_showcase: "product",
  fitness_creator: "candid_default",
  fashion_lookbook: "candid_default",
  beauty_glam: "candid_default",
};

const MOTION_TEMPLATES = [
  "slow push-in with a subtle hair flip",
  "quick zoom-punch on the hook line",
  "handheld sway, natural micro-movements",
  "smooth pan across the scene",
  "snap cut to the outfit reveal",
  "gentle parallax with lifelike blinking",
];

// ─── Schema ──────────────────────────────────────────────────────────────────

export const SpinSpecSchema = z.object({
  contentType: z.string().describe("One content format, e.g. Talking-head hook, Lip-sync clip, Carousel cover, POV scenario, Meme edit, Behind-the-scenes."),
  hook: z.string().describe("The scroll-stopping first 1-2 seconds line."),
  scene: z.string().describe("A vivid one-line visual description of the shot's SETTING/ACTION only — never a body pose or hand gesture."),
  outfit: z.string().describe("What the creator is wearing."),
  location: z.string().describe("Where the shot takes place."),
  camera: z.string().describe("Camera angle / shot type."),
  lighting: z.string().describe("Lighting style."),
  mood: z.string().describe("Emotional mood."),
  framing: z.string().describe("Close-up, mid-shot, or full-body."),
  pose: z
    .string()
    .describe(
      "A specific candid body pose/gesture for THIS post (e.g. walking, laughing, adjusting hair, hands in pockets). Must be an ordinary everyday pose — NOT a microphone/performer/fist-pointing pose — unless contentType is exactly 'Lip-sync clip', which is the only content type allowed a performance pose. No two posts in the batch may share the same pose.",
    ),
  caption: z.string().describe("The post caption idea."),
  motion: z.string().describe("Suggested motion if animated later."),
});
export type SpinSpec = z.infer<typeof SpinSpecSchema>;

export const SpinPlanSchema = z.object({
  posts: z.array(SpinSpecSchema),
});

// ─── System prompt (the viral content generation engine) ──────────────────────

export const VIRAL_SYSTEM_PROMPT = `You are a viral content generation engine for TikTok, Reels, and Shorts.

Your task is to generate a FULL content campaign from ONE idea. Every photo and video must combine: hyperrealism, photorealism, skin treatment, golden hour lighting, cinematic look, depth of field — every shot ultra HD.

GOAL: turn ONE idea into a FULL WEEK+ viral content pipeline.

STEP 1 — BUILD A VARIATION MATRIX FIRST (before generating any posts):
Before producing any output, silently construct this matrix of unique values:
- Locations: 10 unique (indoor, outdoor, gym, car, street, luxury, beach, studio, poolside, etc.)
- Outfits: 10 unique (casual, gymwear, streetwear, luxury, nightwear, athleisure, etc.)
- Lighting styles: 8 unique (natural, golden hour, neon, dark/low-key, studio, flash, sunset rim, overcast)
- Camera styles: 8 unique (selfie, tripod, cinematic, POV, mirror, overhead, drone, over-shoulder)
- Moods: 8 unique (confident, playful, chill, high-energy, mysterious, joyful, seductive, focused)
- Poses: 10+ unique ORDINARY candid poses (walking, laughing, adjusting hair, hands in pockets, sipping a drink, looking over shoulder, stretching, sitting, checking phone, twirling hair) — no microphones, no fist gestures, no performer stances, except a maximum of 2-3 mic-in-hand poses reserved strictly for "Lip-sync clip" posts.

Then RANDOMLY combine them so each post uses a different combination. No two posts share the same (location + outfit) pair, and no two posts share the same pose.

STEP 2 — STRICT RULES:

1. SAME PERSON CONSISTENCY
- Every post features the exact same creator: same face, identity, race, and facial structure. Never change the person.
- Do NOT describe the face or alter identity — the face is locked by a reference image at render time. Vary everything AROUND the person.

2. MAXIMUM VARIATION (MANDATORY)
Each post MUST differ across: location, outfit, camera angle, lighting, mood, framing, AND pose. No repetition allowed.
- The "scene" field is a short ACTION/SETTING description only — never restate a specific body pose, hand position, or camera crop from the topic idea. Framing and camera angle are controlled ENTIRELY by the "camera" and "framing" fields, and must vary post-to-post (mix close-ups, mid-shots, full-body, over-the-shoulder, wide shots) even when the topic idea itself implies one specific pose.
- The "pose" field is a SEPARATE field and is the ONLY place a body pose/gesture may appear. IGNORE any hand position, prop, or gesture described in the topic idea — it is context/mood only, never a literal pose instruction. Default every post to an ORDINARY, EVERYDAY candid pose (walking, laughing, adjusting hair, hands in pockets, sipping a drink, looking over a shoulder, stretching, sitting, checking phone, twirling hair). The creator is a regular person, NOT a musician/rapper/performer, unless contentType is exactly "Lip-sync clip" — that is the only content type where a mic-in-hand performance pose belongs, and it may appear on at most 2-3 of the posts, never as the default look for the batch.

3. CONTENT TYPE MIX
Distribute posts across: Talking-head hooks, Lip-sync clips, Carousel covers, Story-style posts, Caption hook visuals, Meme edits, Behind-the-scenes, POV scenarios.

4. VIRAL STRUCTURE
Each post must include:
- Hook (first 1–2 seconds, scroll-stopping)
- Visual scene description (vivid, cinematic)
- Pose (an ordinary candid body pose/gesture, per rule 2 above)
- Caption idea
- Suggested motion (if video)

5. NO REPETITION
Never reuse the same scene, outfit, or composition. Every post must feel like a DIFFERENT post optimized for the For You page.

6. QUALITY LEVEL
Top 1% influencer content. Hyperrealistic, photorealistic, skin treatment, golden hour lighting, cinematic, depth of field. Optimized for TikTok For You Page.

Return the result as JSON matching the provided schema: an object with a "posts" array.`;

// ─── Generators ────────────────────────────────────────────────────────────────

function pick<T>(arr: readonly T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length];
}

function cap(s: string): string {
  const t = s.trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/**
 * Deterministically fan a base idea out into `count` unique post specs by
 * rotating the curated variation axes. Location×Outfit are coprime so no two
 * specs share the same (location, outfit) pair — guaranteeing uniqueness.
 */
export function buildFallbackSpecs(base: string, count = SPIN_COUNT, templateId: SpinTemplateId = "default"): SpinSpec[] {
  const b = base.trim() || "my content";
  const specs: SpinSpec[] = [];
  const outfitPool = TEMPLATE_OUTFIT_POOLS[templateId] ?? SPIN_OUTFITS;
  const locationPool = TEMPLATE_LOCATION_POOLS[templateId] ?? SPIN_LOCATIONS;
  const poseMode = TEMPLATE_POSE_MODE[templateId] ?? "candid_default";
  // At most 2 of the batch get a performance pose (reserved for "Lip-sync
  // clip" posts only, and only in the default candid template) — everything
  // else is an ordinary candid pose. This is fixed regardless of what the raw
  // topic text literally describes, so a topic like "gripping a mic, fist
  // pointed at camera" can never make every post in the batch a performer
  // shot UNLESS the "rapper" template was explicitly picked for that vibe.
  let performanceUsed = 0;
  for (let i = 0; i < count; i++) {
    const location = pick(locationPool, i);
    const outfit = pick(outfitPool, i);
    const camera = pick(SPIN_CAMERAS, i);
    const lighting = pick(SPIN_LIGHTING, i);
    const mood = pick(SPIN_MOODS, i);
    const framing = pick(SPIN_FRAMING, i);
    const contentType = pick(SPIN_CONTENT_TYPES, i);
    const hook = pick(HOOK_TEMPLATES, i)(b);
    const caption = pick(CAPTION_TEMPLATES, i)(b);
    const motion = pick(MOTION_TEMPLATES, i);
    let pose: string;
    if (poseMode === "rapper") {
      pose = pick(SPIN_RAPPER_POSES, i);
    } else if (poseMode === "product") {
      pose = pick(SPIN_PRODUCT_POSES, i);
    } else {
      const isLipSync = contentType === "Lip-sync clip" && performanceUsed < 2;
      pose = isLipSync ? pick(SPIN_PERFORMANCE_POSES, performanceUsed) : pick(SPIN_CANDID_POSES, i);
      if (isLipSync) performanceUsed += 1;
    }
    // Scene stays purely a setting/action line — the raw topic idea is used
    // for the hook/caption text overlays only, NEVER as a literal pose here.
    specs.push({
      contentType,
      hook,
      scene: `${cap(contentType)} moment — ${framing} at ${location}, ${mood} energy`,
      outfit,
      location,
      camera,
      lighting,
      mood,
      framing,
      pose,
      caption,
      motion,
    });
  }
  return specs;
}

/**
 * Coerce raw LLM output into exactly `count` complete specs: trim overflow,
 * pad any shortfall from the deterministic fallback, and backfill blank fields
 * so downstream prompt-building never emits empty segments.
 */
export function normalizeSpecs(
  raw: Partial<SpinSpec>[],
  base: string,
  count = SPIN_COUNT,
  templateId: SpinTemplateId = "default",
): SpinSpec[] {
  const fallback = buildFallbackSpecs(base, count, templateId);
  const out: SpinSpec[] = [];
  for (let i = 0; i < count; i++) {
    const r = raw[i] ?? {};
    const f = fallback[i];
    out.push({
      contentType: (r.contentType || f.contentType).trim(),
      hook: (r.hook || f.hook).trim(),
      scene: (r.scene || f.scene).trim(),
      outfit: (r.outfit || f.outfit).trim(),
      location: (r.location || f.location).trim(),
      camera: (r.camera || f.camera).trim(),
      lighting: (r.lighting || f.lighting).trim(),
      mood: (r.mood || f.mood).trim(),
      framing: (r.framing || f.framing).trim(),
      pose: (r.pose || f.pose).trim(),
      caption: (r.caption || f.caption).trim(),
      motion: (r.motion || f.motion).trim(),
    });
  }
  return out;
}

/**
 * Compose the actual image-render prompt for one spec (identity comes from the
 * face reference). The per-post staging axes (outfit/location/camera/framing/
 * pose) are stated as hard requirements and repeated at the END of the prompt
 * too — a highly specific base idea (e.g. "right hand gripping mic, left hand
 * punching toward camera") otherwise reads as a literal pose instruction and
 * silently overrides framing/outfit/pose across every post in the batch,
 * collapsing a 30-post batch into 30 near-identical crops of one pose. The
 * dedicated `spec.pose` field (never derived from the raw topic text — see
 * buildFallbackSpecs) plus the closing override line are what actually make
 * that not happen, batch after batch, regardless of what the topic says.
 */
export function buildVariantPrompt(
  spec: SpinSpec,
  opts: {
    base?: string;
    triggerWord?: string | null;
    avatarName?: string | null;
    aspect?: string;
    templateId?: SpinTemplateId;
  } = {},
): string {
  const aspect = opts.aspect ?? "9:16";
  const templateId = opts.templateId ?? "default";
  const segs = [
    // Scene + identity anchor
    opts.avatarName
      ? `Same person as reference image — ${opts.avatarName}.`
      : "Same person as reference image.",
    // Optional creator hint / LoRA trigger — the topic/mood, NOT a literal pose to copy.
    // Explicitly disclaims any body pose/gesture/prop it describes: those are
    // handled ENTIRELY by spec.pose below, which is a regular-person pose,
    // never a performer stance, unless this post's contentType is Lip-sync clip.
    opts.base?.trim()
      ? `Content idea (topic/mood context ONLY — completely IGNORE any hand position, prop, gesture, or body pose it mentions; the actual pose for this shot is specified separately below): ${opts.base.trim()}.`
      : null,
    // Product Showcase template: the held product itself is part of the
    // identity lock, same as the face — it must persist across every post
    // even though outfit/location/pose all vary.
    templateId === "product_showcase"
      ? "CRITICAL: the reference image shows the creator holding a specific product. Keep that EXACT SAME product visibly in her hand/frame in this shot too — do not swap it for a different item, do not drop it, do not change its color or shape. Only the outfit, location, camera angle and pose around it should vary."
      : null,
    opts.triggerWord ? opts.triggerWord : null,
    // Per-spec variation axes — these are the mandatory staging for THIS post.
    `MANDATORY staging for this post — outfit: ${spec.outfit}. Location: ${spec.location}. Camera/framing: ${spec.camera}, ${spec.framing}. Lighting: ${spec.lighting}. Mood: ${spec.mood}. Pose: ${spec.pose}.`,
    `Scene action: ${spec.scene}.`,
    // Quality mandate
    "Ultra-realistic, cinematic, high detail, social media style, TikTok aesthetic.",
    "Hyperrealism, photorealism, skin treatment, golden hour lighting, cinematic, depth of field.",
    "DO NOT change face identity, race or facial structure.",
    `[${aspect} vertical aspect ratio, 9:16]`,
    // Closing override — repeated on purpose, closest to the end of the prompt
    // where image-edit models weight instructions most heavily.
    `The outfit, location, camera framing (${spec.framing}), lighting, and POSE (${spec.pose}) listed above are the ONLY staging and body language allowed for this exact shot and must differ from any other post in the same batch — reinterpret the content idea's topic through THIS staging and THIS pose rather than repeating any fixed gesture, hand position, or prop from the topic text.`,
  ].filter(Boolean);
  return segs.join(" ");
}

/** Short tile label for the grid. */
export function specLabel(spec: SpinSpec): string {
  return spec.contentType;
}

/**
 * Motion instruction for the image→video stage of a Video Mode piece
 * (Product Showcase only). The rendered still (from buildVariantPrompt,
 * already holding the same product) is animated into a short talking clip;
 * lip-sync is layered on top in a separate stage using the shared script
 * audio, so this prompt only needs to describe NATURAL body/camera motion —
 * mouth movement is handled entirely by the lip-sync stage, not here.
 */
export function buildVariantVideoMotionPrompt(
  spec: SpinSpec,
  opts: { avatarName?: string | null } = {},
): string {
  return [
    opts.avatarName ? `Same person as reference image — ${opts.avatarName}.` : "Same person as reference image.",
    "Animate this exact photo into a short, natural talking-to-camera video clip.",
    "CRITICAL: keep the exact same product visibly in hand/frame the entire clip — never let it drop, disappear, or change.",
    `Motion: ${spec.motion}, subtle natural breathing and blinking, gentle head movement, keep the ${spec.framing} framing and ${spec.camera} stable.`,
    "The person looks and speaks naturally toward the camera as if presenting the product to an audience.",
    "Do not change the outfit, location, lighting, or identity established in the photo.",
    "Ultra-realistic, cinematic, photorealistic, smooth natural motion, no warping or artifacts.",
    "[9:16 vertical aspect ratio]",
  ].join(" ");
}
