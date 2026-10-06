// Shared, server-only helpers for the UGC ad + UGC campaign pipelines.
// Pure functions + the LLM script generator. The actual multi-stage rendering
// lives in the jobs worker (jobs.server.ts), which reuses these builders so the
// MCP tools, the /ugc page and the queue all produce consistent prompts.

import { z } from "zod";
import { routedGenerate } from "./ai-router";

// ─── Credit costs ─────────────────────────────────────────────────────────────
// COST_UGC_AD is the single source in pricing.ts; re-exported here so existing
// server-side importers keep working without changes.
export { COST_UGC_AD } from "./pricing";
export const COST_CAMPAIGN_ITEM = 6;

// Default Hugging Face text-to-speech model. Only used when HF_TOKEN is present;
// callers can override per request. Kept generic/widely-available on purpose.
export const UGC_TTS_MODEL = "facebook/mms-tts-eng";

// ─── Script generation ────────────────────────────────────────────────────────

const UGCScriptSchema = z.object({
  hook: z.string().describe("A 1-line scroll-stopping opener spoken to camera"),
  body: z.string().describe("1-2 sentences of authentic first-person product talk"),
  cta: z.string().describe("A short call to action"),
});

export type UGCScript = { hook: string; body: string; cta: string; full: string };

/**
 * Preserve supplied creator copy verbatim when a caller has already written the
 * script (for example Content Line). This deliberately bypasses the LLM rewrite
 * used for a conventional product brief.
 */
export function providedUGCScript(full: string): UGCScript {
  const script = full.trim();
  if (!script) throw new Error("Provided UGC script cannot be empty");
  return { hook: "", body: "", cta: "", full: script };
}

/**
 * Write a short UGC ad script. Tries the configured LLM fallback chain and, when
 * no LLM key is configured (or every provider fails), returns a deterministic
 * templated script so the pipeline still produces a real, functional ad. The
 * `source` field makes the degradation explicit to callers.
 */
export async function generateUGCScript(input: {
  avatarName?: string;
  productPrompt: string;
  sceneHint?: string;
  durationSec?: number;
}): Promise<{ script: UGCScript; source: "llm" | "template"; provider?: string }> {
  const dur = input.durationSec ?? 8;
  const wordTarget = Math.max(18, Math.round(dur * 2.6)); // ~2.6 spoken words/sec
  try {
    const { provider, output } = await routedGenerate({
      system:
        "You are a short-form UGC ad scriptwriter. Write punchy, authentic, first-person spoken copy a creator would actually say to camera. No stage directions, no emojis, no hashtags, no quotation marks.",
      prompt: `Write a ${dur}-second UGC ad script (about ${wordTarget} words total) for ${
        input.avatarName ? `creator "${input.avatarName}"` : "a creator"
      } promoting: ${input.productPrompt}.${
        input.sceneHint ? ` Scene: ${input.sceneHint}.` : ""
      } Return a hook, body and call to action. Keep it natural and spoken, like a real TikTok or Reel.`,
      schema: UGCScriptSchema,
      category: "ADVERTISEMENT",
    });
    const full = [output.hook, output.body, output.cta]
      .map((s) => (s ?? "").trim())
      .filter(Boolean)
      .join(" ");
    return { script: { ...output, full }, source: "llm", provider };
  } catch {
    return { script: templateScript(input), source: "template" };
  }
}

function templateScript(input: { avatarName?: string; productPrompt: string }): UGCScript {
  const who = input.avatarName ? `Hey, it's ${input.avatarName}.` : "Okay, real talk.";
  const hook = `${who} I had to show you this.`;
  const body = `I've been using ${input.productPrompt} and honestly it changed my routine — it just works and fits right into my day.`;
  const cta = `Tap the link and try it for yourself. You'll thank me later.`;
  return { hook, body, cta, full: `${hook} ${body} ${cta}` };
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

export function buildUGCImagePrompt(input: {
  avatarName?: string;
  vibe?: string | null;
  sceneHint?: string;
  productPrompt: string;
  aspect?: string;
}): string {
  const aspect = input.aspect ?? "9:16";
  return [
    "Hyper-realistic UGC iPhone-style photo",
    input.sceneHint || "casual natural setting, soft window light",
    input.avatarName
      ? `featuring AI creator "${input.avatarName}"${input.vibe ? ` (${input.vibe})` : ""}`
      : null,
    `product/action: ${input.productPrompt}`,
    "native social-media aesthetic, photoreal skin texture, no logos, no on-screen text",
    `[${aspect} aspect ratio]`,
  ]
    .filter(Boolean)
    .join(", ");
}

export function buildUGCMotionPrompt(input: {
  avatarName?: string;
  sceneName?: string;
  productPrompt: string;
}): string {
  return [
    input.sceneName ? `${input.sceneName}:` : "",
    input.productPrompt,
    "natural micro-movements, subtle handheld camera, lifelike facial expression, talking to camera",
    input.avatarName ? `creator ${input.avatarName}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/**
 * Build the xAI Grok Imagine Video prompt for a UGC ad.
 * The model takes the reference image + this prompt and generates a full
 * talking-head video with built-in walk-toward-camera and lip-sync — no
 * separate TTS → video → lipsync pipeline needed.
 */
export function buildXAIUGCPrompt(input: {
  script: { hook: string; body: string; cta: string; full: string };
  productPrompt: string;
  avatarName?: string;
}): string {
  const spoken = input.script.full.trim();
  const product = input.productPrompt.trim();
  const name = input.avatarName ? ` (${input.avatarName})` : "";
  return [
    `Create a realistic UGC-style video from the reference image of the person${name}.`,
    `The person walks slowly and naturally toward the camera while speaking directly to the viewer with natural facial expressions, head movement, and realistic lip-sync.`,
    `Camera: Handheld selfie-style shot, slight natural movement, vertical 9:16 format.`,
    `Movement: The person starts a bit further away and walks casually toward the camera, maintaining eye contact, with natural body sway and subtle gestures.`,
    `The person is speaking these exact words: "${spoken}"`,
    `Context: ${product}`,
    `Style: Authentic creator content, warm natural lighting, relatable and conversational tone.`,
  ].join(" ");
}

// ─── Campaign variations ──────────────────────────────────────────────────────

function pick(arr: string[] | undefined, i: number): string | undefined {
  return arr && arr.length ? arr[i % arr.length] : undefined;
}

export type CampaignVariation = {
  index: number;
  label: string;
  imagePrompt: string;
  motionPrompt: string;
};

/**
 * Expand a base prompt into N coordinated variations, cycling through the
 * supplied outfit/location/mood/lighting arrays (same approach as bulk-generate).
 * Each variation carries both an image prompt and a matched motion prompt for the
 * image-to-video stage.
 */
export function buildCampaignVariations(input: {
  base: string;
  count: number;
  aspect?: string;
  triggerWord?: string;
  avatarName?: string;
  locations?: string[];
  outfits?: string[];
  moods?: string[];
  lighting?: string[];
  motionPrompt?: string;
}): CampaignVariation[] {
  const aspect = input.aspect ?? "9:16";
  const out: CampaignVariation[] = [];
  for (let i = 0; i < input.count; i++) {
    const loc = pick(input.locations, i);
    const outfit = pick(input.outfits, i);
    const mood = pick(input.moods, i);
    const light = pick(input.lighting, i);

    const segs = [input.base];
    if (input.avatarName) segs.push(`featuring AI creator "${input.avatarName}"`);
    if (loc) segs.push(`at ${loc}`);
    if (outfit) segs.push(`wearing ${outfit}`);
    if (mood) segs.push(`${mood} mood`);
    if (light) segs.push(`${light} lighting`);
    if (input.triggerWord) segs.push(input.triggerWord);
    segs.push("hyper-realistic UGC photo, photoreal skin, native social aesthetic, no on-screen text");
    segs.push(`[${aspect} aspect ratio]`);

    const labelParts = [outfit, loc, mood].filter(Boolean) as string[];
    out.push({
      index: i,
      label: labelParts.length ? labelParts.join(" · ") : `Variation ${i + 1}`,
      imagePrompt: segs.join(", "),
      motionPrompt:
        input.motionPrompt?.trim() ||
        `subtle natural motion, ${[outfit, loc].filter(Boolean).join(", ") || input.base}, lifelike, handheld`,
    });
  }
  return out;
}
