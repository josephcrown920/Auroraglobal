import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SCENE_BUILDER_COST_BASE } from "@/lib/scene-builder.templates";

const MODEL = "google/gemini-3.1-flash-image-preview";

// ─── Generate base scene (synchronous / blocking) ─────────────────────────────
// The base scene is a single shot the user must see before triggering re-angles,
// so it uses the synchronous reserveOrchestrateRecord pipeline.
const BaseSceneSchema = z.object({
  referenceUrls: z.array(z.string().url()).min(1).max(5),
  compositorPrompt: z.string().min(10).max(3000),
});

export type BaseSceneOutcome =
  | { ok: true; url: string; generationId: string }
  | { ok: false; error: string };

export const generateBaseScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BaseSceneSchema.parse(input))
  .handler(async ({ data, context }): Promise<BaseSceneOutcome> => {
    const { userId } = context;
    const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");

    const result = await reserveOrchestrateRecord({
      userId,
      kind: "image",
      prompt: `[Scene Builder / Base Scene]\n\n${data.compositorPrompt}`,
      model: MODEL,
      imageUrls: data.referenceUrls,
      cost: SCENE_BUILDER_COST_BASE,
      reason: "scene_builder_base",
    });

    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, url: result.url, generationId: result.generationId };
  });

// ─── Re-angle enqueuing ───────────────────────────────────────────────────────
// Re-angles are multi-shot bulk operations. They are enqueued via
// generatePerformanceShot (the same reserveGenerationJob / create_generation_and_reserve
// path used by /colors bulk modes) so they survive the user navigating away.
// The client calls generatePerformanceShot directly for each angle — no server
// fn needed here for re-angles.
