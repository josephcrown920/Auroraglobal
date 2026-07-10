import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateWithFallback } from "./llm-fallback.server";
import { sanitizeVideoAgentScript, videoAgentWordTarget } from "./video-agent-prompt";

// ─── HeyGen Video Agent "Enhance prompt" pass (Task #274) ────────────────────
// Turns a rough idea (or messy draft) into a clean first-person spoken script.
// The output goes straight into HeyGen's voice.input_text — the avatar reads
// it verbatim — so the LLM is instructed to emit ONLY speech: no timestamps,
// no stage directions, no Tone:/Background: metadata, no negative instructions.
// A deterministic sanitize pass runs after the LLM as a belt-and-braces guard.

const EnhanceSchema = z.object({
  prompt: z.string().min(3).max(4000),
  /** Target spoken length in seconds — sizes the word budget. */
  targetSeconds: z.number().int().min(3).max(300).optional(),
  /** Direct-to-camera mode: personal FaceTime-style delivery with no references
   *  to on-screen visuals, so the video survives translation/redubbing intact. */
  directToCamera: z.boolean().optional(),
});

const ScriptOutputSchema = z.object({
  script: z.string().describe("The complete spoken script, plain text, speech only"),
});

// Per-user sliding-window throttle: the enhance pass is free to the user but
// costs the platform an LLM call, so cap the rate a single account can burn.
// In-memory is deliberate — worst case a server restart resets the window.
const ENHANCE_WINDOW_MS = 60_000;
const ENHANCE_MAX_PER_WINDOW = 8;
const enhanceHits = new Map<string, number[]>();

function assertEnhanceRateLimit(userId: string): void {
  const now = Date.now();
  const hits = (enhanceHits.get(userId) ?? []).filter((t) => now - t < ENHANCE_WINDOW_MS);
  if (hits.length >= ENHANCE_MAX_PER_WINDOW) {
    throw new Error("Enhance is rate-limited — wait a moment and try again");
  }
  hits.push(now);
  enhanceHits.set(userId, hits);
  // Opportunistic cleanup so the map can't grow unbounded across many users.
  if (enhanceHits.size > 5000) {
    for (const [k, v] of enhanceHits) {
      if (v.every((t) => now - t >= ENHANCE_WINDOW_MS)) enhanceHits.delete(k);
    }
  }
}

export const enhanceVideoAgentPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EnhanceSchema.parse(d))
  .handler(async ({ context, data }) => {
    assertEnhanceRateLimit(context.userId);
    const words = videoAgentWordTarget(data.targetSeconds ?? 20);
    const { provider, output } = await generateWithFallback({
      system:
        "You write spoken scripts for AI avatar presenter videos. The presenter reads your output aloud word-for-word, so return ONLY the words to be spoken: natural, conversational, first-person. Never include timestamps, stage directions, camera notes, bracketed cues, labels like 'Tone:' or 'Background:', bullet points, emojis, hashtags, quotation marks, or negative instructions like 'don't mention X' — all of those would be read aloud on camera. Frame everything positively (say what TO say, never what to avoid). Respond in JSON.",
      prompt: `Rewrite the following into a polished spoken script of about ${words} words. Keep the speaker's intent, key facts, and any product or brand names exactly as given. Open with a hook in the first sentence and end with a clear closing line.${
        data.directToCamera
          ? " Direct-to-camera mode: the presenter is on screen the entire time speaking straight to the viewer, FaceTime-style — personal and direct, and never refer to anything shown on screen, charts, or visuals (speech must stand alone so it survives translation and redubbing)."
          : ""
      }\n\nRaw idea or draft:\n${data.prompt}\n\nReturn JSON: {"script": "..."}`,
      schema: ScriptOutputSchema,
    });
    const script = sanitizeVideoAgentScript(output.script);
    if (!script) throw new Error("Enhance produced an empty script — try rewording your idea");
    return { script, provider };
  });
