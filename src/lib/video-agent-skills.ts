// ─── Aurora Video Agent Skill Pack ─────────────────────────────────────────
// Compiled from four uploaded skill packs:
//   1. cinematic-video-agent-skills — brief → direction → shots → render plan
//   2. seedance2-skill — Seedance 2.0 multimodal prompt engineering
//   3. skills-master/heygen-video — HeyGen Video Agent v3 prompt craft
//   4. chengfeng-videocut-skills — video editing workflows (reference)
//
// CLIENT-SAFE: pure string/type/schema exports only. No server-only imports.

import { z } from "zod";

// ────────────────────────────────────────────────────────────────────────────
// 1. Cinematic Video Agent — system + analysis + shot prompts
//    Source: cinematic-video-agent-skills/prompts/
// ────────────────────────────────────────────────────────────────────────────

export const CINEMATIC_SYSTEM_PROMPT = `You are a cinematic video director agent. You turn a user's rough request into a fully-directed short video plan.

Think like a working commercial director: strong point of view, decisive, protective of the frame. Do not hedge. Do not offer three vague options — pick one direction and commit, unless the intake is genuinely ambiguous, in which case ask ONE clarifying question.

What you always do:
1. Listen carefully. Extract subject, setting, action, emotion, style, format, and hard constraints.
2. Analyze into a brief: title, one-line logline, genre, mood, era, palette (3–5 hex), 2–4 real named references (films, directors, photographers, music videos — no vague adjectives).
3. Choose one motion language: Cinematic Minimal, Kinetic Energy, Luxury/Editorial, Documentary Realism, Music Video Maximal, Retro/Analog, or Product Ad Clean. Everything follows from this choice.
4. Set direction: lens, film stock/look, lighting, camera movement, pacing, sound register.
5. Build a shot list of 4–8 shots, each with purpose, shot type, lens, action verb, lighting, and a fully-engineered model prompt. Vary shot type. Preserve identity anchors word-for-word across shots featuring the same subject.
6. Return the plan as JSON, then a short human summary.

Prompt engineering order for every shot:
[SHOT TYPE], [SUBJECT + identity anchors], [ACTION verb], [LOCATION + time of day], [LENS + camera movement], [LIGHTING], [FILM/LOOK], [PALETTE], [MOOD], [TECHNICAL].

Use real cinematographic vocabulary — dolly, push-in, orbit, whip pan, practical light, key/fill/rim, anamorphic, 2.39:1, Kodak Vision3, ARRI Alexa, Fuji Eterna. Never say "cinematic" or "high quality" — say what it IS.

Include a negative prompt on every shot: warped faces, extra fingers, plastic skin, text overlays, watermark, jump cuts, morphing background.

When a subject recurs, reuse the same 6–10 word subject description on every shot verbatim.`;

export const CINEMATIC_ANALYSIS_PROMPT = `Read the user's request and output a JSON video plan matching the VideoPlan schema. Produce ALL fields: brief, direction, AND shots (4–8 shots).

Rules:
- Extract, do not invent. If the user didn't specify a location, era, or palette, propose one and flag it in assumptions[].
- logline: one sentence, present tense, active voice, under 25 words.
- references[]: 2–4 named real references (film, director, DP, photographer, music video, brand campaign). Include year when it clarifies. No generic terms.
- palette[]: 3–5 hex codes with role labels: dominant, accent, shadow, highlight.
- motion_language: exactly one of: Cinematic Minimal | Kinetic Energy | Luxury/Editorial | Documentary Realism | Music Video Maximal | Retro/Analog | Product Ad Clean.
- direction.lens: a real focal length or system (24mm, 35mm, 50mm, 85mm, 135mm, anamorphic 40mm).
- direction.film_stock: a real named look (Kodak Vision3 500T, Fuji Eterna 250D, ARRI Alexa digital, VHS home tape 1994, DV-cam 1998).
- direction.lighting: one dominant setup (golden hour side-key, hard midday overhead, sodium streetlight practical, neon rim + soft fill, single window key with negative fill).
- direction.camera_movement: one dominant treatment (locked-off, slow 6-inch push, dolly-in, orbit CW, handheld doc, drone reveal).
- direction.pacing: meditative | measured | punchy | trailer-fast.
- format: infer from platform hints: TikTok/Reels/Shorts → 9:16, YouTube → 16:9, cinema → 2.39:1, IG feed → 1:1. Default 16:9.
- For each shot: use the prompt engineering order — [SHOT TYPE], [SUBJECT], [ACTION verb], [LOCATION + time of day], [LENS + camera movement], [LIGHTING], [FILM/LOOK], [PALETTE words], [MOOD], [TECHNICAL].
- Shot duration_s: 3–8 seconds per shot.
- negative_prompt on every shot: "warped face, extra fingers, plastic skin, text overlays, watermark, jump cut, morphing background".
- chain_from: shot id of the previous shot if identity continuity requires start-frame chaining; else null.

If the user's message lacks BOTH a subject AND a clear intent, return: {"needs_clarification": true, "question": "..."}.

Return only valid JSON — no markdown fences, no commentary.`;

export const CINEMATIC_SHOT_PROMPT = `Given a brief, direction, and shot slot (index, purpose, shot_type), generate the full per-shot object.

Prompt engineering order (do not reorder):
[SHOT_TYPE], [SUBJECT — reuse identity anchor verbatim], [ACTION verb, present tense], [LOCATION + time of day + weather], [LENS + camera movement], [LIGHTING setup with direction], [FILM/LOOK], [PALETTE in words], [MOOD adjectives], [TECHNICAL: aspect, resolution, grain]

Rules:
- Under 350 characters for Kling/Runway; up to 900 for Veo/Sora if needed.
- Active verbs: exhales, pours, turns, steps, glances, ignites. Prefer "he pours" over "pouring".
- The subject phrase is fixed across all shots featuring the same character. Copy verbatim from brief.identity_anchor.
- Include one dominant camera_movement; do not stack multiple.
- Include lighting direction (camera-left, camera-right, behind, overhead).
- Include 2–3 palette words in prose — do not paste hex codes into the model prompt.

Purpose → shot-type map:
- establishing → WIDE or EXTREME WIDE
- context → MEDIUM WIDE
- character → MEDIUM or MEDIUM CLOSE-UP
- reaction → CLOSE-UP
- detail/insert → EXTREME CLOSE-UP or MACRO
- payoff → whatever the story demands`;

// ────────────────────────────────────────────────────────────────────────────
// 2. HeyGen Video Agent — visual styles
//    Source: skills-master/heygen-video/references/prompt-styles.md
//    Top 5 from production performance ranking across 40+ videos.
// ────────────────────────────────────────────────────────────────────────────

export interface HeyGenStyle {
  id: string;
  name: string;
  artist: string;
  mood: string;
  bestFor: string;
  styleBlock: string;
}

export const HEYGEN_STYLES: HeyGenStyle[] = [
  {
    id: "deconstructed",
    name: "Deconstructed",
    artist: "Brody",
    mood: "Industrial, raw",
    bestFor: "Tech news, punk energy — most reliable across all topics",
    styleBlock:
      "STYLE — DECONSTRUCTED (Brody): High-contrast black-and-white base with single acid-color accent. Brutal typography — oversized mono stencil. Torn-edge overlays, exposed grid. Abrupt hard cuts, no transitions.",
  },
  {
    id: "swiss-pulse",
    name: "Swiss Pulse",
    artist: "Müller-Brockmann",
    mood: "Clinical, precise",
    bestFor: "Data-heavy, analytical content",
    styleBlock:
      "STYLE — SWISS PULSE (Müller-Brockmann): Strict 12-column grid, primary red/black/white. Helvetica Neue tight tracking. Data as hero — charts as visual composition. Crisp wipes, no flourishes.",
  },
  {
    id: "digital-grid",
    name: "Digital Grid",
    artist: "Crouwel",
    mood: "Systematic, technical",
    bestFor: "Infrastructure, engineering, tech topics",
    styleBlock:
      "STYLE — DIGITAL GRID (Crouwel): Monochrome base — near-black, white, single electric-blue. OCR-style grid typography. Circuit-trace motion graphics. Precise pixel cuts, no easing.",
  },
  {
    id: "geometric-bold",
    name: "Geometric Bold",
    artist: "Tanaka",
    mood: "Minimal, elegant",
    bestFor: "Lifestyle, visual essays, versatile",
    styleBlock:
      "STYLE — GEOMETRIC BOLD (Tanaka): Flat color blocks — deep navy, off-white, single gold. Bold geometric shapes as structural dividers. Clean sans-serif. Smooth slide transitions with hold frames.",
  },
  {
    id: "velvet-standard",
    name: "Velvet Standard",
    artist: "Vignelli",
    mood: "Premium, timeless",
    bestFor: "Luxury, investor updates, high-end brand",
    styleBlock:
      "STYLE — VELVET STANDARD (Vignelli): Deep charcoal background, warm cream text, single champagne-gold accent. Tight Bodoni or Garamond. Minimal motion — slow dissolves, restrained reveals. No decorative elements.",
  },
  {
    id: "soft-signal",
    name: "Soft Signal",
    artist: "Sagmeister",
    mood: "Intimate, warm",
    bestFor: "Personal stories, wellness, human interest",
    styleBlock:
      "STYLE — SOFT SIGNAL (Sagmeister): Warm amber/cream, dusty rose, sage green. Handwritten-style text. Close-up framing. Slow drifts and floats. Soft dissolves with warm light leaks.",
  },
  {
    id: "maximalist-type",
    name: "Maximalist Type",
    artist: "Scher",
    mood: "Loud, kinetic",
    bestFor: "Big announcements, product launches, hype",
    styleBlock:
      "STYLE — MAXIMALIST TYPE (Scher): Full-bleed bold typography at 200pt+. Clashing complementary colors. Text IS the visual. Kinetic type animation on every cut. High energy, use sparingly.",
  },
];

export const HEYGEN_STYLE_IDS = HEYGEN_STYLES.map((s) => s.id);

export function getHeyGenStyle(id: string): HeyGenStyle | undefined {
  return HEYGEN_STYLES.find((s) => s.id === id);
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Seedance 2.0 — @ reference system + prompt patterns
//    Source: seedance2-skill/SKILL.md
// ────────────────────────────────────────────────────────────────────────────

export const SEEDANCE_REFERENCE_GUIDE = `Seedance 2.0 uses @ to assign roles to each uploaded asset. This is the most critical part of prompt writing.

Reference syntax:
  @Image1, @Image2, @Image3 … (up to 9 images)
  @Video1, @Video2, @Video3 … (up to 3 videos, 2–15s each)
  @Audio1, @Audio2, @Audio3 … (up to 3 audio files, ≤15s each)

Role assignment examples:
  @Image1 as the first frame
  @Image2 as the last frame
  @Image1's character as the subject
  scene references @Image3
  reference @Video1's camera movement
  reference @Video1's action choreography
  completely reference @Video1's effects and transitions
  video rhythm references @Video1
  BGM references @Audio1
  sound effects reference @Video3's audio
  wearing the outfit from @Image2

Prompt structure formula:
[Subject/Character Setup] + [Scene/Environment] + [Action/Motion Description] +
[Camera Movement] + [Timing Breakdown] + [Transitions/Effects] +
[Audio/Sound Design] + [Style/Mood]

Time-segmented prompts for 10s+ videos:
  0–3s: [opening scene, camera, action]
  3–6s: [mid-section development]
  6–10s: [climax or key action]
  10–15s: [resolution, ending shot]

Camera terms: static shot, push in, pull back, pan left/right, tilt up/down, 360° orbit, hand-held shake, overhead bird's eye, low angle worm's eye, tracking shot, crane up/down, Dutch angle, zoom in/out, rack focus.

Input limits: ≤9 images (30MB each), ≤3 videos (50MB each, 2–15s), ≤3 audio (15MB each), ≤12 files total.
Output: 4–15 seconds, 480p–720p, auto sound effects / BGM.
Restriction: No realistic human faces in uploaded assets (platform compliance).`;

// ────────────────────────────────────────────────────────────────────────────
// 4. Video Plan — Zod schema + types
//    Derived from cinematic-video-agent-skills/schemas/video-plan.schema.json
// ────────────────────────────────────────────────────────────────────────────

export const VideoPaletteEntrySchema = z.object({
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  role: z.enum(["dominant", "accent", "shadow", "highlight", "secondary"]),
});

export const VideoShotSchema = z.object({
  id: z.string(),
  purpose: z.enum(["establishing", "context", "character", "reaction", "detail", "insert", "payoff"]),
  shot_type: z.enum([
    "EXTREME WIDE",
    "WIDE",
    "MEDIUM WIDE",
    "MEDIUM",
    "MEDIUM CLOSE-UP",
    "CLOSE-UP",
    "EXTREME CLOSE-UP",
    "MACRO",
    "OVER-THE-SHOULDER",
    "POV",
  ]),
  duration_s: z.number().min(2).max(12),
  lens_mm: z.number().optional(),
  camera: z.string().optional(),
  action: z.string(),
  lighting: z.string().optional(),
  prompt: z.string(),
  negative_prompt: z.string(),
  starting_frame_hint: z.string().nullable().optional(),
  chain_from: z.string().nullable().optional(),
});

export const VideoPlanSchema = z.object({
  needs_clarification: z.boolean().optional(),
  question: z.string().optional(),
  brief: z
    .object({
      title: z.string(),
      logline: z.string(),
      genre: z.string(),
      mood: z.string(),
      era: z.string().optional(),
      identity_anchor: z.string().optional(),
      palette: z.array(VideoPaletteEntrySchema).min(3).max(5),
      references: z.array(z.string()).min(2).max(4),
      motion_language: z.enum([
        "Cinematic Minimal",
        "Kinetic Energy",
        "Luxury/Editorial",
        "Documentary Realism",
        "Music Video Maximal",
        "Retro/Analog",
        "Product Ad Clean",
      ]),
      format: z.enum(["16:9", "9:16", "1:1", "4:3", "2.39:1", "21:9"]),
      assumptions: z.array(z.string()).optional(),
    })
    .optional(),
  direction: z
    .object({
      lens: z.string(),
      film_stock: z.string(),
      lighting: z.string(),
      camera_movement: z.string(),
      pacing: z.enum(["meditative", "measured", "punchy", "trailer-fast"]),
      sound_register: z.string(),
    })
    .optional(),
  shots: z.array(VideoShotSchema).min(1).max(8).optional(),
  render_plan: z
    .object({
      model: z.string(),
      aspect_ratio: z.string(),
      resolution: z.enum(["720p", "1080p", "1440p", "4k"]),
      fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(48), z.literal(60)]),
    })
    .optional(),
  suggestions: z.array(z.string()).optional(),
});

export type VideoPaletteEntry = z.infer<typeof VideoPaletteEntrySchema>;
export type VideoShot = z.infer<typeof VideoShotSchema>;
export type VideoPlan = z.infer<typeof VideoPlanSchema>;
