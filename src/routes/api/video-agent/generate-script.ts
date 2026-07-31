import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateWithFallback } from "@/lib/llm-fallback.server";

const SceneSchema = z.object({
  index: z.number(),
  title: z.string(),
  script: z.string(),
  description: z.string(),
  duration: z.number(),
});

const ScriptSchema = z.object({
  title: z.string(),
  scenes: z.array(SceneSchema).min(1),
});

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

export const Route = createFileRoute("/api/video-agent/generate-script")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          prompt: string;
          style: string;
          voice: string;
          targetDuration: number;
        };

        const { prompt, style, targetDuration } = body;

        if (!prompt || typeof prompt !== "string") {
          return new Response("Missing prompt", { status: 400 });
        }

        const sceneCount = Math.max(4, Math.round(targetDuration / 15));
        const userMessage = `Video topic: ${prompt}
Visual style: ${style}
Target duration: ${targetDuration} seconds
Number of scenes: ${sceneCount}

Generate a complete professional video script with cinematic scene descriptions.`;

        try {
          const { output } = await generateWithFallback({
            system: SYSTEM_PROMPT,
            prompt: userMessage,
            schema: ScriptSchema,
          });

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
