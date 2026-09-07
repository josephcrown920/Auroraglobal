import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeCost } from "./pricing";
import {
  NBA_JOSH_DURATION_SECONDS,
  NBA_JOSH_STILL_MODEL,
  NBA_JOSH_VIDEO_MODEL,
  NbaJoshProductionSchema,
  defaultNbaJoshProduction,
  nbaJoshPlanHash,
  quoteNbaJoshPreview,
  quoteNbaJoshStill,
  quoteNbaJoshVideo,
  refreshNbaJoshQuotes,
  resetNbaJoshOutfit,
  validateNbaJoshProduction,
  type NbaJoshProduction,
} from "./nba-josh-production";

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
  videoUrl: z.string().url().nullable().optional(),
  voiceoverStatus: z.enum(["idle", "loading", "done", "error"]).optional(),
  purpose: z.enum(["establishing", "context", "character", "reaction", "detail", "insert", "payoff"]).optional(),
  shotType: z.string().max(80).optional(),
  lensMm: z.number().min(1).max(1000).optional(),
  camera: z.string().max(1000).optional(),
  lighting: z.string().max(1000).optional(),
  modelPrompt: z.string().max(4000).optional(),
  negativePrompt: z.string().max(2000).optional(),
  continuityNote: z.string().max(1500).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3", "2.39:1", "21:9"]).optional(),
  visualDirection: z.string().max(1000).optional(),
  plateQuality: z.enum(["free", "premium"]).optional(),
  plateGenerationId: z.string().max(160).nullable().optional(),
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
  production: unknown;
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
    select: (columns: string) => {
      single: () => SingleResult;
      maybeSingle: () => SingleResult;
    };
  };
};

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
  return parsed.success ? parsed.data : [];
}

function parseProduction(value: unknown): NbaJoshProduction | null {
  if (!value) return null;
  const candidate =
    typeof value === "object" && value !== null && !("scene" in value)
      ? { ...value as Record<string, unknown>, scene: defaultNbaJoshProduction().scene }
      : value;
  const parsed = NbaJoshProductionSchema.safeParse(candidate);
  return parsed.success ? refreshNbaJoshQuotes(parsed.data) : null;
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
    production: parseProduction(row.production),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    version: row.updated_at,
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
        scenes: data.scenes.map((scene) => ({
          ...scene,
          frame: null,
          frameStatus: "idle",
          videoUrl: null,
          plateQuality: undefined,
          plateGenerationId: null,
        })),
        status: data.scenes.length ? "editing" : "draft",
        status_message: data.scenes.length ? "Storyboard ready to render" : "Planning storyboard",
      })
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Could not create project");
    return mapVideoAgentProject(row);
  });

export const createNbaJoshProductionProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const production = defaultNbaJoshProduction();
    const { data: row, error } = await projectTable()
      .insert({
        user_id: context.userId,
        prompt:
          "NBA Josh stands calm in the foreground while aggressive officers run endlessly behind him. He glances, smirks, and walks away.",
        title: "Looping Officers",
        style: "cinematic",
        voice: "narrator-warm",
        target_duration: NBA_JOSH_DURATION_SECONDS,
        scenes: [],
        production,
        status: "editing",
        status_message: "Production plan ready for asset review",
      })
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Could not create NBA Josh project");
    return mapVideoAgentProject(row);
  });

export const createNbaJoshCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ count: z.number().int().min(1).max(50) }).parse(data))
  .handler(async ({ data, context }) => {
    const campaignId = crypto.randomUUID().slice(0, 8).toUpperCase();
    const projects: VideoAgentProjectDto[] = [];
    for (let index = 0; index < data.count; index++) {
      const production = defaultNbaJoshProduction();
      const title = `The One · ${String(index + 1).padStart(2, "0")}/${String(data.count).padStart(2, "0")}`;
      const { data: row, error } = await projectTable()
        .insert({
          user_id: context.userId,
          prompt: "The One campaign: a lead artist stays calm in the foreground while officers sprint intensely behind them without ever closing the distance.",
          title,
          style: "cinematic",
          voice: "narrator-warm",
          target_duration: NBA_JOSH_DURATION_SECONDS,
          scenes: [],
          production,
          status: "editing",
          status_message: `Campaign ${campaignId} · production plan ready for asset review`,
        })
        .select("*")
        .single();
      if (error || !row) throw new Error(`Campaign draft ${index + 1} could not be created: ${error?.message ?? "unknown error"}`);
      projects.push(mapVideoAgentProject(row));
    }
    return { campaignId, projects };
  });

export const listVideoAgentProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await projectTable().select("*").eq("user_id", context.userId).order("updated_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapVideoAgentProject);
  });

export const getVideoAgentProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => mapVideoAgentProject(await fetchOwnedProject(data.id, context.userId)));

export const updateVideoAgentProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(160).optional(),
    scenes: SceneListSchema.max(12).optional(),
    production: NbaJoshProductionSchema.optional(),
    expectedVersion: z.string().min(1).max(64).optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const current = await fetchOwnedProject(data.id, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.scenes !== undefined) {
      if (current.status === "queued" || current.status === "processing") throw new Error("The storyboard is locked while a render is in progress");
      const currentScenes = parseScenes(current.scenes);
      patch.scenes = data.scenes.map((scene) => {
        const previous = currentScenes.find((item) => item.id === scene.id);
        return {
          ...scene,
          frame: previous?.frame ?? null,
          frameStatus: previous?.frameStatus ?? "idle",
          videoUrl: previous?.videoUrl ?? null,
          plateQuality: previous?.plateQuality,
          plateGenerationId: previous?.plateGenerationId ?? null,
        };
      });
      if (current.status === "draft" || current.status === "editing") {
        patch.status = data.scenes.length ? "editing" : "draft";
        patch.status_message = data.scenes.length ? "Storyboard ready to render" : "Planning storyboard";
      }
    }
    if (data.production !== undefined) {
      if (current.status === "queued" || current.status === "processing") throw new Error("The production plan is locked while a render is in progress");
      const next = validateNbaJoshProduction(data.production);
      const previous = parseProduction(current.production);
      if (previous && nbaJoshPlanHash(previous) !== nbaJoshPlanHash(next)) {
        patch.production = { ...next, revision: previous.revision + 1, outfits: next.outfits.map(resetNbaJoshOutfit) };
        patch.status = "editing";
        patch.status_message = "Production changed — approvals need to be renewed";
        patch.job_id = null;
        patch.generation_id = null;
        patch.export_url = null;
        patch.error = null;
      } else patch.production = next;
    }
    if (!Object.keys(patch).length) return mapVideoAgentProject(current);
    let update = projectTable().update(patch).eq("id", data.id).eq("user_id", context.userId);
    if (data.expectedVersion) update = update.eq("updated_at", data.expectedVersion);
    const { data: row, error } = data.expectedVersion ? await update.select("*").maybeSingle() : await update.select("*").single();
    if (!row && data.expectedVersion && !error) throw new Error("This project changed in another request. Reloaded the latest version; please repeat your edit.");
    if (error || !row) throw new Error(error?.message ?? "Could not update project");
    return mapVideoAgentProject(row);
  });

const NbaJoshActionInput = z.object({ projectId: z.string().uuid(), outfitId: z.string().min(1).max(80), planHash: z.string().min(1).max(40) });

async function fetchNbaJoshProject(id: string, userId: string) {
  const row = await fetchOwnedProject(id, userId);
  const production = parseProduction(row.production);
  if (!production || production.template !== "nba-josh-looping-officers") throw new Error("This project is not an NBA Josh production");
  return { row, production };
}

function findNbaJoshOutfit(plan: NbaJoshProduction, outfitId: string) {
  const item = plan.outfits.find((outfit) => outfit.id === outfitId);
  if (!item) throw new Error("Outfit not found in this production");
  return item;
}

function assertCurrentPlanHash(plan: NbaJoshProduction, supplied: string) {
  if (nbaJoshPlanHash(plan) !== supplied) throw new Error("This production changed. Refresh, review, and approve the current plan.");
}

async function assertOwnedGenerationAssets(plan: NbaJoshProduction, outfit: NbaJoshProduction["outfits"][number], userId: string) {
  const identity = plan.identityRefs.filter((ref) => ref.source === "user-upload" && ref.generationUrl);
  const wardrobe = outfit.refs.filter((ref) => ref.source === "user-upload" && ref.generationUrl);
  if (!identity.length || !wardrobe.length) throw new Error("Upload at least one identity reference and one wardrobe reference for this outfit before generating");
  const scene = plan.scene.reference?.source === "user-upload" && plan.scene.reference.generationUrl ? [plan.scene.reference] : [];
  const refs = [...identity, ...wardrobe, ...scene];
  const { assertOwnedReferenceImage } = await import("./url-guard");
  for (const ref of refs) await assertOwnedReferenceImage(ref.generationUrl!, userId);
  return refs.map((ref) => ref.generationUrl!);
}

async function persistProduction(projectId: string, userId: string, production: NbaJoshProduction, statusMessage: string) {
  const { error } = await projectTable().update({ production, status: "editing", status_message: statusMessage }).eq("id", projectId);
  if (error) throw new Error(error.message);
}
