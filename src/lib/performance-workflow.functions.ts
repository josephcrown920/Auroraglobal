import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertOwnedReferenceImage, assertOwnStudioUpload } from "@/lib/url-guard";

const NullableUrl = z.string().url().nullable();
const PlateSchema = z.object({
  url: z.string().url(),
  generationId: z.string().uuid(),
  approved: z.boolean(),
}).nullable();
const ClipSchema = z.object({
  generationId: z.string().uuid(),
  jobId: z.string().uuid(),
  previewId: z.string().uuid().nullable(),
}).nullable();

export const PerformanceWorkflowPayloadSchema = z.object({
  version: z.literal(1),
  step: z.number().int().min(0).max(6),
  mode: z.enum(["colors", "anywhere"]),
  subjectUrl: NullableUrl,
  wideReferenceUrl: NullableUrl,
  closeupReferenceUrl: NullableUrl,
  outfitReferenceUrl: NullableUrl,
  colorId: z.string().min(1).max(80),
  outfit: z.string().max(300),
  location: z.string().max(500),
  widePlate: PlateSchema,
  closeupPlate: PlateSchema,
  wideVideoUrl: NullableUrl,
  closeupVideoUrl: NullableUrl,
  audioUrl: NullableUrl,
  widePrompt: z.string().min(1).max(800),
  closeupPrompt: z.string().min(1).max(800),
  wideClip: ClipSchema,
  closeupClip: ClipSchema,
});

const SaveSchema = z.object({
  expectedRevision: z.number().int().min(0),
  payload: PerformanceWorkflowPayloadSchema,
});

type WorkflowPayload = z.infer<typeof PerformanceWorkflowPayloadSchema>;
type LooseDb = {
  from: (table: string) => any;
};
const db = supabaseAdmin as unknown as LooseDb;
const UPLOAD_URL_KEYS = [
  "subjectUrl",
  "wideReferenceUrl",
  "closeupReferenceUrl",
  "outfitReferenceUrl",
  "wideVideoUrl",
  "closeupVideoUrl",
  "audioUrl",
] as const;

function studioObjectPath(url: string): string {
  const match = new URL(url).pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/studio\/(.+)$/);
  if (!match) throw new Error("Workflow media must be stored in Aurora");
  return decodeURIComponent(match[1]);
}

function mediaIdentity(url: string): string {
  try {
    return `studio:${studioObjectPath(url)}`;
  } catch {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  }
}

async function payloadForStorage(payload: WorkflowPayload): Promise<Record<string, unknown>> {
  const stored: Record<string, unknown> = { ...payload };
  const assetPaths: Record<string, string> = {};
  for (const key of UPLOAD_URL_KEYS) {
    const url = payload[key];
    if (!url) continue;
    assetPaths[key] = studioObjectPath(url);
    stored[key] = null;
  }
  stored.assetPaths = assetPaths;
  stored.approvalProvenance = {
    wideGenerationId: payload.widePlate?.approved ? payload.widePlate.generationId : null,
    closeupGenerationId: payload.closeupPlate?.approved ? payload.closeupPlate.generationId : null,
  };
  return stored;
}

async function payloadForClient(raw: Record<string, unknown>, userId: string): Promise<WorkflowPayload> {
  const restored: Record<string, unknown> = { ...raw };
  const paths = raw.assetPaths && typeof raw.assetPaths === "object"
    ? raw.assetPaths as Record<string, unknown>
    : {};
  await Promise.all(UPLOAD_URL_KEYS.map(async (key) => {
    const path = paths[key];
    if (typeof path !== "string") return;
    const { data, error } = await supabaseAdmin.storage.from("studio").createSignedUrl(path, 60 * 60 * 24);
    if (error || !data?.signedUrl) throw new Error(`Could not restore ${key}`);
    restored[key] = data.signedUrl;
  }));
  await Promise.all((["widePlate", "closeupPlate"] as const).map(async (key) => {
    const plate = raw[key];
    if (!plate || typeof plate !== "object") return;
    const generationId = (plate as Record<string, unknown>).generationId;
    if (typeof generationId !== "string") return;
    const { data: generation, error } = await supabaseAdmin
      .from("generations")
      .select("result_image_url")
      .eq("id", generationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !generation?.result_image_url) throw new Error(`Could not restore ${key}`);
    let url = generation.result_image_url;
    try {
      const path = studioObjectPath(url);
      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from("studio")
        .createSignedUrl(path, 60 * 60 * 24);
      if (signError || !signed?.signedUrl) throw new Error(`Could not restore ${key}`);
      url = signed.signedUrl;
    } catch (error) {
      if (error instanceof Error && error.message === "Workflow media must be stored in Aurora") {
        // Persisted provider fallback URL; ownership is rechecked on save/dispatch.
      } else {
        throw error;
      }
    }
    restored[key] = { ...(plate as Record<string, unknown>), url };
  }));
  return PerformanceWorkflowPayloadSchema.parse(restored);
}

async function validateImage(url: string | null, userId: string): Promise<void> {
  if (url) await assertOwnedReferenceImage(url, userId);
}

async function validatePlate(
  plate: NonNullable<WorkflowPayload["widePlate"]> | null,
  userId: string,
): Promise<void> {
  if (!plate) return;
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("id, user_id, kind, result_image_url, error")
    .eq("id", plate.generationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data || data.kind !== "image" || !data.result_image_url || data.error) {
    throw new Error("Plate provenance could not be verified");
  }
  if (mediaIdentity(data.result_image_url) !== mediaIdentity(plate.url)) {
    throw new Error("Plate URL does not match its generation");
  }
}

async function validateClip(
  clip: NonNullable<WorkflowPayload["wideClip"]> | null,
  userId: string,
): Promise<void> {
  if (!clip) return;
  const { data: generation, error } = await supabaseAdmin
    .from("generations")
    .select("id, user_id, kind")
    .eq("id", clip.generationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !generation || generation.kind !== "motion") {
    throw new Error("Motion generation provenance could not be verified");
  }
  const { data: job, error: jobError } = await supabaseAdmin
    .from("jobs")
    .select("id, generation_id")
    .eq("id", clip.jobId)
    .eq("generation_id", clip.generationId)
    .maybeSingle();
  if (jobError || !job) throw new Error("Motion job provenance could not be verified");
  if (clip.previewId) {
    const { data: preview } = await db
      .from("generations")
      .select("id")
      .eq("id", clip.previewId)
      .eq("user_id", userId)
      .eq("mode", "preview")
      .maybeSingle();
    if (!preview) throw new Error("Preview ticket provenance could not be verified");
  }
}

export async function validatePerformanceWorkflowOwnership(payload: WorkflowPayload, userId: string): Promise<void> {
  validatePerformanceWorkflowStructure(payload);
  await Promise.all([
    validateImage(payload.subjectUrl, userId),
    validateImage(payload.wideReferenceUrl, userId),
    validateImage(payload.closeupReferenceUrl, userId),
    validateImage(payload.outfitReferenceUrl, userId),
    validatePlate(payload.widePlate, userId),
    validatePlate(payload.closeupPlate, userId),
    validateClip(payload.wideClip, userId),
    validateClip(payload.closeupClip, userId),
  ]);
  for (const url of [payload.wideVideoUrl, payload.closeupVideoUrl, payload.audioUrl]) {
    if (url) assertOwnStudioUpload(url, userId);
  }
}

export function validatePerformanceWorkflowStructure(payload: WorkflowPayload): void {
  if (payload.wideClip && (!payload.widePlate?.approved || !payload.wideVideoUrl)) {
    throw new Error("Wide motion requires an approved wide plate and matching phone video");
  }
  if (payload.closeupClip && (!payload.closeupPlate?.approved || !payload.closeupVideoUrl)) {
    throw new Error("Close-up motion requires an approved close-up plate and matching phone video");
  }
}

export const loadPerformanceWorkflowDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ mode: z.enum(["colors", "anywhere"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await db
      .from("performance_workflow_drafts")
      .select("payload, revision, updated_at")
      .eq("user_id", context.userId)
      .eq("mode", data.mode)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { draft: null, revision: 0, updatedAt: null };
    return {
      draft: await payloadForClient(row.payload as Record<string, unknown>, context.userId),
      revision: row.revision as number,
      updatedAt: row.updated_at as string,
    };
  });

export const savePerformanceWorkflowDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await validatePerformanceWorkflowOwnership(data.payload, context.userId);
    const storedPayload = await payloadForStorage(data.payload);
    if (data.expectedRevision === 0) {
      const { data: inserted, error } = await db
        .from("performance_workflow_drafts")
        .insert({
          user_id: context.userId,
          mode: data.payload.mode,
          payload: storedPayload,
          revision: 1,
          updated_at: new Date().toISOString(),
        })
        .select("revision, updated_at")
        .maybeSingle();
      if (!error && inserted) return { ok: true as const, revision: 1, updatedAt: inserted.updated_at as string };
      if (error?.code !== "23505") throw new Error(error?.message ?? "Could not save workflow");
    } else {
      const nextRevision = data.expectedRevision + 1;
      const { data: updated, error } = await db
        .from("performance_workflow_drafts")
        .update({
          payload: storedPayload,
          revision: nextRevision,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", context.userId)
        .eq("mode", data.payload.mode)
        .eq("revision", data.expectedRevision)
        .select("revision, updated_at")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (updated) return { ok: true as const, revision: nextRevision, updatedAt: updated.updated_at as string };
    }
    const { data: current, error: readError } = await db
      .from("performance_workflow_drafts")
      .select("payload, revision, updated_at")
      .eq("user_id", context.userId)
      .eq("mode", data.payload.mode)
      .single();
    if (readError || !current) throw new Error(readError?.message ?? "Workflow save conflict");
    return {
      ok: false as const,
      conflict: true as const,
      draft: await payloadForClient(current.payload as Record<string, unknown>, context.userId),
      revision: current.revision as number,
      updatedAt: current.updated_at as string,
    };
  });

export const createPerformanceEditHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    generationId: z.string().uuid(),
    label: z.enum(["Wide performance", "Close-up performance"]),
    audioUrl: z.string().url().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const sourceAudioPath = data.audioUrl
      ? (assertOwnStudioUpload(data.audioUrl, context.userId), studioObjectPath(data.audioUrl))
      : null;
    const { data: generation, error } = await supabaseAdmin
      .from("generations")
      .select("id, user_id, status, result_video_url, result_image_url")
      .eq("id", data.generationId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !generation?.result_video_url || !["succeeded", "complete"].includes(generation.status ?? "")) {
      throw new Error("Completed performance clip not found");
    }
    const clip = {
      id: crypto.randomUUID(),
      generationId: generation.id,
      videoUrl: generation.result_video_url,
      ...(generation.result_image_url ? { thumbnailUrl: generation.result_image_url } : {}),
      label: data.label,
      durationSec: 0,
      trimStartSec: 0,
      trimEndSec: 0,
    };
    const { data: session, error: sessionError } = await db
      .from("edit_sessions")
      .insert({
        user_id: context.userId,
        title: data.label,
        clip_list: [clip],
        chat_history: [],
        style: "cinematic",
        source_audio_path: sourceAudioPath,
      })
      .select("id")
      .single();
    if (sessionError || !session) throw new Error(sessionError?.message ?? "Could not create editor handoff");
    return { sessionId: session.id as string };
  });