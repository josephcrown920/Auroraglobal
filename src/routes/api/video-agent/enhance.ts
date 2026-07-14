// POST /api/video-agent/enhance
// Standalone-accessible REST wrapper around the enhanceVideoAgentPrompt logic.
// Bearer token auth (Supabase JWT or aurk_ CLI key). CORS-open for the
// standalone artifacts/video-agent SPA.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

async function authUserId(req: Request): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const token = h.slice(7);
  if (token.startsWith("aurk_")) {
    const { userIdForApiKey } = await import("@/lib/cli-device.server");
    return userIdForApiKey(token);
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

const EnhanceSchema = z.object({
  prompt: z.string().min(3).max(4000),
  targetSeconds: z.number().int().min(3).max(300).optional(),
  directToCamera: z.boolean().optional(),
  styleId: z.string().optional(),
});

const ScriptOutputSchema = z.object({
  script: z.string().describe("The complete spoken script, plain text, speech only"),
});

export const Route = createFileRoute("/api/video-agent/enhance")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }),
      POST: async ({ request }) => {
        const userId = await authUserId(request);
        if (!userId) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: CORS,
          });
        }
        try {
          const body = await request.json();
          const data = EnhanceSchema.parse(body);

          const { generateWithFallback } = await import("@/lib/llm-fallback.server");
          const { sanitizeVideoAgentScript, videoAgentWordTarget } = await import(
            "@/lib/video-agent-prompt"
          );
          const { getHeyGenStyle } = await import("@/lib/video-agent-skills");

          const words = videoAgentWordTarget(data.targetSeconds ?? 20);
          const style = data.styleId ? getHeyGenStyle(data.styleId) : undefined;
          const styleInstruction = style
            ? `\n\nAfter the spoken script, append this style block exactly as written (it is a technical directive to the Video Agent renderer, not speech):\n\n${style.styleBlock}`
            : "";

          const { output, provider } = await generateWithFallback({
            system:
              "You are an elite scriptwriter for AI avatar presenter videos, with deep expertise in cinematic storytelling, brand narrative, and spoken-word performance. The presenter reads your output aloud word-for-word — so return ONLY the exact words to be spoken: natural, rhythmic, first-person voice. Apply these craft principles: open with a visceral hook that grabs attention in the first 3 words; build tension or curiosity in the body; land a clear, memorable closing line. Use the natural cadence of spoken English — short declarative sentences land harder than long ones. Vary sentence length for rhythm. Avoid academic or corporate language; speak like a confident human. Never include timestamps, stage directions, camera notes, bracketed cues, production labels like 'Tone:' or 'Background:', bullet points, emojis, hashtags, quotation marks, or negative instructions — all of those would be read aloud on camera. Frame everything positively. Respond in JSON.",
            prompt: `Rewrite the following into a polished, high-impact spoken script of about ${words} words. Keep the speaker's intent, key facts, and any product or brand names exactly as given. Apply cinematic storytelling structure: start with a bold hook (3-8 words that earn the next sentence), build through the body with specific concrete details rather than vague claims, and close with a line that resonates or calls to action.${
              data.directToCamera
                ? " DIRECT-TO-CAMERA MODE: The presenter is on screen the entire time speaking straight to the viewer, FaceTime-style — intimate, personal, and direct. Never refer to anything shown on screen, charts, graphics, or visuals. The speech must stand completely alone so it survives translation and redubbing in any language."
                : " CINEMATIC NARRATION MODE: Write as a confident voiceover narrator — authoritative, evocative, with a sense of place and movement. Use present tense for immediacy. Paint pictures with words."
            }${styleInstruction}\n\nRaw idea or draft:\n${data.prompt}\n\nReturn JSON: {"script": "..."}`,
            schema: ScriptOutputSchema,
          });

          const script = sanitizeVideoAgentScript(output.script);
          if (!script) {
            return new Response(
              JSON.stringify({ error: "Enhance produced an empty script — try rewording your idea" }),
              { status: 422, headers: CORS },
            );
          }
          return new Response(JSON.stringify({ script, provider }), { headers: CORS });
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ error }), { status: 500, headers: CORS });
        }
      },
    },
  },
});
