import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  SCENE_BUILDER_COST_BASE,
  SCENE_BUILDER_COST_REANGLE,
  RE_ANGLE_CHIPS,
  buildReAnglePrompt,
} from "@/lib/scene-builder.templates";

const MODEL = "google/gemini-3.1-flash-image-preview";

// ─── Generate base scene ──────────────────────────────────────────────────────
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

// ─── Re-angle generation ──────────────────────────────────────────────────────
// Each submitted angle uses the BASE SCENE image (not the 5 original refs) as
// the reference — this locks the composited scene and only changes camera angle.

const ReAngleSchema = z.object({
  baseImageUrl: z.string().url(),
  /** Chip ids from RE_ANGLE_CHIPS and/or a single freeform text description. */
  chipIds: z.array(z.string()),
  freeform: z.string().max(300).optional(),
});

export type ReAngleResult = {
  id: string;
  label: string;
  status: "succeeded" | "failed";
  url?: string;
  generationId?: string;
  error?: string;
};

export const generateReAngles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReAngleSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ results: ReAngleResult[] }> => {
    const { userId } = context;
    const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");

    // Build the list of (id, label, cameraPrompt) pairs to dispatch
    type AngleTask = { id: string; label: string; cameraPrompt: string };
    const tasks: AngleTask[] = [];

    for (const chipId of data.chipIds) {
      const chip = RE_ANGLE_CHIPS.find((c) => c.id === chipId);
      if (chip) tasks.push(chip);
    }
    if (data.freeform?.trim()) {
      tasks.push({ id: "custom", label: "Custom Angle", cameraPrompt: data.freeform.trim() });
    }
    if (tasks.length === 0) {
      return { results: [] };
    }

    // Enqueue all angles in parallel (enqueueBatch pattern from /colors)
    const settled = await Promise.allSettled(
      tasks.map((t) =>
        reserveOrchestrateRecord({
          userId,
          kind: "image",
          prompt: `[Scene Builder / ${t.label}]\n\n${buildReAnglePrompt(t.cameraPrompt)}`,
          model: MODEL,
          imageUrls: [data.baseImageUrl],
          cost: SCENE_BUILDER_COST_REANGLE,
          reason: "scene_builder_reangle",
        }),
      ),
    );

    const results: ReAngleResult[] = settled.map((outcome, i) => {
      const task = tasks[i];
      const meta = { id: task.id, label: task.label };
      if (outcome.status === "rejected") {
        const error =
          outcome.reason instanceof Error ? outcome.reason.message : "Render failed";
        return { ...meta, status: "failed", error };
      }
      const r = outcome.value;
      if (!r.ok) return { ...meta, status: "failed", error: r.error };
      return { ...meta, status: "succeeded", url: r.url, generationId: r.generationId };
    });

    return { results };
  });
