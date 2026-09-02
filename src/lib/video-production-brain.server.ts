import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildInitialBrain, planChange, ProductionBrainSchema, recordInstruction, type ProductionBrain } from "./video-production-brain";

export async function loadProductionBrain(projectId: string, userId: string): Promise<ProductionBrain | null> {
  const { data, error } = await supabaseAdmin.from("video_production_projects").select("brain").eq("id", projectId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`Failed to load production brain: ${error.message}`);
  return data?.brain ? ProductionBrainSchema.parse(data.brain) : null;
}

export async function createProductionBrain(input: { projectId: string; userId: string; name?: string; brief: string; objective?: string; audience?: string; emotionalGoal?: string; durationSeconds?: number; aspectRatios?: string[] }): Promise<ProductionBrain> {
  const brain = buildInitialBrain(input);
  const { error } = await supabaseAdmin.from("video_production_projects").insert({ id: input.projectId, user_id: input.userId, name: input.name ?? "Untitled production", brain, version: 1 });
  if (error) throw new Error(`Failed to create production brain: ${error.message}`);
  return brain;
}

export async function saveProductionBrain(projectId: string, userId: string, brain: ProductionBrain): Promise<ProductionBrain> {
  const parsed = ProductionBrainSchema.parse(brain);
  const { data, error } = await supabaseAdmin.from("video_production_projects").update({ brain: parsed, version: parsed.history.length + 1 }).eq("id", projectId).eq("user_id", userId).select("brain").single();
  if (error) throw new Error(`Failed to save production brain: ${error.message}`);
  return ProductionBrainSchema.parse(data.brain);
}

export async function applyProductionInstruction(projectId: string, userId: string, instruction: string) {
  const brain = await loadProductionBrain(projectId, userId);
  if (!brain) throw new Error("Production project not found");
  const impact = planChange(brain, instruction);
  const next = recordInstruction(brain, instruction, impact);
  return { brain: await saveProductionBrain(projectId, userId, next), impact };
}
