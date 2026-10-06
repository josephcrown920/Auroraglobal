import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeCost } from "./pricing";

export const MULTISHOT_IMAGE_COST = computeCost({ features: ["image"] }).total;
export const MULTISHOT_VIDEO_COST = computeCost({
  features: ["video"],
  model: "seedance-2.0-fast",
  durationSeconds: 5,
}).total;
export const MULTISHOT_GOOGLE_VIDEO_COST = computeCost({
  features: ["video"],
  model: "veo-3-fast",
  durationSeconds: 5,
}).total;

export const MULTISHOT_ENGINES = {
  google: {
    id: "google/gemini-3.1-flash-image-preview",
    label: "Google Gemini 3.1 Flash Image",
    provider: "Google",
  },
  modelark: {
    id: "fal-ai/seedream-5",
    label: "Seedream 5.0 Pro",
    provider: "ModelArk",
  },
} as const;

const EngineSchema = z.enum([
  MULTISHOT_ENGINES.google.id,
  MULTISHOT_ENGINES.modelark.id,
]);
const AspectSchema = z.enum(["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]);
const RefSchema = z.array(z.string().url()).max(8);
const ShotInputSchema = z.object({
  prompt: z.string().trim().min(10).max(4000),
  engine: EngineSchema,
});

type ProjectRow = {
  id: string;
  user_id: string;
  title: string;
  style: string;
  aspect_ratio: string;
  reference_urls: unknown;
  audio_reference_url: string | null;
  identity_anchor: string;
  strict_google_only: boolean;
  revision: number;
  created_at: string;
  updated_at: string;
};
type ShotRow = {
  id: string;
  project_id: string;
  user_id: string;
  position: number;
  prompt: string;
  engine: z.infer<typeof EngineSchema>;
  revision: number;
  preview_status: "idle" | "processing" | "succeeded" | "failed";
  preview_url: string | null;
  preview_generation_id: string | null;
  requested_model: string | null;
  serving_model: string | null;
  fallback_used: boolean;
  input_digest: string | null;
  preview_error: string | null;
  preview_operation_token: string | null;
  preview_lease_until: string | null;
  selected: boolean;
  approval_digest: string | null;
  approved_at: string | null;
  temporal_status: "idle" | "processing" | "succeeded" | "failed";
  temporal_url: string | null;
  temporal_generation_id: string | null;
  temporal_serving_model: string | null;
  temporal_input_digest: string | null;
  temporal_approval_digest: string | null;
  temporal_approved_at: string | null;
  temporal_error: string | null;
  temporal_operation_token: string | null;
  temporal_lease_until: string | null;
  final_status: "idle" | "processing" | "succeeded" | "failed";
  final_operation_token: string | null;
  final_lease_until: string | null;
  final_error: string | null;
  promoted_generation_id: string | null;
  promoted_url: string | null;
  promoted_model: string | null;
  created_at: string;
  updated_at: string;
};

const db = supabaseAdmin as unknown as {
  // The generated Database type predates the migration in this change. Keep the
  // escape hatch confined to this table adapter until Supabase types regenerate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function multishotDigest(value: unknown): string {
  let hash = 2166136261;
  for (const char of stable(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function secureDigest(value: unknown): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(stable(value)).digest("hex");
}

function parseRefs(value: unknown): string[] {
  const parsed = RefSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

function mapShot(row: ShotRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    position: row.position,
    prompt: row.prompt,
    engine: row.engine,
    revision: row.revision,
    previewStatus: row.preview_status,
    previewUrl: row.preview_url,
    previewGenerationId: row.preview_generation_id,
    requestedModel: row.requested_model,
    servingModel: row.serving_model,
    fallbackUsed: row.fallback_used,
    inputDigest: row.input_digest,
    previewError: row.preview_error,
    previewLeaseUntil: row.preview_lease_until,
    selected: row.selected,
    approved: Boolean(row.approval_digest && row.approved_at),
    approvedAt: row.approved_at,
    temporalStatus: row.temporal_status,
    temporalUrl: row.temporal_url,
    temporalGenerationId: row.temporal_generation_id,
    temporalServingModel: row.temporal_serving_model,
    temporalApproved: Boolean(row.temporal_approval_digest && row.temporal_approved_at),
    temporalError: row.temporal_error,
    finalStatus: row.final_status,
    finalError: row.final_error,
    promotedGenerationId: row.promoted_generation_id,
    promotedUrl: row.promoted_url,
    promotedModel: row.promoted_model,
    version: row.updated_at,
  };
}

async function mapProject(row: ProjectRow) {
  const { data, error } = await db
    .from("multishot_shots")
    .select("*")
    .eq("project_id", row.id)
    .eq("user_id", row.user_id)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return {
    id: row.id,
    title: row.title,
    style: row.style,
    aspectRatio: row.aspect_ratio,
    referenceUrls: parseRefs(row.reference_urls),
    audioReferenceUrl: row.audio_reference_url,
    identityAnchor: row.identity_anchor,
    strictGoogleOnly: row.strict_google_only,
    revision: row.revision,
    shots: ((data ?? []) as ShotRow[]).map(mapShot),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type MultishotProjectDto = Awaited<ReturnType<typeof mapProject>>;

async function ownedProject(id: string, userId: string): Promise<ProjectRow> {
  const { data, error } = await db
    .from("multishot_projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Multishot project not found");
  return data as ProjectRow;
}

async function ownedShot(projectId: string, shotId: string, userId: string): Promise<ShotRow> {
  await ownedProject(projectId, userId);
  const { data, error } = await db
    .from("multishot_shots")
    .select("*")
    .eq("id", shotId)
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Shot not found");
  return data as ShotRow;
}

async function inputDigest(project: ProjectRow, shot: ShotRow) {
  return secureDigest({
    projectId: project.id,
    projectRevision: project.revision,
    shotId: shot.id,
    shotRevision: shot.revision,
    prompt: shot.prompt,
    engine: shot.engine,
    style: project.style,
    aspectRatio: project.aspect_ratio,
    referenceUrls: parseRefs(project.reference_urls),
    identityAnchor: project.identity_anchor,
    strictGoogleOnly: project.strict_google_only,
  });
}

async function approvalDigest(shot: ShotRow, digest: string) {
  return secureDigest({
    inputDigest: digest,
    previewUrl: shot.preview_url,
    previewGenerationId: shot.preview_generation_id,
    requestedModel: shot.requested_model,
    servingModel: shot.serving_model,
  });
}

async function assertOwnedRefs(urls: string[], userId: string) {
  const { assertOwnedReferenceImage } = await import("./url-guard");
  for (const url of urls) await assertOwnedReferenceImage(url, userId);
}

async function assertOwnedAudioReference(url: string | null | undefined, userId: string) {
  if (!url) return;
  // Audio references must be direct files in the caller's own Studio namespace.
  // Avatar/generation image allowances are intentionally not applicable.
  const { assertOwnStudioUpload } = await import("./url-guard");
  assertOwnStudioUpload(url, userId);
}

async function hasActiveVideoEntitlement(userId: string) {
  const { hasActiveProEntitlement } = await import("./billing.plans");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan, subscription_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select("status, next_payment_date")
    .eq("user_id", userId)
    .in("status", ["active", "cancellation_pending"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return hasActiveProEntitlement(profile, subscription);
}

async function assertActiveVideoEntitlement(userId: string) {
  if (!await hasActiveVideoEntitlement(userId)) {
    throw new Error("An active Pro subscription is required for Seedance or Veo motion previews");
  }
}

export const getMultishotCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const videoEntitled = await hasActiveVideoEntitlement(context.userId);
    return {
      image: {
        google: { implemented: true, model: MULTISHOT_ENGINES.google.id, access: "validated_on_render" as const },
        modelark: { implemented: true, model: MULTISHOT_ENGINES.modelark.id, access: "validated_on_render" as const },
        vastComfy: {
          implemented: false,
          access: "not_implemented" as const,
          reason: "No verified reference-compatible Multishot ComfyUI workflow is installed.",
        },
      },
      motion: {
        seedance: {
          implemented: true,
          model: "seedance-2.0-fast",
          access: videoEntitled ? "validated_on_render" as const : "account_unavailable" as const,
          reason: videoEntitled ? null : "An active Pro entitlement is required.",
        },
        veo: {
          implemented: false,
          model: "veo-3.1-fast-generate-preview",
          access: "not_implemented" as const,
          reason: "Direct Google Veo does not expose the required preview/final resolution contract in this workflow.",
        },
      },
      nativeAudio: {
        implemented: false,
        access: "not_implemented" as const,
        reason: "The pinned Seedance/Veo paths in Multishot do not implement a verified native-audio request contract.",
      },
      liveVoice: {
        implemented: false,
        access: "not_implemented" as const,
        reason: "A provider-backed realtime voice session lifecycle is not implemented in Multishot.",
      },
    };
  });

const OPERATION_LEASE_MS = 15 * 60 * 1000;

export function isMultishotLeaseActive(status: string, leaseUntil: string | null, now = Date.now()) {
  return status === "processing" && Boolean(leaseUntil) && Date.parse(leaseUntil!) > now;
}

export function assertExactTemporalBinding(input: {
  selected: boolean;
  currentInputDigest: string;
  storedInputDigest: string | null;
  expectedStillApproval: string;
  storedStillApproval: string | null;
  expectedTemporalInput: string;
  storedTemporalInput: string | null;
  expectedTemporalApproval: string;
  storedTemporalApproval: string | null;
}) {
  if (!input.selected) throw new Error("Only selected shots can be finalized");
  if (input.currentInputDigest !== input.storedInputDigest ||
      input.expectedStillApproval !== input.storedStillApproval) {
    throw new Error("The still inputs or approval changed");
  }
  if (input.expectedTemporalInput !== input.storedTemporalInput ||
      input.expectedTemporalApproval !== input.storedTemporalApproval) {
    throw new Error("The temporal preview or approval changed");
  }
}

async function claimShotOperation(
  shot: ShotRow,
  userId: string,
  kind: "preview" | "temporal" | "final",
  extra: Record<string, unknown> = {},
) {
  const statusColumn = `${kind}_status`;
  const tokenColumn = `${kind}_operation_token`;
  const leaseColumn = `${kind}_lease_until`;
  const currentStatus = shot[statusColumn as keyof ShotRow];
  const currentLease = shot[leaseColumn as keyof ShotRow];
  if (isMultishotLeaseActive(String(currentStatus), typeof currentLease === "string" ? currentLease : null)) {
    throw new Error(`This ${kind} operation is already processing`);
  }
  const token = crypto.randomUUID();
  const rpcClient = supabaseAdmin as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{
      data: boolean | null;
      error: { message: string } | null;
    }>;
  };
  const { data, error } = await rpcClient.rpc("claim_multishot_operation", {
    _shot_id: shot.id,
    _user_id: userId,
    _kind: kind,
    _expected_revision: shot.revision,
    _expected_status: String(currentStatus),
    _expected_token: shot[tokenColumn as keyof ShotRow] ?? null,
    _new_token: token,
    _lease_seconds: OPERATION_LEASE_MS / 1000,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`This ${kind} operation changed in another request`);
  if (Object.keys(extra).length) {
    const { error: patchError } = await db.from("multishot_shots").update(extra)
      .eq("id", shot.id).eq("user_id", userId).eq(tokenColumn, token);
    if (patchError) throw new Error(patchError.message);
  }
  return token;
}

export const createMultishotProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    title: z.string().trim().min(1).max(160),
    style: z.string().trim().max(1000).default(""),
    aspectRatio: AspectSchema,
    referenceUrls: RefSchema.default([]),
    audioReferenceUrl: z.string().url().nullable().default(null),
    identityAnchor: z.string().trim().max(1000).default(""),
    strictGoogleOnly: z.boolean().default(false),
    shots: z.array(ShotInputSchema).min(2).max(8),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwnedRefs(data.referenceUrls, context.userId);
    await assertOwnedAudioReference(data.audioReferenceUrl, context.userId);
    if (data.strictGoogleOnly && data.shots.some((shot) => shot.engine !== MULTISHOT_ENGINES.google.id)) {
      throw new Error("Google-only projects can use only the Google engine");
    }
    const { data: project, error } = await db.from("multishot_projects").insert({
      user_id: context.userId,
      title: data.title,
      style: data.style,
      aspect_ratio: data.aspectRatio,
      reference_urls: data.referenceUrls,
      audio_reference_url: data.audioReferenceUrl,
      identity_anchor: data.identityAnchor,
      strict_google_only: data.strictGoogleOnly,
    }).select("*").single();
    if (error || !project) throw new Error(error?.message ?? "Could not create Multishot project");
    const { error: shotsError } = await db.from("multishot_shots").insert(
      data.shots.map((shot, position) => ({
        project_id: project.id,
        user_id: context.userId,
        position,
        prompt: shot.prompt,
        engine: shot.engine,
      })),
    );
    if (shotsError) {
      await db.from("multishot_projects").delete().eq("id", project.id).eq("user_id", context.userId);
      throw new Error(shotsError.message);
    }
    return mapProject(project as ProjectRow);
  });

export const listMultishotProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await db.from("multishot_projects").select("*")
      .eq("user_id", context.userId).order("updated_at", { ascending: false }).limit(30);
    if (error) throw new Error(error.message);
    return Promise.all(((data ?? []) as ProjectRow[]).map(mapProject));
  });

export const getMultishotProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => mapProject(await ownedProject(data.id, context.userId)));

export const updateMultishotShot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    projectId: z.string().uuid(),
    shotId: z.string().uuid(),
    prompt: z.string().trim().min(10).max(4000).optional(),
    engine: EngineSchema.optional(),
    selected: z.boolean().optional(),
    expectedVersion: z.string().min(1).max(80),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const project = await ownedProject(data.projectId, context.userId);
    const shot = await ownedShot(data.projectId, data.shotId, context.userId);
    if (["preview", "temporal", "final"].some((kind) =>
      isMultishotLeaseActive(
        String(shot[`${kind}_status` as keyof ShotRow]),
        shot[`${kind}_lease_until` as keyof ShotRow] as string | null,
      ))) {
      throw new Error("This shot is locked while a generation is in progress");
    }
    if (data.engine && project.strict_google_only && data.engine !== MULTISHOT_ENGINES.google.id) {
      throw new Error("This project is locked to Google-only");
    }
    const inputsChanged = data.prompt !== undefined || data.engine !== undefined;
    const patch: Record<string, unknown> = {};
    if (data.prompt !== undefined) patch.prompt = data.prompt;
    if (data.engine !== undefined) patch.engine = data.engine;
    if (data.selected !== undefined) patch.selected = data.selected;
    if (inputsChanged) Object.assign(patch, {
      revision: shot.revision + 1,
      preview_status: "idle",
      preview_url: null,
      preview_generation_id: null,
      requested_model: null,
      serving_model: null,
      fallback_used: false,
      input_digest: null,
      preview_error: null,
      preview_operation_token: null,
      preview_lease_until: null,
      selected: false,
      approval_digest: null,
      approved_at: null,
      temporal_status: "idle",
      temporal_url: null,
      temporal_generation_id: null,
      temporal_serving_model: null,
      temporal_input_digest: null,
      temporal_approval_digest: null,
      temporal_approved_at: null,
      temporal_error: null,
      temporal_operation_token: null,
      temporal_lease_until: null,
      final_status: "idle",
      final_operation_token: null,
      final_lease_until: null,
      final_error: null,
      promoted_generation_id: null,
      promoted_url: null,
      promoted_model: null,
    });
    const { data: updated, error } = await db.from("multishot_shots").update(patch)
      .eq("id", shot.id).eq("project_id", project.id).eq("user_id", context.userId)
      .eq("updated_at", data.expectedVersion).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("This shot changed in another request. Reload and try again.");
    return mapShot(updated as ShotRow);
  });

async function renderPreview(project: ProjectRow, shot: ShotRow, userId: string, force = false) {
  if (project.strict_google_only && shot.engine !== MULTISHOT_ENGINES.google.id) {
    throw new Error("Google-only mode forbids this shot's engine");
  }
  const refs = parseRefs(project.reference_urls);
  await assertOwnedRefs(refs, userId);
  const digest = await inputDigest(project, shot);
  if (!force && shot.preview_status === "succeeded" && shot.input_digest === digest && shot.preview_url) {
    return mapShot(shot);
  }
  const operationToken = await claimShotOperation(shot, userId, "preview", {
    preview_error: null,
  });
  try {
    const { reserveOrchestrateRecord } = await import("./generate-core.server");
    const allowedModels = project.strict_google_only
      ? [MULTISHOT_ENGINES.google.id]
      : refs.length
        ? [shot.engine, MULTISHOT_ENGINES.google.id, "google/nano-banana", "google/nano-banana-pro", "replit/gemini-2.5-flash-image"]
        : [shot.engine, MULTISHOT_ENGINES.google.id, "fal-ai/seedream-4", "google/nano-banana"];
    const allowedProviders = project.strict_google_only
      ? ["gemini"]
      : ["byteplus", "gemini", "fal", "replicate", "replit-gemini-image"];
    const outcome = await reserveOrchestrateRecord({
      userId,
      kind: "image",
      prompt: [
        shot.prompt,
        project.style && `Shared visual style: ${project.style}`,
        project.identity_anchor && `Identity continuity anchor: ${project.identity_anchor}`,
        "Keep identity, wardrobe, palette, lighting logic, and production design coordinated with the supplied references.",
      ].filter(Boolean).join("\n"),
      imageUrls: refs,
      model: shot.engine,
      pinnedModelOnly: project.strict_google_only,
      editStrict: refs.length > 0,
      allowedModels,
      allowedProviders,
      aspectRatio: project.aspect_ratio,
      mode: "preview",
      cost: MULTISHOT_IMAGE_COST,
      reason: "multishot_preview",
      idempotencyKey: `multishot:preview:${project.id}:${shot.id}:${digest}${force ? `:retry:${shot.preview_generation_id ?? "initial"}` : ""}`,
    });
    if (!outcome.ok) throw new Error(outcome.insufficient ? "Not enough Aura for this preview" : outcome.error);
    const { data: generation } = await db.from("generations").select("result_image_url")
      .eq("id", outcome.generationId).eq("user_id", userId).maybeSingle();
    const durableUrl = generation?.result_image_url || outcome.url;
    const servingModel = `${outcome.provider} · ${outcome.endpoint}`;
    const expectedProvider = shot.engine === MULTISHOT_ENGINES.modelark.id ? "byteplus" : "gemini";
    const { data: updated, error } = await db.from("multishot_shots").update({
      preview_status: "succeeded",
      preview_url: durableUrl,
      preview_generation_id: outcome.generationId,
      requested_model: shot.engine,
      serving_model: servingModel,
      fallback_used: outcome.provider !== expectedProvider,
      input_digest: digest,
      preview_error: null,
      preview_operation_token: null,
      preview_lease_until: null,
      approval_digest: null,
      approved_at: null,
      promoted_generation_id: null,
      promoted_url: null,
      promoted_model: null,
    }).eq("id", shot.id).eq("project_id", project.id).eq("user_id", userId)
      .eq("revision", shot.revision).eq("preview_operation_token", operationToken)
      .select("*").maybeSingle();
    if (error || !updated) throw new Error(error?.message ?? "Preview rendered but could not be attached");
    return mapShot(updated as ShotRow);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.from("multishot_shots").update({
      preview_status: shot.preview_status === "succeeded" ? "succeeded" : "failed",
      preview_error: message.slice(0, 1000),
      preview_operation_token: null,
      preview_lease_until: null,
    }).eq("id", shot.id).eq("user_id", userId).eq("revision", shot.revision)
      .eq("preview_operation_token", operationToken);
    throw error;
  }
}

export const generateMultishotBatchPreviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const project = await ownedProject(data.projectId, context.userId);
    const mapped = await mapProject(project);
    if (mapped.shots.length < 2 || mapped.shots.length > 8) throw new Error("Multishot batches require 2–8 shots");
    const rows = await Promise.all(mapped.shots.map((shot) => ownedShot(project.id, shot.id, context.userId)));
    const settled = await Promise.allSettled(rows.map((shot) => renderPreview(project, shot, context.userId)));
    return {
      results: settled.map((result, index) => result.status === "fulfilled"
        ? { shotId: rows[index].id, ok: true as const, shot: result.value }
        : {
            shotId: rows[index].id,
            ok: false as const,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          }),
    };
  });

export const retryMultishotPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    projectId: z.string().uuid(),
    shotId: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data, context }) => renderPreview(
    await ownedProject(data.projectId, context.userId),
    await ownedShot(data.projectId, data.shotId, context.userId),
    context.userId,
    true,
  ));

export const approveMultishotPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    projectId: z.string().uuid(),
    shotId: z.string().uuid(),
    previewGenerationId: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const project = await ownedProject(data.projectId, context.userId);
    const shot = await ownedShot(data.projectId, data.shotId, context.userId);
    const digest = await inputDigest(project, shot);
    if (shot.preview_status !== "succeeded" || !shot.preview_url || shot.preview_generation_id !== data.previewGenerationId) {
      throw new Error("The exact preview being approved is no longer current");
    }
    if (shot.input_digest !== digest) throw new Error("Inputs changed after this preview. Generate a new preview.");
    const approval = await approvalDigest(shot, digest);
    const { data: updated, error } = await db.from("multishot_shots").update({
      approval_digest: approval,
      approved_at: new Date().toISOString(),
    }).eq("id", shot.id).eq("user_id", context.userId).eq("input_digest", digest)
      .eq("revision", shot.revision)
      .eq("preview_status", "succeeded")
      .eq("preview_generation_id", data.previewGenerationId).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("The preview changed while approval was being recorded");
    return mapShot(updated as ShotRow);
  });

export const promoteMultishotShot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    projectId: z.string().uuid(),
    shotId: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const project = await ownedProject(data.projectId, context.userId);
    const shot = await ownedShot(data.projectId, data.shotId, context.userId);
    const digest = await inputDigest(project, shot);
    if (!shot.selected) throw new Error("Select this preview before promotion");
    if (!shot.preview_url || !shot.preview_generation_id || shot.input_digest !== digest) {
      throw new Error("Generate a current preview before promotion");
    }
    if (!shot.approval_digest || shot.approval_digest !== await approvalDigest(shot, digest)) {
      throw new Error("Approve this exact unchanged preview before promotion");
    }
    if (project.strict_google_only) {
      throw new Error("Google-only motion is unavailable: direct Veo does not expose the required preview/final resolution contract");
    }
    const videoModel = "seedance-2.0-fast";
    await assertActiveVideoEntitlement(context.userId);
    const videoCost = MULTISHOT_VIDEO_COST;
    const temporalDigest = await secureDigest({
      inputDigest: digest,
      stillApproval: shot.approval_digest,
      previewGenerationId: shot.preview_generation_id,
      videoModel,
      resolution: "480p",
      duration: 5,
    });
    const operationToken = await claimShotOperation(shot, context.userId, "temporal", {
      temporal_error: null,
      temporal_input_digest: temporalDigest,
    });
    const { reserveOrchestrateRecord } = await import("./generate-core.server");
    const outcome = await reserveOrchestrateRecord({
      userId: context.userId,
      kind: "video",
      prompt: `${shot.prompt}\nPreserve the exact selected preview composition and shared identity continuity.`,
      imageUrls: [shot.preview_url],
      model: videoModel,
      pinnedModelOnly: true,
      allowedModels: [videoModel],
      allowedProviders: ["fal", "byteplus", "replicate"],
      forSubscriber: true,
      duration: 5,
      resolution: "480p",
      aspectRatio: project.aspect_ratio,
      cost: videoCost,
      mode: "preview",
      reason: "multishot_temporal_preview",
      idempotencyKey: `multishot:temporal:${project.id}:${shot.id}:${temporalDigest}`,
    }).catch(async (error) => {
      await db.from("multishot_shots").update({
        temporal_status: "failed",
        temporal_error: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
        temporal_operation_token: null,
        temporal_lease_until: null,
      }).eq("id", shot.id).eq("user_id", context.userId)
        .eq("temporal_operation_token", operationToken);
      throw error;
    });
    if (!outcome.ok) {
      await db.from("multishot_shots").update({
        temporal_status: "failed",
        temporal_error: outcome.error.slice(0, 1000),
        temporal_operation_token: null,
        temporal_lease_until: null,
      }).eq("id", shot.id).eq("user_id", context.userId)
        .eq("temporal_operation_token", operationToken);
      throw new Error(outcome.insufficient ? "Not enough Aura for the temporal preview" : outcome.error);
    }
    const { data: generation } = await db.from("generations").select("result_video_url")
      .eq("id", outcome.generationId).eq("user_id", context.userId).maybeSingle();
    const { data: updated, error } = await db.from("multishot_shots").update({
      temporal_status: "succeeded",
      temporal_generation_id: outcome.generationId,
      temporal_url: generation?.result_video_url || outcome.url,
      temporal_serving_model: `${outcome.provider} · ${outcome.endpoint}`,
      temporal_input_digest: temporalDigest,
      temporal_approval_digest: null,
      temporal_approved_at: null,
      temporal_operation_token: null,
      temporal_lease_until: null,
    }).eq("id", shot.id).eq("user_id", context.userId)
      .eq("approval_digest", shot.approval_digest)
      .eq("temporal_operation_token", operationToken).select("*").maybeSingle();
    if (error || !updated) throw new Error(error?.message ?? "Temporal preview completed but could not be attached");
    return mapShot(updated as ShotRow);
  });

export const approveMultishotTemporalPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    projectId: z.string().uuid(),
    shotId: z.string().uuid(),
    generationId: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const project = await ownedProject(data.projectId, context.userId);
    const shot = await ownedShot(data.projectId, data.shotId, context.userId);
    const digest = await inputDigest(project, shot);
    if (!shot.approval_digest || shot.approval_digest !== await approvalDigest(shot, digest)) {
      throw new Error("The still preview approval is stale");
    }
    if (shot.temporal_status !== "succeeded" || !shot.temporal_url || shot.temporal_generation_id !== data.generationId) {
      throw new Error("The exact temporal preview is no longer current");
    }
    const approval = await secureDigest({
      inputDigest: shot.temporal_input_digest,
      generationId: shot.temporal_generation_id,
      url: shot.temporal_url,
      servingModel: shot.temporal_serving_model,
    });
    const { data: updated, error } = await db.from("multishot_shots").update({
      temporal_approval_digest: approval,
      temporal_approved_at: new Date().toISOString(),
    }).eq("id", shot.id).eq("user_id", context.userId)
      .eq("revision", shot.revision)
      .eq("selected", true)
      .eq("approval_digest", shot.approval_digest)
      .eq("temporal_input_digest", shot.temporal_input_digest)
      .eq("temporal_generation_id", data.generationId).select("*").maybeSingle();
    if (error || !updated) throw new Error(error?.message ?? "Temporal preview changed during approval");
    return mapShot(updated as ShotRow);
  });

export const finalizeMultishotShot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    projectId: z.string().uuid(),
    shotId: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const project = await ownedProject(data.projectId, context.userId);
    const shot = await ownedShot(data.projectId, data.shotId, context.userId);
    const currentInputDigest = await inputDigest(project, shot);
    const expectedStillApproval = await approvalDigest(shot, currentInputDigest);
    if (!shot.temporal_url || !shot.temporal_generation_id || !shot.temporal_approval_digest) {
      throw new Error("Generate and approve the exact 480p temporal preview first");
    }
    const expectedApproval = await secureDigest({
      inputDigest: shot.temporal_input_digest,
      generationId: shot.temporal_generation_id,
      url: shot.temporal_url,
      servingModel: shot.temporal_serving_model,
    });
    if (project.strict_google_only) {
      throw new Error("Google-only finals are unavailable until a direct Google preview/final resolution contract is implemented");
    }
    const servingProvider = shot.temporal_serving_model?.split(" · ", 1)[0];
    const finalRoute = servingProvider === "fal" || servingProvider === "byteplus" || servingProvider === "replicate"
      ? { model: "seedance-2.0-fast", providers: [servingProvider], cost: MULTISHOT_VIDEO_COST }
        : null;
    if (!finalRoute) {
      throw new Error("The approved preview route is not eligible for final rendering; create and approve a replacement preview");
    }
    const expectedTemporalInput = await secureDigest({
      inputDigest: currentInputDigest,
      stillApproval: shot.approval_digest,
      previewGenerationId: shot.preview_generation_id,
      videoModel: "seedance-2.0-fast",
      resolution: "480p",
      duration: 5,
    });
    assertExactTemporalBinding({
      selected: shot.selected,
      currentInputDigest,
      storedInputDigest: shot.input_digest,
      expectedStillApproval,
      storedStillApproval: shot.approval_digest,
      expectedTemporalInput,
      storedTemporalInput: shot.temporal_input_digest,
      expectedTemporalApproval: expectedApproval,
      storedTemporalApproval: shot.temporal_approval_digest,
    });
    await assertActiveVideoEntitlement(context.userId);
    const videoCost = finalRoute.cost;
    const operationToken = await claimShotOperation(shot, context.userId, "final", {
      final_error: null,
    });
    const { reserveOrchestrateRecord } = await import("./generate-core.server");
    const outcome = await reserveOrchestrateRecord({
      userId: context.userId,
      kind: "video",
      prompt: `${shot.prompt}\nMatch the approved temporal preview exactly.`,
      imageUrls: [shot.preview_url!],
      model: finalRoute.model,
      pinnedModelOnly: true,
      allowedModels: [finalRoute.model],
      allowedProviders: finalRoute.providers,
      forSubscriber: true,
      duration: 5,
      resolution: "720p",
      aspectRatio: project.aspect_ratio,
      cost: videoCost,
      reason: "multishot_final",
      idempotencyKey: `multishot:final:${project.id}:${shot.id}:${shot.temporal_approval_digest}`,
    }).catch(async (error) => {
      await db.from("multishot_shots").update({
        final_status: "failed",
        final_error: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
        final_operation_token: null,
        final_lease_until: null,
      }).eq("id", shot.id).eq("user_id", context.userId)
        .eq("final_operation_token", operationToken);
      throw error;
    });
    if (!outcome.ok) {
      await db.from("multishot_shots").update({
        final_status: "failed",
        final_error: outcome.error.slice(0, 1000),
        final_operation_token: null,
        final_lease_until: null,
      }).eq("id", shot.id).eq("user_id", context.userId)
        .eq("final_operation_token", operationToken);
      throw new Error(outcome.insufficient ? "Not enough Aura for the final shot" : outcome.error);
    }
    const { data: generation } = await db.from("generations").select("result_video_url")
      .eq("id", outcome.generationId).eq("user_id", context.userId).maybeSingle();
    const { data: updated, error } = await db.from("multishot_shots").update({
      promoted_generation_id: outcome.generationId,
      promoted_url: generation?.result_video_url || outcome.url,
      promoted_model: `${outcome.provider} · ${outcome.endpoint}`,
      final_status: "succeeded",
      final_operation_token: null,
      final_lease_until: null,
    }).eq("id", shot.id).eq("user_id", context.userId)
      .eq("revision", shot.revision)
      .eq("selected", true)
      .eq("approval_digest", shot.approval_digest)
      .eq("temporal_approval_digest", shot.temporal_approval_digest)
      .eq("final_operation_token", operationToken).select("*").maybeSingle();
    if (error || !updated) throw new Error(error?.message ?? "Final completed but could not be attached");
    return mapShot(updated as ShotRow);
  });
