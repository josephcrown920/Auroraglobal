// Aurora MCP tool implementations, wired into THIS app's real backend.
//
// - Single items (generate_video, image_to_video) self-POST to the synchronous
//   /api/public/generate endpoint with the caller's bearer token, so all credit
//   reservation, SSRF guarding and audit logging happen in one place. The result
//   URL is returned directly (no polling).
// - bulk_generate enqueues onto the existing public.jobs queue via the
//   create_generation_and_reserve RPC (atomic credit reservation + generations
//   row + job row); the jobs/tick worker renders them. Returns job IDs.

import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { selectVideoModel, inferAspectRatio } from "./model-selector";
import { listAvatars, getAvatarByName, createAvatar, type CreateAvatarInput } from "./avatars.server";
import { hasActiveWorkerForKind, type GenerateKind } from "@/lib/orchestrator.server";
import { buildMimicMotionRequest, MOTION_TYPES, CAMERA_MOVEMENTS } from "@/lib/motion-workflows.server";
import { assertTrustedUrl } from "@/lib/url-guard";
import { COST_UGC_AD, COST_CAMPAIGN_ITEM, buildCampaignVariations } from "@/lib/ugc.server";
import { computeCost } from "@/lib/pricing";

// MCP motion tools must charge the SAME Aura as the in-app Transfer Motion /
// Performance Shot buttons (studio.functions.ts routes both through computeCost
// at the 5s/720p reference), so the MCP surface can never undercut the app.
const COST_MCP_MOTION = computeCost({ features: ["motion"] }).total;
const COST_MCP_PERFORMANCE_RESKIN = computeCost({ features: ["video", "motion"] }).total;
import { enqueueJobForUser, listJobsForUser, cancelJobForUser } from "@/lib/jobs.functions";
import type { ToolResult, Avatar } from "./types";

export type ToolCtx = { userId: string; bearer: string; origin: string };

// Surfaced verbatim when no GPU worker advertises the "motion" capability; no
// credits are reserved when this fires.
const NO_MOTION_BACKEND_MSG =
  "No motion-capable GPU backend is connected yet. Connect a GPU worker with the \"motion\" capability to enable MimicMotion and Performance Shots.";

function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
function err(msg: string): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify({ error: msg }) }], isError: true };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rpc(name: string, args: Record<string, unknown>) {
  const client = supabaseAdmin as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  return client.rpc(name, args);
}

// Self-call the app's synchronous public generate endpoint with the caller's token.
async function callGenerate(
  ctx: ToolCtx,
  body: Record<string, unknown>,
): Promise<{ url: string; provider: string }> {
  const res = await fetch(`${ctx.origin}/api/public/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.bearer}` },
    body: JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok || !json || json.ok === false) {
    throw new Error((json && json.error) || `generate failed (HTTP ${res.status})`);
  }
  return { url: json.url, provider: json.provider };
}

function clampDuration(d?: number): number {
  const v = d ?? 5;
  return Math.max(3, Math.min(15, v));
}

// ─── Dependency seam (for tests) ──────────────────────────────────────────────
// Every side-effecting collaborator a tool touches is funnelled through ToolDeps
// so the credit / dispatch / precondition contract can be unit-tested with
// injected fakes (mirrors RenderDeps in generate-core.server.ts and JobDeps in
// jobs.server.ts). bun's mock.module is process-global and leaks across suites,
// so we dependency-inject rather than module-mock.

type JobStatusRow = {
  id: string;
  status: string;
  result: unknown;
  error: string | null;
  generation_id: string | null;
  kind: string;
};
type GenerationStatusRow = {
  id: string;
  status: string;
  result_image_url: string | null;
  result_video_url: string | null;
  model: string | null;
  kind: string;
  error: string | null;
};

/** Row shape returned by the shared listJobsForUser query (jobs.functions.ts). */
export type JobListRow = {
  id: string;
  kind: string;
  status: string;
  attempts: number | null;
  error: string | null;
  generation_id: string | null;
  parent_job_id: string | null;
  created_at: string;
  finished_at: string | null;
  result: unknown;
};

export type EnqueueJobInput = Parameters<typeof enqueueJobForUser>[1];

export interface ToolDeps {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  callGenerate: (ctx: ToolCtx, body: Record<string, unknown>) => Promise<{ url: string; provider: string }>;
  getAvatarByName: (userId: string, name: string) => Promise<Avatar | null>;
  listAvatars: (userId: string, limit?: number) => Promise<Avatar[]>;
  createAvatar: (userId: string, input: CreateAvatarInput) => Promise<Avatar>;
  hasActiveWorkerForKind: (kind: GenerateKind) => Promise<boolean>;
  getJobRow: (jobId: string, userId: string) => Promise<JobStatusRow | null>;
  getGenerationRow: (genId: string, userId: string) => Promise<GenerationStatusRow | null>;
  // Job-queue mirror of the /editor playground + CLI (shared core in
  // jobs.functions.ts so billing/preview-gating can never drift).
  enqueueJob: (userId: string, input: EnqueueJobInput) => Promise<{ jobId: string; generationId: string; preview: boolean }>;
  listJobs: (userId: string) => Promise<JobListRow[]>;
  cancelJob: (userId: string, jobId: string) => Promise<{ ok: true }>;
}

export const defaultToolDeps: ToolDeps = {
  rpc,
  callGenerate,
  getAvatarByName,
  listAvatars,
  createAvatar,
  hasActiveWorkerForKind,
  getJobRow: async (jobId, userId) => {
    const { data } = await supabaseAdmin
      .from("jobs")
      .select("id, status, result, error, generation_id, kind")
      .eq("id", jobId)
      .eq("user_id", userId)
      .maybeSingle();
    return (data as JobStatusRow | null) ?? null;
  },
  getGenerationRow: async (genId, userId) => {
    const { data } = await supabaseAdmin
      .from("generations")
      .select("id, status, result_image_url, result_video_url, model, kind, error")
      .eq("id", genId)
      .eq("user_id", userId)
      .maybeSingle();
    return (data as GenerationStatusRow | null) ?? null;
  },
  enqueueJob: enqueueJobForUser,
  listJobs: async (userId) => (await listJobsForUser(userId)) as JobListRow[],
  cancelJob: cancelJobForUser,
};

// ─── Identity lock (exported for unit tests) ──────────────────────────────────
// The whole "one avatar, many shots" promise hinges on every generated shot being
// driven by the avatar's reference image — not the trigger word alone. Without the
// reference the model invents a random face. These two helpers are the single
// source of truth for that contract so it can't silently regress.

/** Resolve + validate an avatar's reference image. Throws a caller-facing error
 *  when the avatar has no usable, trusted reference (fail loudly, never text-only). */
export function requireAvatarReference(avatar: { name: string; preview_url?: string | null }): string {
  if (!avatar.preview_url) {
    throw new Error(
      `Avatar "${avatar.name}" has no reference image — recreate it with image_urls so it stays the same person across shots.`,
    );
  }
  assertTrustedUrl(avatar.preview_url);
  return avatar.preview_url;
}

/** The bulk pipeline always forces the identity-preserving Gemini flash-image
 *  model (same family as the reshoot tool) with the avatar reference passed as
 *  imageUrls; exported so callers report the model actually used. nano-banana
 *  was dropped: as a light edit model it returned near-identical low-res face
 *  crops instead of following each post's scene/outfit/location directions. */
export const BULK_IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";

/** Build the enqueue payload for one bulk image, locking identity to the avatar's
 *  reference image (imageUrls). */
export function buildBulkImagePayload(prompt: string, referenceImageUrl: string) {
  return { kind: "image" as const, model: BULK_IMAGE_MODEL, prompt, imageUrls: [referenceImageUrl] };
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const generateVideoSchema = z.object({
  prompt: z.string().describe("What the video should show"),
  model: z.string().optional().describe("kling-2.5 | kling-2.5-turbo | heygen-v2 | wan-2.1 | hailuo-v2 | sora-turbo. Auto-selected if omitted."),
  aspect_ratio: z.enum(["9:16", "16:9", "1:1", "4:5"]).optional().describe("Default: 9:16"),
  duration: z.number().int().optional().describe("Seconds (3–12). Default: 5"),
  avatar_name: z.string().optional().describe('Aurora persona name (e.g. "Sophia")'),
});

export const bulkGenerateSchema = z.object({
  avatar_name: z.string().describe("Avatar/persona name to generate for"),
  prompt_template: z.string().describe("Base prompt. Variations are created automatically."),
  count: z.number().int().min(1).max(50).describe("Number of posts to generate"),
  aspect_ratio: z.enum(["9:16", "16:9", "1:1", "4:5"]).optional().describe("Default: 4:5 for IG"),
  vary_locations: z.array(z.string()).optional().describe("Locations to cycle through"),
  vary_outfits: z.array(z.string()).optional().describe("Outfits to cycle through"),
  vary_moods: z.array(z.string()).optional().describe("Moods/expressions to cycle through"),
  vary_lighting: z.array(z.string()).optional().describe("Lighting styles to cycle through"),
});

export const imageToVideoSchema = z.object({
  image_url: z.string().url().describe("URL of the source image"),
  prompt: z.string().describe("Motion / animation prompt"),
  model: z.string().optional().describe("Video model. Auto-selected if omitted."),
  duration: z.number().int().optional().describe("Seconds (3–12). Default: 5"),
  aspect_ratio: z.enum(["9:16", "16:9", "1:1", "4:5"]).optional(),
});

export const listAvatarsSchema = z.object({
  limit: z.number().int().optional().default(20).describe("Max avatars to return"),
});

export const getJobStatusSchema = z.object({
  job_id: z.string().describe("Job ID (from aurora_bulk_generate) or a past generation ID"),
});

export const createAvatarSchema = z.object({
  name: z.string().min(1).describe("Persona name, e.g. \"Sophia\""),
  image_urls: z.array(z.string().url()).optional().describe("Reference image URLs (used for LoRA training when keys are configured, and as preview)"),
  style: z.string().optional().describe("e.g. professional | casual | athletic"),
  trigger_word: z.string().optional().describe("LoRA trigger word (default: style)"),
  lipsync: z.boolean().optional().describe("Also train a Sync.so lip-sync model (requires SYNC_API_KEY)"),
});

export const animateFromDrivingVideoSchema = z.object({
  image_url: z.string().url().describe("URL of the reference image — the subject to animate"),
  driving_video_url: z.string().url().describe("URL of the driving video whose motion is transferred onto the subject"),
  prompt: z.string().optional().describe("Optional style/scene prompt"),
  motion_type: z.enum(MOTION_TYPES).optional().describe("How faithfully/energetically the subject follows the driving motion. Default: faithful"),
  camera_movement: z.enum(CAMERA_MOVEMENTS).optional().describe("Virtual camera move applied on top. Default: static"),
});

export const performanceReskinSchema = z.object({
  performance_video_url: z.string().url().describe("URL of the source performance video to reskin"),
  avatar_image_url: z.string().url().describe("URL of the avatar/persona reference image to apply onto the performer"),
  outfit: z.string().optional().describe("Outfit to dress the avatar in"),
  location: z.string().optional().describe("Scene/location for the reskinned shot"),
  audio_url: z.string().url().optional().describe("Optional audio track to lip-sync the result to (otherwise source audio is preserved)"),
  prompt: z.string().optional().describe("Optional extra style prompt"),
  motion_type: z.enum(MOTION_TYPES).optional(),
  camera_movement: z.enum(CAMERA_MOVEMENTS).optional(),
});

// ─── Tools ──────────────────────────────────────────────────────────────────

export async function generateVideoTool(args: z.infer<typeof generateVideoSchema>, ctx: ToolCtx, deps: ToolDeps = defaultToolDeps): Promise<ToolResult> {
  try {
    const selection = selectVideoModel(args.prompt, args.model);
    const aspect = args.aspect_ratio ?? inferAspectRatio(args.prompt);
    const duration = clampDuration(args.duration);

    let prompt = args.prompt;
    let avatarImageUrl: string | undefined;
    if (args.avatar_name) {
      const avatar = await deps.getAvatarByName(ctx.userId, args.avatar_name);
      if (!avatar) return err(`Avatar "${args.avatar_name}" not found`);
      // Identity lock: the avatar's reference image MUST drive the shot (image-to-video),
      // not just the trigger word — otherwise the model invents a random face.
      try {
        avatarImageUrl = requireAvatarReference(avatar);
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
      if (avatar.trigger_word) prompt = `${prompt}, ${avatar.trigger_word}`;
    }
    prompt = `${prompt} [${aspect} aspect ratio]`;

    const result = await deps.callGenerate(ctx, {
      kind: "video",
      prompt,
      duration,
      ...(avatarImageUrl ? { imageUrls: [avatarImageUrl] } : {}),
    });
    return ok({
      status: "completed",
      url: result.url,
      provider: result.provider,
      suggested_model: selection.model,
      model_reason: selection.reason,
      aspect_ratio: aspect,
      duration: `${duration}s`,
      estimated_credits: selection.estimatedCredits,
      message: `Rendered with ${result.provider} · ${duration}s · ${aspect}`,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function imageToVideoTool(args: z.infer<typeof imageToVideoSchema>, ctx: ToolCtx, deps: ToolDeps = defaultToolDeps): Promise<ToolResult> {
  try {
    const selection = selectVideoModel(args.prompt, args.model);
    const aspect = args.aspect_ratio ?? inferAspectRatio(args.prompt);
    const duration = clampDuration(args.duration);
    const prompt = `${args.prompt} [${aspect} aspect ratio]`;

    const result = await deps.callGenerate(ctx, { kind: "video", prompt, imageUrls: [args.image_url], duration });
    return ok({
      status: "completed",
      url: result.url,
      provider: result.provider,
      suggested_model: selection.model,
      model_reason: selection.reason,
      aspect_ratio: aspect,
      duration: `${duration}s`,
      estimated_credits: selection.estimatedCredits,
      message: `Animated image with ${result.provider} · ${duration}s · ${aspect}`,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

function pick(arr: string[] | undefined, i: number): string | undefined {
  return arr && arr.length ? arr[i % arr.length] : undefined;
}

export async function bulkGenerateTool(args: z.infer<typeof bulkGenerateSchema>, ctx: ToolCtx, deps: ToolDeps = defaultToolDeps): Promise<ToolResult> {
  try {
    const avatar = await deps.getAvatarByName(ctx.userId, args.avatar_name);
    if (!avatar) return err(`Avatar "${args.avatar_name}" not found`);
    // Identity lock: every bulk image MUST be generated from the avatar's reference
    // image, not from the trigger word alone — otherwise each post is a different face.
    let referenceImageUrl: string;
    try {
      referenceImageUrl = requireAvatarReference(avatar);
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
    const aspect = args.aspect_ratio ?? "4:5";

    const jobs: string[] = [];
    let creditError: string | null = null;
    for (let i = 0; i < args.count; i++) {
      const segs = [args.prompt_template];
      const loc = pick(args.vary_locations, i);
      const outfit = pick(args.vary_outfits, i);
      const mood = pick(args.vary_moods, i);
      const light = pick(args.vary_lighting, i);
      if (loc) segs.push(`at ${loc}`);
      if (outfit) segs.push(`wearing ${outfit}`);
      if (mood) segs.push(`${mood} mood`);
      if (light) segs.push(`${light} lighting`);
      if (avatar.trigger_word) segs.push(avatar.trigger_word);
      segs.push(`[${aspect} aspect ratio]`);
      const prompt = segs.join(", ");

      const payload = buildBulkImagePayload(prompt, referenceImageUrl);
      const { data, error } = await deps.rpc("create_generation_and_reserve", {
        _user: ctx.userId,
        _kind: "image",
        _prompt: prompt,
        _amount: 1,
        _payload: payload,
      });
      if (error) {
        creditError = /insufficient_credits/i.test(error.message) ? "Not enough Aura" : error.message;
        break;
      }
      const row = (Array.isArray(data) ? data[0] : data) as { job_id: string };
      jobs.push(row.job_id);
    }

    return ok({
      jobs,
      total_jobs: jobs.length,
      requested: args.count,
      total_credits: jobs.length, // 1 credit per image
      model: BULK_IMAGE_MODEL,
      avatar: { id: avatar.id, name: avatar.name },
      aspect_ratio: aspect,
      ...(creditError ? { warning: `Stopped early: ${creditError}` } : {}),
      message: `Queued ${jobs.length}/${args.count} images for ${avatar.name}. Track with aurora_get_job_status.`,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function listAvatarsTool(args: z.infer<typeof listAvatarsSchema>, ctx: ToolCtx, deps: ToolDeps = defaultToolDeps): Promise<ToolResult> {
  try {
    const avatars = await deps.listAvatars(ctx.userId, args.limit ?? 20);
    return ok({
      avatars: avatars.map((a) => ({
        id: a.id,
        name: a.name,
        handle: a.handle,
        style: a.style,
        training_status: a.training_status,
        preview_url: a.preview_url,
      })),
      total: avatars.length,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function getJobStatusTool(args: z.infer<typeof getJobStatusSchema>, ctx: ToolCtx, deps: ToolDeps = defaultToolDeps): Promise<ToolResult> {
  try {
    if (!UUID_RE.test(args.job_id)) return err("job_id must be a valid UUID");

    const job = await deps.getJobRow(args.job_id, ctx.userId);
    if (job) {
      const result = (job.result ?? {}) as {
        url?: string;
        provider?: string;
        imageUrl?: string;
        videoUrl?: string;
        meta?: unknown;
      };
      return ok({
        job_id: job.id,
        status: job.status,
        output_url: result.url ?? null,
        image_url: result.imageUrl ?? null,
        video_url: result.videoUrl ?? null,
        provider: result.provider ?? null,
        kind: job.kind,
        ...(result.meta ? { meta: result.meta } : {}),
        error: job.error ?? null,
      });
    }

    const gen = await deps.getGenerationRow(args.job_id, ctx.userId);
    if (gen) {
      return ok({
        job_id: gen.id,
        status: gen.status,
        output_url: gen.result_video_url ?? gen.result_image_url ?? null,
        image_url: gen.result_image_url ?? null,
        video_url: gen.result_video_url ?? null,
        model: gen.model,
        kind: gen.kind,
        error: gen.error ?? null,
      });
    }

    return err(`No job or generation found for id ${args.job_id}`);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function animateFromDrivingVideoTool(args: z.infer<typeof animateFromDrivingVideoSchema>, ctx: ToolCtx, deps: ToolDeps = defaultToolDeps): Promise<ToolResult> {
  try {
    try {
      assertTrustedUrl(args.image_url);
      assertTrustedUrl(args.driving_video_url);
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
    if (!(await deps.hasActiveWorkerForKind("motion"))) return err(NO_MOTION_BACKEND_MSG);

    const payload = buildMimicMotionRequest({
      imageUrl: args.image_url,
      drivingVideoUrl: args.driving_video_url,
      prompt: args.prompt,
      params: { motionType: args.motion_type, cameraMovement: args.camera_movement },
    });
    const { data, error } = await deps.rpc("create_generation_and_reserve", {
      _user: ctx.userId,
      _kind: "motion",
      _prompt: args.prompt ?? "Motion transfer",
      _amount: COST_MCP_MOTION,
      _payload: payload as unknown as Record<string, unknown>,
    });
    if (error) return err(/insufficient_credits/i.test(error.message) ? "Not enough Aura" : error.message);
    const row = (Array.isArray(data) ? data[0] : data) as { job_id: string; generation_id: string };
    return ok({
      job_id: row.job_id,
      generation_id: row.generation_id,
      status: "queued",
      credits: COST_MCP_MOTION,
      message: "MimicMotion job queued. Track with aurora_get_job_status.",
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function performanceReskinTool(args: z.infer<typeof performanceReskinSchema>, ctx: ToolCtx, deps: ToolDeps = defaultToolDeps): Promise<ToolResult> {
  try {
    try {
      assertTrustedUrl(args.performance_video_url);
      assertTrustedUrl(args.avatar_image_url);
      if (args.audio_url) assertTrustedUrl(args.audio_url);
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
    if (!(await deps.hasActiveWorkerForKind("motion"))) return err(NO_MOTION_BACKEND_MSG);

    const payload = {
      performanceVideoUrl: args.performance_video_url,
      avatarImageUrl: args.avatar_image_url,
      outfit: args.outfit,
      location: args.location,
      audioUrl: args.audio_url,
      prompt: args.prompt,
      params: { motionType: args.motion_type, cameraMovement: args.camera_movement },
    };
    const { data, error } = await deps.rpc("create_generation_and_reserve", {
      _user: ctx.userId,
      _kind: "performance_reskin",
      _prompt: args.prompt ?? "Performance reskin",
      _amount: COST_MCP_PERFORMANCE_RESKIN,
      _payload: payload as unknown as Record<string, unknown>,
    });
    if (error) return err(/insufficient_credits/i.test(error.message) ? "Not enough Aura" : error.message);
    const row = (Array.isArray(data) ? data[0] : data) as { job_id: string; generation_id: string };
    return ok({
      job_id: row.job_id,
      generation_id: row.generation_id,
      status: "queued",
      credits: COST_MCP_PERFORMANCE_RESKIN,
      message: "Performance Shot job queued. Track with aurora_get_job_status.",
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function createAvatarTool(args: z.infer<typeof createAvatarSchema>, ctx: ToolCtx, deps: ToolDeps = defaultToolDeps): Promise<ToolResult> {
  try {
    const avatar = await deps.createAvatar(ctx.userId, args);
    const trained = avatar.training_status !== "completed";
    return ok({
      id: avatar.id,
      name: avatar.name,
      handle: avatar.handle,
      style: avatar.style,
      training_status: avatar.training_status,
      preview_url: avatar.preview_url,
      message: trained
        ? `Persona "${avatar.name}" created; LoRA training is ${avatar.training_status}.`
        : `Persona "${avatar.name}" created and ready to use.`,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ─── UGC ad + campaign ────────────────────────────────────────────────────────

export const ugcAdSchema = z.object({
  avatar_name: z.string().describe("Aurora persona to feature (must have a reference image)"),
  product: z.string().min(2).max(1000).describe("Product / action the creator promotes, e.g. 'unboxing a matte skincare bottle'"),
  scene: z.string().max(600).optional().describe("Scene/setting hint, e.g. 'iPhone selfie in a sunlit kitchen'"),
  duration: z.number().int().optional().describe("Seconds (3–12). Default: 8"),
  aspect_ratio: z.enum(["9:16", "16:9", "1:1", "4:5"]).optional().describe("Default: 9:16"),
  voice_model: z.string().max(120).optional().describe("HF text-to-speech model id (used only when HF_TOKEN is configured)"),
});

export const campaignSchema = z.object({
  avatar_name: z.string().describe("Avatar/persona the campaign features"),
  prompt_template: z.string().min(2).describe("Base creative prompt; variations are layered on automatically"),
  count: z.number().int().min(1).max(20).describe("Number of matched image+video sets (1–20)"),
  vary_locations: z.array(z.string()).optional().describe("Locations to cycle through"),
  vary_outfits: z.array(z.string()).optional().describe("Outfits to cycle through"),
  vary_moods: z.array(z.string()).optional().describe("Moods/expressions to cycle through"),
  vary_lighting: z.array(z.string()).optional().describe("Lighting styles to cycle through"),
  aspect_ratio: z.enum(["9:16", "16:9", "1:1", "4:5"]).optional().describe("Default: 9:16"),
  duration: z.number().int().optional().describe("Clip seconds (3–12). Default: 5"),
  motion_prompt: z.string().max(600).optional().describe("Shared motion direction for each set's video"),
});

export async function generateUgcAdTool(args: z.infer<typeof ugcAdSchema>, ctx: ToolCtx, deps: ToolDeps = defaultToolDeps): Promise<ToolResult> {
  try {
    const avatar = await deps.getAvatarByName(ctx.userId, args.avatar_name);
    if (!avatar) return err(`Avatar "${args.avatar_name}" not found`);
    if (!avatar.preview_url) {
      return err(`Avatar "${avatar.name}" has no reference image — recreate it with image_urls so it can appear in the ad.`);
    }
    try {
      assertTrustedUrl(avatar.preview_url);
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
    const duration = clampDuration(args.duration);
    const aspect = args.aspect_ratio ?? "9:16";

    const payload = {
      avatarImageUrl: avatar.preview_url,
      avatarName: avatar.name,
      vibe: avatar.style,
      sceneHint: args.scene,
      sceneName: args.scene,
      productPrompt: args.product,
      aspect,
      duration,
      voiceModel: args.voice_model,
    };
    const { data, error } = await deps.rpc("create_generation_and_reserve", {
      _user: ctx.userId,
      _kind: "ugc_ad",
      _prompt: `UGC ad: ${args.product} — ${avatar.name}`,
      _amount: COST_UGC_AD,
      _payload: payload,
    });
    if (error) return err(/insufficient_credits/i.test(error.message) ? "Not enough Aura" : error.message);
    const row = (Array.isArray(data) ? data[0] : data) as { job_id: string; generation_id: string };
    return ok({
      job_id: row.job_id,
      generation_id: row.generation_id,
      status: "queued",
      credits: COST_UGC_AD,
      avatar: { id: avatar.id, name: avatar.name },
      aspect_ratio: aspect,
      duration: `${duration}s`,
      message:
        `Talking UGC ad queued for ${avatar.name}. The script is auto-written; voice + lip-sync are applied when TTS is configured, otherwise a silent animated clip is produced. Track with aurora_get_job_status (returns video_url + a meta block describing the script source).`,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function generateCampaignTool(args: z.infer<typeof campaignSchema>, ctx: ToolCtx, deps: ToolDeps = defaultToolDeps): Promise<ToolResult> {
  try {
    const avatar = await deps.getAvatarByName(ctx.userId, args.avatar_name);
    if (!avatar) return err(`Avatar "${args.avatar_name}" not found`);
    if (!avatar.preview_url) {
      return err(`Avatar "${avatar.name}" has no reference image — recreate it with image_urls so it can appear in the campaign.`);
    }
    try {
      assertTrustedUrl(avatar.preview_url);
    } catch (e) {
      return err(e instanceof Error ? e.message : String(e));
    }
    const aspect = args.aspect_ratio ?? "9:16";
    const duration = clampDuration(args.duration);

    const variations = buildCampaignVariations({
      base: args.prompt_template,
      count: args.count,
      aspect,
      triggerWord: avatar.trigger_word ?? undefined,
      avatarName: avatar.name,
      locations: args.vary_locations,
      outfits: args.vary_outfits,
      moods: args.vary_moods,
      lighting: args.vary_lighting,
      motionPrompt: args.motion_prompt,
    });

    const jobs: Array<{ job_id: string; label: string }> = [];
    let creditError: string | null = null;
    for (const v of variations) {
      const payload = {
        avatarImageUrl: avatar.preview_url ?? undefined,
        imagePrompt: v.imagePrompt,
        motionPrompt: v.motionPrompt,
        duration,
        label: v.label,
      };
      const { data, error } = await deps.rpc("create_generation_and_reserve", {
        _user: ctx.userId,
        _kind: "ugc_campaign_item",
        _prompt: `UGC campaign · ${avatar.name} · ${v.label}`,
        _amount: COST_CAMPAIGN_ITEM,
        _payload: payload,
      });
      if (error) {
        creditError = /insufficient_credits/i.test(error.message) ? "Not enough Aura" : error.message;
        break;
      }
      const row = (Array.isArray(data) ? data[0] : data) as { job_id: string };
      jobs.push({ job_id: row.job_id, label: v.label });
    }

    return ok({
      jobs,
      total_jobs: jobs.length,
      requested: args.count,
      credits_per_set: COST_CAMPAIGN_ITEM,
      total_credits: jobs.length * COST_CAMPAIGN_ITEM,
      avatar: { id: avatar.id, name: avatar.name },
      aspect_ratio: aspect,
      ...(creditError ? { warning: `Stopped early: ${creditError}` } : {}),
      message:
        `Queued ${jobs.length}/${args.count} matched image+video sets for ${avatar.name}. Each set returns BOTH an image and a video (image_url + video_url). Track with aurora_get_job_status.`,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ─── Job queue tools (mirror of the /editor playground + CLI jobs API) ────────

export const submitJobSchema = z.object({
  kind: z.enum(["image", "video", "lipsync", "upscale"]).describe("What to render"),
  prompt: z.string().max(2000).optional().describe("Generation prompt"),
  image_urls: z.array(z.string().url()).max(6).optional().describe("Reference/source image URLs (max 6)"),
  audio_url: z.string().url().optional().describe("Audio track URL (lipsync)"),
  video_url: z.string().url().optional().describe("Source video URL (lipsync/upscale)"),
  duration: z.number().int().min(3).max(15).optional().describe("Seconds (3–15, video only)"),
  resolution: z.enum(["480p", "720p", "1080p", "2160p"]).optional().describe("Output resolution (1080p+ needs Pro)"),
  model: z.string().max(120).optional().describe("Preferred model slug. Auto-selected if omitted."),
  confirm_preview_id: z.string().uuid().optional().describe("ID of a succeeded preview generation you own — unlocks full-quality video/lipsync renders. Without it, temporal jobs run as cheap 480p/≤5s previews."),
});

export const listJobsSchema = z.object({
  status: z.enum(["queued", "processing", "succeeded", "failed", "cancelled"]).optional().describe("Only return jobs in this status"),
  limit: z.number().int().min(1).max(50).optional().default(20).describe("Max jobs to return (most recent first)"),
});

export const cancelJobSchema = z.object({
  job_id: z.string().uuid().describe("ID of the queued job to cancel"),
});

export async function submitJobTool(args: z.infer<typeof submitJobSchema>, ctx: ToolCtx, deps: ToolDeps = defaultToolDeps): Promise<ToolResult> {
  try {
    const input: EnqueueJobInput = {
      kind: args.kind,
      prompt: args.prompt,
      imageUrls: args.image_urls,
      audioUrl: args.audio_url,
      videoUrl: args.video_url,
      duration: args.duration,
      resolution: args.resolution,
      model: args.model,
      confirmPreviewId: args.confirm_preview_id,
    };
    const res = await deps.enqueueJob(ctx.userId, input);
    return ok({
      job_id: res.jobId,
      generation_id: res.generationId,
      status: "queued",
      kind: args.kind,
      preview: res.preview,
      ...(res.preview
        ? {
            note: "Rendered as a 480p/≤5s preview (half price). Pass the succeeded generation id as confirm_preview_id to render full quality.",
          }
        : {}),
      message: `Queued ${args.kind} job. Track with aurora_get_job_status.`,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function listJobsTool(args: z.infer<typeof listJobsSchema>, ctx: ToolCtx, deps: ToolDeps = defaultToolDeps): Promise<ToolResult> {
  try {
    let rows = await deps.listJobs(ctx.userId);
    if (args.status) rows = rows.filter((r) => r.status === args.status);
    const limit = args.limit ?? 20;
    const jobs = rows.slice(0, limit).map((r) => {
      const result = (r.result ?? {}) as { url?: string; imageUrl?: string; videoUrl?: string };
      return {
        job_id: r.id,
        kind: r.kind,
        status: r.status,
        output_url: result.url ?? result.videoUrl ?? result.imageUrl ?? null,
        error: r.error ?? null,
        generation_id: r.generation_id,
        created_at: r.created_at,
        finished_at: r.finished_at,
      };
    });
    return ok({ jobs, total: jobs.length, note: "Most recent first (window: last 50 jobs)." });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function cancelJobTool(args: z.infer<typeof cancelJobSchema>, ctx: ToolCtx, deps: ToolDeps = defaultToolDeps): Promise<ToolResult> {
  try {
    await deps.cancelJob(ctx.userId, args.job_id);
    return ok({
      job_id: args.job_id,
      status: "cancelled",
      message: "Job cancelled and its reserved Aura released.",
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}
