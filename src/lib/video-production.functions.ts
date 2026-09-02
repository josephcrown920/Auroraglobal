import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { applyProductionInstruction, createProductionBrain, loadProductionBrain, saveProductionBrain } from "./video-production-brain.server";
import { ProductionBrainSchema } from "./video-production-brain";

const ProjectId = z.string().uuid();
const CreateInput = z.object({
  projectId: ProjectId,
  name: z.string().max(120).optional(),
  brief: z.string().trim().min(4).max(8000),
  objective: z.string().max(2000).optional(),
  audience: z.string().max(1000).optional(),
  emotionalGoal: z.string().max(1000).optional(),
  durationSeconds: z.number().positive().max(3600).optional(),
  aspectRatios: z.array(z.string().max(20)).max(8).optional(),
});

export const createVideoProduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(({ data, context }) => createProductionBrain({ ...data, userId: context.userId }));

export const getVideoProduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: ProjectId }).parse(d))
  .handler(async ({ data, context }) => {
    const brain = await loadProductionBrain(data.projectId, context.userId);
    if (!brain) throw new Error("Production project not found");
    return brain;
  });

export const saveVideoProduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: ProjectId, brain: ProductionBrainSchema }).parse(d))
  .handler(({ data, context }) => saveProductionBrain(data.projectId, context.userId, data.brain));

export const applyVideoProductionInstruction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: ProjectId, instruction: z.string().trim().min(2).max(4000) }).parse(d))
  .handler(({ data, context }) => applyProductionInstruction(data.projectId, context.userId, data.instruction));
