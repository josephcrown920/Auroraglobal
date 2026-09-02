import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { routedGenerate } from "./ai-router";
import { sanitizeVideoAgentScript, videoAgentWordTarget } from "./video-agent-prompt";
import { computeCost } from "./pricing";
import { VIDEO_AGENT_SYSTEM_CONTRACT } from "./video-production-brain";
import { CINEMATIC_SYSTEM_PROMPT, CINEMATIC_ANALYSIS_PROMPT, VideoPlanSchema, getHeyGenStyle, type VideoPlan } from "./video-agent-skills";

const EnhanceSchema = z.object({ prompt: z.string().min(3).max(4000), targetSeconds: z.number().int().min(3).max(300).optional(), directToCamera: z.boolean().optional(), styleId: z.string().optional() });
const ScriptOutputSchema = z.object({ script: z.string().describe("The complete spoken script, plain text, speech only") });
const ENHANCE_WINDOW_MS = 60_000;
const ENHANCE_MAX_PER_WINDOW = 8;
const enhanceHits = new Map<string, number[]>();
function assertEnhanceRateLimit(userId: string): void { const now = Date.now(); const hits = (enhanceHits.get(userId) ?? []).filter(t => now - t < ENHANCE_WINDOW_MS); if (hits.length >= ENHANCE_MAX_PER_WINDOW) throw new Error("Enhance is rate-limited — wait a moment and try again"); hits.push(now); enhanceHits.set(userId, hits); if (enhanceHits.size > 5000) for (const [k,v] of enhanceHits) if (v.every(t => now - t >= ENHANCE_WINDOW_MS)) enhanceHits.delete(k); }

export const enhanceVideoAgentPrompt = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => EnhanceSchema.parse(d)).handler(async ({ context, data }) => {
  assertEnhanceRateLimit(context.userId);
  const words = videoAgentWordTarget(data.targetSeconds ?? 20);
  const style = data.styleId ? getHeyGenStyle(data.styleId) : undefined;
  const styleInstruction = style ? `\n\nAfter the spoken script, append this style block exactly as written (it is a technical directive to the Video Agent renderer, not speech):\n\n${style.styleBlock}` : "";
  const { provider, output } = await routedGenerate({
    system: "You are an elite scriptwriter for AI avatar presenter videos, with deep expertise in cinematic storytelling, brand narrative, and spoken-word performance. The presenter reads your output aloud word-for-word — so return ONLY the exact words to be spoken: natural, rhythmic, first-person voice. Apply these craft principles: open with a visceral hook that grabs attention in the first 3 words; build tension or curiosity in the body; land a clear, memorable closing line. Use the natural cadence of spoken English — short declarative sentences land harder than long ones. Vary sentence length for rhythm. Avoid academic or corporate language; speak like a confident human. Never include timestamps, stage directions, camera notes, bracketed cues, production labels like 'Tone:' or 'Background:', bullet points, emojis, hashtags, quotation marks, or negative instructions — all of those would be read aloud on camera. Frame everything positively. Respond in JSON.",
    prompt: `Rewrite the following into a polished, high-impact spoken script of about ${words} words. Keep the speaker's intent, key facts, and any product or brand names exactly as given. Apply cinematic storytelling structure: start with a bold hook (3-8 words that earn the next sentence), build through the body with specific concrete details rather than vague claims, and close with a line that resonates or calls to action.${data.directToCamera ? " DIRECT-TO-CAMERA MODE: The presenter is on screen the entire time speaking straight to the viewer, FaceTime-style — intimate, personal, and direct. Never refer to anything shown on screen, charts, graphics, or visuals. The speech must stand completely alone so it survives translation and redubbing in any language." : " CINEMATIC NARRATION MODE: Write as a confident voiceover narrator — authoritative, evocative, with a sense of place and movement. Use present tense for immediacy. Paint pictures with words."}${styleInstruction}\n\nRaw idea or draft:\n${data.prompt}\n\nReturn JSON: {"script": "..."}`,
    schema: ScriptOutputSchema,
    category: "SCRIPT_WRITING",
  });
  const script = sanitizeVideoAgentScript(output.script);
  if (!script) throw new Error("Enhance produced an empty script — try rewording your idea");
  return { script, provider };
});

const cinematicHits = new Map<string, number[]>();
function assertCinematicRateLimit(userId: string): void { const now = Date.now(); const hits = (cinematicHits.get(userId) ?? []).filter(t => now - t < ENHANCE_WINDOW_MS); if (hits.length >= ENHANCE_MAX_PER_WINDOW) throw new Error("Cinematic Analyze is rate-limited — wait a moment and try again"); hits.push(now); cinematicHits.set(userId, hits); if (cinematicHits.size > 5000) for (const [k,v] of cinematicHits) if (v.every(t => now - t >= ENHANCE_WINDOW_MS)) cinematicHits.delete(k); }

export const analyzeCinematicBrief = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ userIdea: z.string().min(4).max(3000), format: z.enum(["16:9", "9:16", "1:1", "2.39:1"]).optional() }).parse(d)).handler(async ({ context, data }): Promise<VideoPlan> => {
  assertCinematicRateLimit(context.userId);
  const formatHint = data.format ? ` Preferred format: ${data.format}.` : "";
  const { output } = await routedGenerate({
    system: `${VIDEO_AGENT_SYSTEM_CONTRACT}\n\n${CINEMATIC_SYSTEM_PROMPT}\n\n${CINEMATIC_ANALYSIS_PROMPT}`,
    prompt: `User request: ${data.userIdea}${formatHint}\n\nAnalyze this into a complete video plan with brief, direction, and 4–6 shots. Return only valid JSON matching the VideoPlan schema.`,
    schema: VideoPlanSchema,
    category: "VIDEO_DIRECTION",
  });
  if (output.needs_clarification) throw new Error(output.question ?? "Idea is too vague — add a subject or clear intent");
  if (!output.brief || !output.shots?.length) throw new Error("Plan incomplete — try a more specific idea");
  return output as VideoPlan;
});

export const VIDEO_AGENT_COST = computeCost({ features: ["video"], model: "heygen/video-agent" }).total;
const HEYGEN_CREDIT_RE = /\b(402|insufficient.?credit|credit.?exhausted|40102)\b/i;
export type VideoAgentResult = { ok: true; url: string; generationId: string } | { ok: false; error: string; insufficient?: boolean; heygenCredit?: boolean };

export const generateHeyGenAgentVideo = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => z.object({ prompt: z.string().min(3).max(4000), orientation: z.enum(["landscape", "portrait"]).optional() }).parse(d)).handler(async ({ context, data }): Promise<VideoAgentResult> => {
  const { reserveOrchestrateRecord } = await import("./generate-core.server");
  try {
    const outcome = await reserveOrchestrateRecord({ userId: context.userId, kind: "video", cost: VIDEO_AGENT_COST, reason: "heygen_video_agent", prompt: data.prompt, model: "heygen/video-agent", pinnedModelOnly: true, ...(data.orientation ? { params: { orientation: data.orientation } } : {}) });
    if (!outcome.ok) { const isHeygenCredit = HEYGEN_CREDIT_RE.test(outcome.error ?? ""); return { ok: false, error: outcome.error ?? "Generation failed", insufficient: outcome.insufficient, heygenCredit: isHeygenCredit }; }
    return { ok: true, url: outcome.url, generationId: outcome.generationId };
  } catch (e) { const msg = e instanceof Error ? e.message : String(e); return { ok: false, error: msg, heygenCredit: HEYGEN_CREDIT_RE.test(msg) }; }
});
