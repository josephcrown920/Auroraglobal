// Shared, server-only helpers for the Faceless Kids Story Studio (/kids).
// Pure functions + the LLM story-script generator. The actual multi-stage render
// (illustration -> image-to-video -> narration -> ffmpeg assembly) lives in the
// jobs worker (runKidsStory in jobs.server.ts), which reuses these builders so
// the /kids page, the enqueue server fn and the queue all agree on the script
// shape, the prompts and the price.
//
// "Faceless" here is the creator-economy sense: a finished kids video with no
// real person on camera — fully illustrated + narrated. Characters are friendly
// cartoons. A character's look is held across scenes two ways at once: a fixed
// textual description in every illustration prompt AND (in the runner) scene 1's
// illustration reused as a reference image for the later scenes.

import { z } from "zod";
import { generateWithFallback } from "./llm-fallback.server";
import { computeCost } from "./pricing";

// ─── Brief vocabulary ─────────────────────────────────────────────────────────

export type KidsContentType = "bedtime" | "nursery_rhyme" | "educational" | "adventure";
export type KidsAgeRange = "0-3" | "3-5" | "5-8";
export type KidsLengthId = "short" | "medium" | "long";

export const KIDS_CONTENT_TYPES: {
  id: KidsContentType;
  label: string;
  blurb: string;
  tone: string;
}[] = [
  {
    id: "bedtime",
    label: "Bedtime Story",
    blurb: "Calm, soothing tale to wind down to",
    tone: "gentle, slow, soothing and reassuring, ending on a sleepy, peaceful note",
  },
  {
    id: "nursery_rhyme",
    label: "Nursery Rhyme",
    blurb: "Sing-song rhyming verses with repetition",
    tone: "playful rhyming verse with a simple repeating refrain and a sing-song rhythm",
  },
  {
    id: "educational",
    label: "Educational",
    blurb: "Teach one simple idea in a fun way",
    tone: "warm and curious, teaching one simple idea clearly with friendly examples",
  },
  {
    id: "adventure",
    label: "Adventure",
    blurb: "A little journey full of wonder",
    tone: "upbeat and adventurous with gentle excitement and a happy, kind ending",
  },
];

export const KIDS_AGE_RANGES: { id: KidsAgeRange; label: string; guidance: string }[] = [
  { id: "0-3", label: "Toddler (0–3)", guidance: "very short, concrete words, lots of repetition, one idea at a time" },
  { id: "3-5", label: "Preschool (3–5)", guidance: "simple sentences, familiar feelings, a clear and friendly story shape" },
  { id: "5-8", label: "Early reader (5–8)", guidance: "slightly richer vocabulary and a small lesson, still warm and simple" },
];

// Length fixes the scene count up front so the price is deterministic at enqueue
// (the LLM is told to produce exactly this many scenes; the runner clamps to it).
export const KIDS_LENGTHS: Record<
  KidsLengthId,
  { id: KidsLengthId; label: string; scenes: number; secondsPerScene: number }
> = {
  short: { id: "short", label: "Short (~15s · 3 scenes)", scenes: 3, secondsPerScene: 5 },
  medium: { id: "medium", label: "Medium (~20s · 4 scenes)", scenes: 4, secondsPerScene: 5 },
  long: { id: "long", label: "Long (~25s · 5 scenes)", scenes: 5, secondsPerScene: 5 },
};

export const KIDS_MAX_SCENES = 5;
export const KIDS_ASPECT = "9:16";

// Default Hugging Face text-to-speech model. Only used when HF_TOKEN is present;
// without it narration is skipped and the story is a silent illustrated clip.
export const KIDS_TTS_MODEL = "facebook/mms-tts-eng";

// ─── Preset characters ────────────────────────────────────────────────────────
// Faceless cartoon characters the user can pick (or they reuse a saved avatar /
// upload their own). The look is anchored by `description` in every illustration
// prompt; the runner additionally pins scene 1's illustration as a reference.

export type KidsCharacter = { id: string; name: string; description: string };

export const KIDS_CHARACTERS: KidsCharacter[] = [
  {
    id: "fuzz",
    name: "Fuzz the monster",
    description:
      "Fuzz, a small round friendly monster covered in soft lavender-purple fur, with two big round eyes, tiny rounded horns, little arms and a wide happy smile",
  },
  {
    id: "pip",
    name: "Pip the bunny",
    description:
      "Pip, a fluffy little white-and-grey bunny with long floppy ears, a tiny pink nose, big curious eyes and a soft round tail",
  },
  {
    id: "ollie",
    name: "Ollie the owl",
    description:
      "Ollie, a chubby teal baby owl with huge round amber eyes, soft rounded feathers, tiny tufted ears and stubby wings",
  },
  {
    id: "sunny",
    name: "Sunny the star",
    description:
      "Sunny, a cheerful glowing golden star character with rosy cheeks, a gentle smile and little stubby arms, softly radiating warm light",
  },
];

export const DEFAULT_KIDS_CHARACTER = KIDS_CHARACTERS[0];

export function findKidsCharacter(id: string | null | undefined): KidsCharacter | undefined {
  return id ? KIDS_CHARACTERS.find((c) => c.id === id) : undefined;
}

// ─── Curated royalty-free music library ───────────────────────────────────────
// Kid-friendly background beds. Tracks are resolved at assembly time from the
// private `studio` bucket under `kids-music/<id>.mp3` (the owner drops licensed,
// royalty-free files there — Aurora never composes or hotlinks music). When a
// chosen track file isn't present the runner skips music gracefully and records
// it in the brief, exactly like the TTS-skipped path.

export type KidsMusicTrack = {
  id: string;
  label: string;
  mood: string;
  contentTypes: KidsContentType[];
  storagePath: string;
  attribution: string;
};

export const KIDS_MUSIC: KidsMusicTrack[] = [
  {
    id: "dreamy-lullaby",
    label: "Dreamy Lullaby",
    mood: "calm",
    contentTypes: ["bedtime", "nursery_rhyme"],
    storagePath: "kids-music/dreamy-lullaby.mp3",
    attribution: "Royalty-free — provided by the studio owner",
  },
  {
    id: "happy-skip",
    label: "Happy Skip",
    mood: "playful",
    contentTypes: ["nursery_rhyme", "adventure"],
    storagePath: "kids-music/happy-skip.mp3",
    attribution: "Royalty-free — provided by the studio owner",
  },
  {
    id: "curious-discovery",
    label: "Curious Discovery",
    mood: "bright",
    contentTypes: ["educational"],
    storagePath: "kids-music/curious-discovery.mp3",
    attribution: "Royalty-free — provided by the studio owner",
  },
  {
    id: "little-adventure",
    label: "Little Adventure",
    mood: "upbeat",
    contentTypes: ["adventure", "educational"],
    storagePath: "kids-music/little-adventure.mp3",
    attribution: "Royalty-free — provided by the studio owner",
  },
];

export const KIDS_MUSIC_NONE = "none";

/** Resolve the music selection: explicit id, "none", or auto-pick by content type. */
export function pickKidsMusic(
  contentType: KidsContentType,
  chosenId?: string | null,
): KidsMusicTrack | null {
  if (chosenId === KIDS_MUSIC_NONE) return null;
  if (chosenId) {
    const exact = KIDS_MUSIC.find((t) => t.id === chosenId);
    if (exact) return exact;
  }
  return KIDS_MUSIC.find((t) => t.contentTypes.includes(contentType)) ?? KIDS_MUSIC[0] ?? null;
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
// Stacked, additive, and routed entirely through pricing.computeCost (the single
// cost source). Each scene is an illustration + a clip + narration; the final
// render is one assembled video of the full length. No new pricing feature.

// The runner renders every clip on the budget-tier self-hosted/Seedance-Lite
// model (`seedance-2.0-fast`), so price it on that tier explicitly — this keeps
// the kids price unchanged under model-tiered pricing instead of drifting if the
// default video tier ever changes.
const KIDS_VIDEO_MODEL = "seedance-2.0-fast";

export function computeKidsStoryCost(scenes: number, secondsPerScene: number): number {
  const n = Math.max(1, Math.min(scenes, KIDS_MAX_SCENES));
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += computeCost({
      features: ["image", "video", "audio"],
      durationSeconds: secondsPerScene,
      model: KIDS_VIDEO_MODEL,
    }).total;
  }
  // Final assembly delivers one video of the whole story length.
  total += computeCost({
    features: ["video"],
    durationSeconds: n * secondsPerScene,
    model: KIDS_VIDEO_MODEL,
  }).total;
  return total;
}

export function kidsStoryCostForLength(lengthId: KidsLengthId): number {
  const len = KIDS_LENGTHS[lengthId] ?? KIDS_LENGTHS.short;
  return computeKidsStoryCost(len.scenes, len.secondsPerScene);
}

// ─── Script generation ────────────────────────────────────────────────────────

const KidsSceneSchema = z.object({
  narration: z
    .string()
    .describe("1-2 short sentences of narration for this scene, read aloud to a child"),
  illustration: z
    .string()
    .describe(
      "A vivid visual description of what to draw for this scene — setting, the character's action, mood and colors. Describe pictures only; never mention words, captions or text.",
    ),
});

const KidsScriptSchema = z.object({
  title: z.string().describe("A short, friendly title for the story"),
  scenes: z.array(KidsSceneSchema),
});

export type KidsScene = { narration: string; illustration: string };
export type KidsStoryScript = { title: string; scenes: KidsScene[] };

export type KidsScriptInput = {
  contentType: KidsContentType;
  ageRange: KidsAgeRange;
  topic: string;
  characterName: string;
  characterDescription?: string;
  sceneCount: number;
};

/**
 * Write a short kids story script (title + ordered scenes). Tries the configured
 * LLM fallback chain and, when no LLM key is configured (or every provider
 * fails), returns a deterministic templated story so the pipeline still produces
 * a real, functional video. `source` makes the degradation explicit to callers.
 */
export async function generateKidsStoryScript(
  input: KidsScriptInput,
): Promise<{ script: KidsStoryScript; source: "llm" | "template"; provider?: string }> {
  const n = Math.max(1, Math.min(input.sceneCount, KIDS_MAX_SCENES));
  const ct = KIDS_CONTENT_TYPES.find((c) => c.id === input.contentType) ?? KIDS_CONTENT_TYPES[0];
  const age = KIDS_AGE_RANGES.find((a) => a.id === input.ageRange) ?? KIDS_AGE_RANGES[1];

  try {
    const { provider, output } = await generateWithFallback({
      system:
        "You are a warm, gentle children's storyteller. You write short, wholesome, age-appropriate stories that are safe and kind — never scary, violent or sad. No emojis, no hashtags, no quotation marks, no stage directions.",
      prompt:
        `Write a ${ct.label.toLowerCase()} for children aged ${input.ageRange}. ` +
        `Tone: ${ct.tone}. Audience guidance: ${age.guidance}. ` +
        `The story stars ${input.characterName}` +
        `${input.characterDescription ? ` (${input.characterDescription})` : ""}. ` +
        `Topic: ${input.topic}. ` +
        `Break it into EXACTLY ${n} scenes that flow in order. For each scene give: ` +
        `narration (1-2 short sentences read aloud) and illustration (a vivid picture description of the scene — setting, the character's action, mood, colors; pictures only, never any words or text). ` +
        `Also give the whole story a short friendly title. Keep ${input.characterName} the same character in every scene.`,
      schema: KidsScriptSchema,
    });
    const scenes = (output.scenes ?? [])
      .map((s) => ({
        narration: (s.narration ?? "").trim(),
        illustration: (s.illustration ?? "").trim(),
      }))
      .filter((s) => s.narration || s.illustration)
      .slice(0, n);
    if (scenes.length === 0) throw new Error("empty script");
    const title = (output.title ?? "").trim() || templateTitle(input);
    return { script: { title, scenes }, source: "llm", provider };
  } catch {
    return { script: templateScript(input, n), source: "template" };
  }
}

function templateTitle(input: KidsScriptInput): string {
  return `${input.characterName} and the ${input.topic}`.slice(0, 80);
}

function templateScript(input: KidsScriptInput, n: number): KidsStoryScript {
  const name = input.characterName;
  const topic = input.topic;
  const beats = [
    {
      narration: `Once upon a time, ${name} set off to discover all about ${topic}.`,
      illustration: `${name} smiling at the start of a gentle journey, soft morning light, cozy storybook world`,
    },
    {
      narration: `Along the way, ${name} met a new friend who knew all about ${topic}.`,
      illustration: `${name} meeting a friendly little companion in a colorful, calm setting`,
    },
    {
      narration: `Together they explored and learned something wonderful about ${topic}.`,
      illustration: `${name} and friend happily exploring, bright and curious, warm cheerful colors`,
    },
    {
      narration: `${name} felt so happy and proud of everything they had learned.`,
      illustration: `${name} beaming with joy, gentle glowing light, peaceful and warm`,
    },
    {
      narration: `And as the day ended, ${name} drifted off into the sweetest dreams.`,
      illustration: `${name} snuggled up cozy and sleepy under a starry night sky, soft and calm`,
    },
  ];
  return { title: templateTitle(input), scenes: beats.slice(0, n) };
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

const KIDS_ART_STYLE =
  "soft children's storybook illustration, gentle rounded shapes, warm friendly colors, cozy digital painting, soft lighting, wholesome and cute, no text, no words, no captions, no watermark";

export function buildKidsIllustrationPrompt(input: {
  sceneIllustration: string;
  characterName: string;
  characterDescription?: string;
  aspect?: string;
}): string {
  const aspect = input.aspect ?? KIDS_ASPECT;
  return [
    KIDS_ART_STYLE,
    input.characterDescription
      ? `Main character: ${input.characterName} — ${input.characterDescription}. Keep this exact character design consistent.`
      : `Main character: ${input.characterName}. Keep this exact character design consistent.`,
    `Scene: ${input.sceneIllustration}`,
    `[${aspect} aspect ratio]`,
  ]
    .filter(Boolean)
    .join(", ");
}

export function buildKidsMotionPrompt(input: {
  sceneIllustration: string;
  characterName: string;
}): string {
  return [
    `${input.characterName}:`,
    input.sceneIllustration,
    "gentle storybook motion, soft parallax, subtle character movement, calm and smooth, child-friendly animation",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/** Estimate spoken length (seconds) from narration text — ~2.6 words/sec. */
export function estimateNarrationSeconds(text: string, fallback: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return fallback;
  return Math.max(3, Math.min(12, Math.round(words / 2.6)));
}
