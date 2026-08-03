import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeCost } from "./pricing";

const StyleSchema = z.enum(["cinematic", "minimal", "vibrant", "documentary"]);
const VoiceSchema = z.enum(["narrator-deep", "narrator-warm", "news-anchor", "conversational"]);
const SceneSchema = z.object({
  id: z.string().min(1).max(100),
  index: z.number().int().min(0).max(20),
  title: z.string().min(1).max(160),
  script: z.string().min(1).max(2400),
  description: z.string().min(1).max(3000),
  duration: z.number().min(3).max(15),
  frame: z.string().url().nullable().optional(),
  frameStatus: z.enum(["idle", "loading", "done", "error"]).optional(),
  voiceoverStatus: z.enum(["idle", "loading", "done", "error"]).optional(),
});

const ProjectInput = z.object({
  prompt: z.string().min(10).max(4000),
  title: z.string().min(1).max(160).default("Untitled Video"),
  style: StyleSchema.default("cinematic"),
  voice: VoiceSchema.default("narrator-warm"),
  targetDuration: z.number().int().min(15).max(120).default(60),
  scenes: z.array(SceneSchema).max(12).default([]),
});

type ProjectRow = {
  id: string;
  prompt: string;
  title: string;
  style: z.infer<typeof StyleSchema>;
  voice: z.infer<typeof VoiceSchema>;
  target_duration: number;
  scenes: unknown[];
  status: string;
  status_message: string;
  job_id: string | null;
  generation_id: string | null;
  export_url: string | null;
  thumbnail_url: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export const VIDEO_AGENT_RENDER_COST = computeCost({
  features: ["video", "audio"],
  model: "seedance-2.0-fast",
  durationSeconds: 5,
}).total;

function projectTable() {
  return supabaseAdmin.from("video_agent_projects") as unknown as {
    insert: (value: Record<string, unknown>) => { select: (columns: string) => { single: () => Promise<{ data: ProjectRow | null; error: { message: string } | null }> } };
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (column: string, options: { ascending: boolean }) => {
          limit: (count: number) => Promise<{ data: ProjectRow[] | null; error: { message: string } | null }>;
        };
        maybeSingle: () => Promise<{ data: ProjectRow | null; error: { message: string } | null }>;
      };
    };
    update: (value: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => { select: (columns: string) => { single: () => Promise<{ data: ProjectRow | null; error: { message: string } | null }> } };
      };
    };
  };
}

export function mapVideoAgentProject(row: ProjectRow) {
  return {
    id: row.id,
    prompt: row.prompt,
    title: row.title,
    style: row.style,
    voice: row.voice,
    targetDuration: row.target_duration,
    scenes: row.scenes,
    status: row.status,
    statusMessage: row.status_message,
    jobId: row.job_id,
    generationId: row.generation_id,
    exportUrl: row.export_url,
    thumbnailUrl: row.thumbnail_url,
    error: row.error,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export const createVideoAgentProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ProjectInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await projectTable()
      .insert({
        user_id: context.userId,
        prompt: data.prompt,
        title: data.title,
        style: data.style,
        voice: data.voice,
        target_duration: data.targetDuration,
        scenes: data.scenes,
        status: data.scenes.length ? "editing" : "draft",
        status_message: data.scenes.length ? "Storyboard ready to render" : "Planning storyboard",
      })
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Could not create project");
    return mapVideoAgentProject(row);
  });

export const listVideoAgentProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await projectTable()
      .select("*")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapVideoAgentProject);
  });

export const getVideoAgentProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await projectTable()
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Project not found");
    return mapVideoAgentProject(row);
  });

export const updateVideoAgentProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(160).optional(),
    scenes: z.array(SceneSchema).max(12).optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.scenes !== undefined) patch.scenes = data.scenes;
    if (!Object.keys(patch).length) return getVideoAgentProject({ data: { id: data.id } });
    const { data: row, error } = await projectTable()
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Could not update project");
    return mapVideoAgentProject(row);
  });

export const enqueueVideoAgentRender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: project, error: projectError } = await projectTable()
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (projectError || !project) throw new Error(projectError?.message ?? "Project not found");
    const scenes = z.array(SceneSchema).min(1).max(12).parse(project.scenes);
    if (project.job_id && ["queued", "processing"].includes(project.status)) {
      return { jobId: project.job_id, generationId: project.generation_id, cost: VIDEO_AGENT_RENDER_COST };
    }

    const payload = {
      kind: "video_agent_render",
      projectId: project.id,
      prompt: project.prompt,
      title: project.title,
      style: project.style,
      voice: project.voice,
      targetDuration: project.target_duration,
      scenes,
    };
    const client = supabaseAdmin as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: result, error } = await client.rpc("create_generation_and_reserve", {
      _user: context.userId,
      _kind: "video",
      _prompt: project.prompt,
      _amount: VIDEO_AGENT_RENDER_COST,
      _payload: payload,
    });
    if (error) {
      if (/insufficient_credits/i.test(error.message)) throw new Error("Not enough Aura to render this video");
      throw new Error(error.message);
    }
    const row = (Array.isArray(result) ? result[0] : result) as { job_id: string; generation_id: string };
    const { error: updateError } = await projectTable()
      .update({
        job_id: row.job_id,
        generation_id: row.generation_id,
        status: "queued",
        status_message: "Render queued — you can safely leave this page",
        export_url: null,
        error: null,
      })
      .eq("id", project.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (updateError) throw new Error(`Render queued, but project status could not be updated: ${updateError.message}`);
    return { jobId: row.job_id, generationId: row.generation_id, cost: VIDEO_AGENT_RENDER_COST };
  });