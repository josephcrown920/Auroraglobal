import { supabase } from "@/integrations/supabase/client";
import type { UntypedDb } from "@/integrations/supabase/untyped";

export const RENDER_MODELS = [
  { id: "seedance-2.5", label: "Seedance 2.5 (GPU worker)" },
  { id: "ltx-video", label: "LTX Video (GPU worker)" },
  { id: "ltx-2", label: "LTX-2 (GPU worker)" },
] as const;

export type RenderJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  model: string;
  prompt: string;
  output_url: string | null;
  error: string | null;
  worker_id: string | null;
  created_at: string;
};

// The generated Supabase types are refreshed separately; cast at the boundary.
const db = supabase as unknown as UntypedDb;

export async function queueRenderJob(input: {
  boardId: string;
  shotId: string;
  model: string;
  prompt: string;
  inputImageUrl?: string | null;
  params?: Record<string, unknown>;
}): Promise<RenderJob> {
  const { data, error } = await db
    .from("render_jobs")
    .insert({
      board_id: input.boardId,
      shot_id: input.shotId,
      kind: "video",
      model: input.model,
      prompt: input.prompt,
      input_image_url: input.inputImageUrl ?? null,
      params: input.params ?? {},
      status: "queued",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as RenderJob;
}

export async function getRenderJob(id: string): Promise<RenderJob | null> {
  const { data, error } = await db.from("render_jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as RenderJob) ?? null;
}

export async function listRenderJobs(boardId: string): Promise<RenderJob[]> {
  const { data, error } = await db
    .from("render_jobs")
    .select("*")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RenderJob[];
}

export async function listWorkers() {
  const { data, error } = await db
    .from("gpu_workers")
    .select("*")
    .order("last_seen_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as {
    id: string;
    name: string;
    gpu: string | null;
    models: string[];
    status: string;
    last_seen_at: string;
  }[];
}
