import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { reserveOrchestrateRecord } from "@/lib/generate-core.server";
import { computeCost } from "@/lib/pricing";

const InputSchema = z.object({
  projectId: z.string().uuid(),
  sceneId: z.string().min(1).max(100),
  model: z.string().max(120).default("seedance-2.0-fast"),
});

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

function pollinationsFrameUrl(prompt: string, aspect: string | undefined): string {
  const [width, height] = aspect === "9:16" ? [576, 1024] : aspect === "1:1" ? [768, 768] : [896, 504];
  const encoded = encodeURIComponent(prompt.slice(0, 500));
  const seed = Math.floor(Math.random() * 999999);
  return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true&enhance=false&seed=${seed}`;
}

async function authenticate(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  if (!token) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

export const Route = createFileRoute("/api/video-agent/render-shot")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }),
      POST: async ({ request }) => {
        const userId = await authenticate(request);
        if (!userId) return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401, headers: CORS });

        try {
          const input = InputSchema.parse(await request.json());
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: project, error } = await supabaseAdmin
            .from("video_agent_projects")
            .select("id, scenes, status, updated_at")
            .eq("id", input.projectId)
            .eq("user_id", userId)
            .maybeSingle();
          if (error) throw new Error(error.message);
          if (!project) throw new Error("Video Agent project not found");
          if (project.status === "queued" || project.status === "processing") throw new Error("The storyboard is locked while a render is in progress");

          const scenes = Array.isArray(project.scenes) ? project.scenes as Array<Record<string, unknown>> : [];
          const scene = scenes.find((item) => item.id === input.sceneId);
          if (!scene) throw new Error("Scene not found");
          const prompt = String(scene.modelPrompt ?? scene.description ?? "").trim();
          if (!prompt) throw new Error("Scene has no visual prompt");

          const frame = typeof scene.frame === "string" && scene.frame.length > 0
            ? scene.frame
            : pollinationsFrameUrl(prompt, typeof scene.aspectRatio === "string" ? scene.aspectRatio : undefined);
          const camera = typeof scene.camera === "string" ? `Camera: ${scene.camera}.` : "";
          const lighting = typeof scene.lighting === "string" ? `Lighting: ${scene.lighting}.` : "";
          const negative = typeof scene.negativePrompt === "string" ? `Avoid: ${scene.negativePrompt}.` : "";
          const durationRaw = Number(scene.duration ?? 5);
          const duration = Math.max(3, Math.min(10, Number.isFinite(durationRaw) ? Math.round(durationRaw) : 5));
          const cost = computeCost({ features: ["video"], model: input.model, durationSeconds: duration }).total;

          const outcome = await reserveOrchestrateRecord({
            userId,
            kind: "video",
            model: input.model,
            prompt: [prompt, camera, lighting, "Animate the supplied storyboard image as the shot's visual starting point. Preserve the subject, wardrobe, environment and composition. Natural motion only; no text overlays.", negative].filter(Boolean).join(" "),
            imageUrls: [frame],
            duration,
            forSubscriber: true,
            cost,
            reason: "video_agent_storyboard_shot",
          });

          if (!outcome.ok) return new Response(JSON.stringify({ ok: false, error: outcome.error, insufficient: outcome.insufficient }), { status: 402, headers: CORS });

          const nextScenes = scenes.map((item) => item.id === input.sceneId
            ? { ...item, frame, frameStatus: "done", videoUrl: outcome.url }
            : item);
          const { error: saveError } = await supabaseAdmin
            .from("video_agent_projects")
            .update({ scenes: nextScenes, status_message: `${String(scene.title ?? "Scene")} animated shot ready` })
            .eq("id", project.id)
            .eq("user_id", userId)
            .eq("updated_at", project.updated_at);
          if (saveError) throw new Error(`Video rendered but could not be saved: ${saveError.message}`);

          return new Response(JSON.stringify({ ok: true, url: outcome.url, generationId: outcome.generationId, provider: outcome.provider, frame, cost }), { headers: CORS });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return new Response(JSON.stringify({ ok: false, error: message }), { status: 400, headers: CORS });
        }
      },
    },
  },
});
