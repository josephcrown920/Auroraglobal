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
const SceneListSchema = z.array(SceneSchema);
type SceneRecord = z.infer<typeof SceneSchema>;

const ProjectInput = z.object({
  prompt: z.string().min(10).max(4000),
  title: z.string().min(1).max(160).default("Untitled Video"),
  style: StyleSchema.default("cinematic"),
  voice: VoiceSchema.default("narrator-warm"),
  targetDuration: z.number().int().min(15).max(120).default(60),
  scenes: SceneListSchema.max(12).default([]),
});

type ProjectRow = {
  id: string;
  prompt: string;
  title: string;
  style: z.infer<typeof StyleSchema>;
  voice: z.infer<typeof VoiceSchema>;
  target_duration: number;
  scenes: unknown;
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

type SingleResult = Promise<{ data: ProjectRow | null; error: { message: string } | null }>;
type ListResult = Promise<{ data: ProjectRow[] | null; error: { message: string } | null }>;

type ProjectSelectChain = {
  eq: (column: string, value: string) => ProjectSelectChain;
  order: (column: string, options: { ascending: boolean }) => { limit: (count: number) => ListResult };
  maybeSingle: () => SingleResult;
};

type ProjectUpdateChain = {
  eq: (column: string, value: string) => ProjectUpdateChain & {
    select: (columns: string) => { single: () => SingleResult };
  };
};

/**
 * `video_agent_projects` is newer than the generated Supabase types, so the
 * table access goes through a narrow structural type until types.ts is
 * regenerated. Every accessor still scopes by user_id — RLS is a second fence,
 * not the only one.
 */
function projectTable() {
  const client = supabaseAdmin as unknown as {
    from: (table: string) => {
      insert: (value: Record<string, unknown>) => {
        select: (columns: string) => { single: () => SingleResult };
      };
      select: (columns: string) => ProjectSelectChain;
      update: (value: Record<string, unknown>) => ProjectUpdateChain;
    };
  };
  return client.from("video_agent_projects");
}

function parseScenes(value: unknown): SceneRecord[] {
  const parsed = SceneListSchema.safeParse(value ?? []);
  // Rows are always written through SceneSchema-validated inputs, so a parse
  // failure means a manually-corrupted row; surface it as an empty storyboard
  // rather than bricking the whole project list.
  return parsed.success ? parsed.data : [];
}

export type VideoAgentProjectDto = ReturnType<typeof mapVideoAgentProject>;

export function mapVideoAgentProject(row: ProjectRow) {
  return {
    id: row.id,
    prompt: row.prompt,
    title: row.title,
    style: row.style,
    voice: row.voice,
    targetDuration: row.target_duration,
    scenes: parseScenes(row.scenes),
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

async function fetchOwnedProject(id: string, userId: string) {
  const { data: row, error } = await projectTable()
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Project not found");
  return row;
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
    const row = await fetchOwnedProject(data.id, context.userId);
    return mapVideoAgentProject(row);
  });

export const updateVideoAgentProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(160).optional(),
    scenes: SceneListSchema.max(12).optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const current = await fetchOwnedProject(data.id, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.scenes !== undefined) {
      // The queued/processing render consumed a snapshot of this storyboard;
      // silently mutating it mid-render would make the delivered MP4 look
      // wrong ("that's not what I approved"). Editing re-opens after the job
      // reaches a terminal state.
      if (current.status === "queued" || current.status === "processing") {
        throw new Error("The storyboard is locked while a render is in progress");
      }
      patch.scenes = data.scenes;
      // Storyboard edits move a draft into the editable state, but never
      // clobber a terminal render status (succeeded/failed keep showing the
      // last render result until a re-render is queued).
      if (current.status === "draft" || current.status === "editing") {
        patch.status = data.scenes.length ? "editing" : "draft";
        patch.status_message = data.scenes.length
          ? "Storyboard ready to render"
          : "Planning storyboard";
      }
    }
    if (!Object.keys(patch).length) return mapVideoAgentProject(current);
    const { data: row, error } = await projectTable()
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Could not update project");
    return mapVideoAgentProject(row);
  });

// ─── Previs Pro: upgrade one scene's plate to a premium paid render ──────────
// The storyboard frames are free Pollinations sketches. "Upgrade plate" takes a
// single scene's visual description and re-renders it through the real paid
// image pipeline (canonical reserveOrchestrateRecord flow) for a hero-quality
// previsualization plate. The scene description is read from STORED project
// state (never a client body) so a crafted request cannot inject a prompt.
export const PREVIS_PLATE_COST = computeCost({ features: ["image"] }).total;

const previsStyleHints: Record<z.infer<typeof StyleSchema>, string> = {
  cinematic: "cinematic anamorphic, 35mm film grain, hyper-realistic",
  minimal: "clean minimal, soft light, hyper-realistic",
  vibrant: "vibrant, bold, energetic, hyper-realistic",
  documentary: "natural light, candid, hyper-realistic",
};

export const upgradeVideoAgentPlate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), sceneId: z.string().min(1).max(100) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const project = await fetchOwnedProject(data.id, context.userId);
    if (project.status === "queued" || project.status === "processing") {
      throw new Error("The storyboard is locked while a render is in progress");
    }
    const scenes = parseScenes(project.scenes);
    const scene = scenes.find((s) => s.id === data.sceneId);
    if (!scene) throw new Error("Scene not found in this project");
    if (!scene.description.trim()) throw new Error("Add a visual description before upgrading the plate");

    const styleHint = previsStyleHints[project.style] ?? previsStyleHints.cinematic;
    const prompt = `${scene.description}. Style: ${styleHint}. Cinematic keyframe.`;

    const { reserveOrchestrateRecord } = await import("./generate-core.server");
    let outcome;
    try {
      outcome = await reserveOrchestrateRecord({
        userId: context.userId,
        kind: "image",
        prompt,
        cost: PREVIS_PLATE_COST,
        reason: "video_agent_previs_plate",
        mode: "preview",
      });
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Plate upgrade failed");
    }
    if (!outcome.ok) {
      if (outcome.insufficient) throw new Error("Not enough Aura to upgrade this plate");
      throw new Error(outcome.error);
    }

    // Persist the upgraded frame onto the scene so it survives reloads and feeds
    // the real render. Only mutate this one scene's frame; leave the rest intact.
    const nextScenes = scenes.map((s) => (s.id === data.sceneId ? { ...s, frame: outcome!.url, frameStatus: "done" as const } : s));
    await projectTable()
      .update({ scenes: nextScenes })
      .eq("id", project.id)
      .eq("user_id", context.userId)
      .select("id")
      .single();

    return { sceneId: data.sceneId, url: outcome.url, generationId: outcome.generationId, provider: outcome.provider, cost: PREVIS_PLATE_COST };
  });

export const enqueueVideoAgentRender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const project = await fetchOwnedProject(data.id, context.userId);
    const scenes = SceneListSchema.min(1).max(12).parse(project.scenes);
    if (project.job_id && ["queued", "processing"].includes(project.status)) {
      return { jobId: project.job_id, generationId: project.generation_id, cost: VIDEO_AGENT_RENDER_COST };
    }

    // Idempotency: if a previous enqueue reserved + created the job but the
    // project-row update afterwards failed, the row still looks unqueued while
    // an active job (and its reservation) already exists. Adopt that job
    // instead of reserving a second time — double-charging is worse than a
    // stale status message (the runner overwrites the row when it claims).
    const jobsClient = supabaseAdmin as unknown as {
      from: (t: "jobs") => {
        select: (c: string) => {
          eq: (col: string, val: string) => {
            eq: (col: string, val: string) => {
              eq: (col: string, val: string) => {
                in: (col: string, vals: string[]) => {
                  order: (col: string, o: { ascending: boolean }) => {
                    limit: (n: number) => Promise<{
                      data: Array<{ id: string; generation_id: string | null }> | null;
                      error: { message: string } | null;
                    }>;
                  };
                };
              };
            };
          };
        };
      };
    };
    const { data: activeJobs } = await jobsClient
      .from("jobs")
      .select("id, generation_id")
      .eq("kind", "video_agent_render")
      .eq("user_id", context.userId)
      .eq("payload->>projectId", project.id)
      .in("status", ["queued", "processing"])
      .order("created_at", { ascending: false })
      .limit(1);
    const existing = activeJobs?.[0];
    if (existing) {
      await projectTable()
        .update({
          job_id: existing.id,
          generation_id: existing.generation_id,
          status: "queued",
          status_message: "Render queued — you can safely leave this page",
          export_url: null,
          error: null,
        })
        .eq("id", project.id)
        .eq("user_id", context.userId)
        .select("id")
        .single();
      return { jobId: existing.id, generationId: existing.generation_id, cost: VIDEO_AGENT_RENDER_COST };
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
    if (updateError) {
      // NON-fatal: the reservation + job already exist, so throwing here would
      // make the client believe nothing was charged and invite a retry (and a
      // double reserve). The adoption lookup above also covers a re-click, and
      // the runner rewrites the row as soon as it claims the job.
      console.error(
        `[video-agent] job ${row.job_id} enqueued but project ${project.id} status update failed: ${updateError.message}`,
      );
    }
    return { jobId: row.job_id, generationId: row.generation_id, cost: VIDEO_AGENT_RENDER_COST };
  });
