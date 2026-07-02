// Spin viral-engine: turns ONE prompt into N genuinely-varied post specs.
//
// This module is PURE and client-safe (no server-only imports) so the /spin
// route can import the types + count, and the server function can import the
// prompt/schema/generators. The LLM is asked to fill SpinPlanSchema; if it is
// unavailable the deterministic buildFallbackSpecs() still produces N unique
// looks by rotating curated variation axes — so the feature never regresses to
// near-identical outputs even with zero API keys.

import { z } from "zod";

// Kept at 30 for credit parity (1 Aura per piece, charged upfront). The engine
// is count-driven so this can grow later without code changes.
export const SPIN_COUNT = 30;
// 1 Aura per spin piece — the single client-safe source for the per-piece
// charge. spin.functions.ts (server) and every cost label import THIS constant
// so the disclosed price can never drift from what is actually charged.
export const SPIN_PIECE_COST = 1;

// ─── Variation axes ───────────────────────────────────────────────────────────
// Location(10) × Outfit(9) are coprime, so (location,outfit) pairs are unique
// for every i < 90 — guaranteeing all SPIN_COUNT fallback specs differ.

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
];

export const SPIN_CAMERAS = [
  "handheld selfie angle",
  "tripod eye-level shot",
  "cinematic low angle",
  "first-person POV angle",
  "mirror-selfie framing",
  "elevated overhead angle",
];

export const SPIN_LIGHTING = [
  "soft natural daylight",
  "warm golden-hour glow",
  "moody neon accents",
  "high-key studio lighting",
  "dramatic low-key shadows",
  "cool overcast light",
  "punchy on-camera flash",
];

export const SPIN_MOODS = [
  "confident",
  "playful",
  "chill and relaxed",
  "high-energy",
  "warm and approachable",
  "mysterious",
  "joyful",
  "focused and determined",
];

export const SPIN_FRAMING = [
  "tight close-up",
  "mid-shot from the waist up",
  "full-body shot",
  "over-the-shoulder framing",
  "wide environmental shot",
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
  scene: z.string().describe("A vivid one-line visual description of the shot."),
  outfit: z.string().describe("What the creator is wearing."),
  location: z.string().describe("Where the shot takes place."),
  camera: z.string().describe("Camera angle / shot type."),
  lighting: z.string().describe("Lighting style."),
  mood: z.string().describe("Emotional mood."),
  framing: z.string().describe("Close-up, mid-shot, or full-body."),
  caption: z.string().describe("The post caption idea."),
  motion: z.string().describe("Suggested motion if animated later."),
});
export type SpinSpec = z.infer<typeof SpinSpecSchema>;

export const SpinPlanSchema = z.object({
  posts: z.array(SpinSpecSchema),
});

// ─── System prompt (the viral content generation engine) ──────────────────────

export const VIRAL_SYSTEM_PROMPT = `You are a viral content generation engine for TikTok, Reels, and Shorts.

Your task is to turn ONE idea into a FULL content campaign of unique posts, all featuring the SAME creator.

STRICT RULES:

1. SAME PERSON CONSISTENCY
- Every post features the exact same creator: same face, identity, race, and facial structure. Never change the person.
- Do NOT describe the face or change identity — the creator's face is locked by a reference image at render time. Vary everything AROUND the person.

2. MAXIMUM VARIATION (MANDATORY)
Every post MUST differ from all others across:
- Location (indoor, outdoor, gym, car, street, luxury, beach, café, studio, poolside, etc.)
- Outfit (casual, gymwear, streetwear, luxury, cozy, athleisure, etc.)
- Camera angle (selfie, tripod, cinematic, POV, mirror, overhead)
- Lighting (natural, golden hour, neon, studio, low-key, flash)
- Mood (confident, playful, chill, high-energy, mysterious, joyful)
- Framing (close-up, mid-shot, full-body)

3. CONTENT TYPE MIX
Distribute posts across: Talking-head hooks, Lip-sync clips, Carousel covers, Story-style posts, Caption hook visuals, Meme edits, Behind-the-scenes, POV scenarios.

4. VIRAL STRUCTURE
Each post includes: a hook (first 1-2 seconds), a vivid scene/visual description, a caption idea, and a suggested motion.

5. NO REPETITION
Never reuse the same scene, outfit, or composition twice. Every post must feel like a DIFFERENT post optimized for the For You page.

6. QUALITY
Top 1% influencer content. Concise, punchy, native to short-form video.

Return the result as JSON matching the provided schema: an object with a "posts" array.`;

// ─── Generators ────────────────────────────────────────────────────────────────

function pick<T>(arr: T[], i: number): T {
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
export function buildFallbackSpecs(base: string, count = SPIN_COUNT): SpinSpec[] {
  const b = base.trim() || "my content";
  const specs: SpinSpec[] = [];
  for (let i = 0; i < count; i++) {
    const location = pick(SPIN_LOCATIONS, i);
    const outfit = pick(SPIN_OUTFITS, i);
    const camera = pick(SPIN_CAMERAS, i);
    const lighting = pick(SPIN_LIGHTING, i);
    const mood = pick(SPIN_MOODS, i);
    const framing = pick(SPIN_FRAMING, i);
    const contentType = pick(SPIN_CONTENT_TYPES, i);
    const hook = pick(HOOK_TEMPLATES, i)(b);
    const caption = pick(CAPTION_TEMPLATES, i)(b);
    const motion = pick(MOTION_TEMPLATES, i);
    specs.push({
      contentType,
      hook,
      scene: `${cap(b)} — ${framing} at ${location}, ${mood} energy`,
      outfit,
      location,
      camera,
      lighting,
      mood,
      framing,
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
export function normalizeSpecs(raw: Partial<SpinSpec>[], base: string, count = SPIN_COUNT): SpinSpec[] {
  const fallback = buildFallbackSpecs(base, count);
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
      caption: (r.caption || f.caption).trim(),
      motion: (r.motion || f.motion).trim(),
    });
  }
  return out;
}

/** Compose the actual image-render prompt for one spec (identity comes from the face reference). */
export function buildVariantPrompt(
  spec: SpinSpec,
  opts: { base?: string; triggerWord?: string | null; avatarName?: string | null; aspect?: string } = {},
): string {
  const aspect = opts.aspect ?? "9:16";
  const segs = [
    opts.base?.trim() || spec.scene,
    opts.avatarName ? `featuring AI creator "${opts.avatarName}"` : null,
    `wearing ${spec.outfit}`,
    `at ${spec.location}`,
    `${spec.mood} mood`,
    spec.lighting,
    spec.camera,
    spec.framing,
    opts.triggerWord ? opts.triggerWord : null,
    "hyper-realistic UGC iPhone-style photo, photoreal skin texture, native social-media aesthetic, no on-screen text, no logos",
    `[${aspect} aspect ratio]`,
  ].filter(Boolean);
  return segs.join(", ");
}

/** Short tile label for the grid. */
export function specLabel(spec: SpinSpec): string {
  return spec.contentType;
}
