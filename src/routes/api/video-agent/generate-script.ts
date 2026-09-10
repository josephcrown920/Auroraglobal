import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { routedGenerate } from "@/lib/ai-router";
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit.server";

const SCRIPT_RATE_WINDOW_MS = 60_000;
const SCRIPT_RATE_MAX_PER_WINDOW = 8;

const SceneSchema = z.object({
  index: z.number(),
  title: z.string(),
  script: z.string(),
  description: z.string(),
  duration: z.number(),
});

const ScriptSchema = z.object({
  title: z.string(),
  scenes: z.array(SceneSchema).min(1).max(8),
});

const GenerateScriptInputSchema = z.object({
  // The pure core remains usable by unit tests and other server callers
  // without a project; the authenticated HTTP handler requires this field
  // before it persists server-owned attribution.
  projectId: z.string().uuid().optional(),
  prompt: z.string().trim().min(3).max(4000),
  style: z.string().trim().min(1).max(120),
  voice: z.string().trim().min(1).max(120),
  targetDuration: z.number().int().min(3).max(600),
});

type GenerateScriptInput = z.infer<typeof GenerateScriptInputSchema>;
const GenerateScriptRequestSchema = GenerateScriptInputSchema.extend({
  projectId: z.string().uuid(),
});
type GenerateScriptRequest = z.infer<typeof GenerateScriptRequestSchema>;

type GenerateScript = typeof routedGenerate;

const SYSTEM_PROMPT = `You are a professional video scriptwriter and creative director for Aurora, a premium AI content studio.
Given a user's video topic and parameters, generate a complete video production plan.

Return ONLY a JSON object with this exact structure:
{
  "title": "short engaging title for the video",
  "scenes": [
    {
      "index": 0,
      "title": "scene name",
      "script": "exact voiceover text for this scene (2-4 sentences)",
      "description": "detailed cinematic visual description: what the camera sees, lighting, motion, composition, color grade",
      "duration": 8
    }
  ]
}

Rules:
- Create 4-8 scenes depending on target duration
- Each scene voiceover should read naturally in its duration seconds
- Visual descriptions must be specific, cinematic, and detailed enough to generate a keyframe image
- Total scene durations should add up to approximately the target duration
- Match the visual style to the requested style parameter
- Make the content professional, engaging, and high-quality
- Return ONLY the JSON object`;

/**
 * Exact LLM boundary used by the storyboard processing page. Keeping this core
 * dependency-injectable lets regression tests prove the route uses the shared
 * router instead of pinning a provider/model or constructing response_format.
 */
export async function generateVideoAgentScriptCore(
  { prompt, style, targetDuration }: GenerateScriptInput,
  generate: GenerateScript = routedGenerate,
) {
  const sceneCount = Math.min(8, Math.max(4, Math.round(targetDuration / 15)));
  const userMessage = `Video topic: ${prompt}
Visual style: ${style}
Target duration: ${targetDuration} seconds
Number of scenes: ${sceneCount}

Generate a complete professional video script with cinematic scene descriptions.`;

  const { output, provider, model } = await generate({
    system: SYSTEM_PROMPT,
    prompt: userMessage,
    schema: ScriptSchema,
    category: "SCRIPT_WRITING",
    routingMode: "modelark-free",
  });
  // Preserve the legacy title/scenes envelope while exposing truthful serving
  // metadata from the router for the storyboard UI.
  return { ...output, provider, model };
}

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

export const Route = createFileRoute("/api/video-agent/generate-script")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await authUserId(request);
        if (!userId) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          assertRateLimit(
            `video-agent-generate-script:${userId}`,
            SCRIPT_RATE_MAX_PER_WINDOW,
            SCRIPT_RATE_WINDOW_MS,
          );
        } catch (e) {
          if (e instanceof RateLimitError) {
            return new Response(JSON.stringify({ error: e.message }), {
              status: 429,
              headers: { "Content-Type": "application/json" },
            });
          }
          throw e;
        }

        let body: GenerateScriptRequest;
        try {
          body = GenerateScriptRequestSchema.parse(await request.json());
        } catch (err) {
          return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Invalid request" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const output = await generateVideoAgentScriptCore(body);
          // Attribution is written by the authenticated server route itself,
          // bound to the exact normalized script content. The browser never
          // gets to choose which provider/model is persisted.
          const { persistVideoAgentScriptAttribution } = await import("@/lib/video-agent-projects.functions");
          await persistVideoAgentScriptAttribution(body.projectId, userId, output);

          return new Response(JSON.stringify(output), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Script generation failed";
          return new Response(JSON.stringify({ error: msg }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
