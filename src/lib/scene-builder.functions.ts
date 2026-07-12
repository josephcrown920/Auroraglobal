import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildSceneBuilderPrompt,
  RE_ANGLE_CHIPS,
  SCENE_BUILDER_COST_PER_ANGLE,
} from "@/lib/scene-builder.templates";

const MODEL = "google/gemini-3.1-flash-image-preview";

const SceneBuilderSchema = z.object({
  referenceUrls: z.array(z.string().url()).min(1).max(5),
  compositorPrompt: z.string().min(10).max(2000),
  selectedAngles: z.array(z.string()).min(1).max(6),
});

export type SceneBuilderResult = {
  angleId: string;
  label: string;
  status: "succeeded" | "failed";
  url?: string;
  generationId?: string;
  error?: string;
};

export const generateSceneBuilder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SceneBuilderSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ results: SceneBuilderResult[] }> => {
    const { userId } = context;
    const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");

    const angles = RE_ANGLE_CHIPS.filter((a) => data.selectedAngles.includes(a.id));

    const settled = await Promise.allSettled(
      angles.map((angle) =>
        reserveOrchestrateRecord({
          userId,
          kind: "image",
          prompt: `[Scene Builder / ${angle.label}]\n\n${buildSceneBuilderPrompt(data.compositorPrompt, angle)}`,
          model: MODEL,
          imageUrls: data.referenceUrls,
          cost: SCENE_BUILDER_COST_PER_ANGLE,
          reason: "scene_builder",
        }),
      ),
    );

    const results: SceneBuilderResult[] = settled.map((outcome, i) => {
      const angle = angles[i];
      const meta = { angleId: angle.id, label: angle.label };
      if (outcome.status === "rejected") {
        const error =
          outcome.reason instanceof Error ? outcome.reason.message : "Render failed";
        return { ...meta, status: "failed", error };
      }
      const r = outcome.value;
      if (!r.ok) return { ...meta, status: "failed", error: r.error };
      return {
        ...meta,
        status: "succeeded",
        url: r.url,
        generationId: r.generationId,
      };
    });

    return { results };
  });
