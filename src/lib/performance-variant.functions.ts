import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertOwnedReferenceImage, assertOwnStudioUpload } from "@/lib/url-guard";
import { computeCost } from "@/lib/pricing";
import { LUXURY_INTERIOR_PRESETS, REANGLE_PRESETS, requiredReferenceIds } from "./performance-variant-workflows";
import type { Json } from "@/integrations/supabase/types";

const Kind = z.enum(["build_scene", "luxury_interior"]);
const Mode = z.enum(["colors", "anywhere"]);
const Plate = z.object({
  url: z.string().url(),
  generationId: z.string().uuid(),
  approved: z.boolean(),
});
export const PerformanceVariantPayloadSchema = z.object({
  version: z.literal(1),
  mode: Mode,
  kind: Kind,
  references: z.record(z.string(), z.string().url().nullable()),
  settings: z.record(z.string(), z.string().max(700)),
  selectedAngles: z.array(z.string()).max(5),
  base: Plate.nullable(),
  angles: z.array(Plate.extend({ presetId: z.string() })).max(5),
  motions: z.array(z.object({
    presetId: z.string(),
    generationId: z.string().uuid(),
    jobId: z.string().uuid(),
    previewId: z.string().uuid().nullable(),
  })).default([]),
  phoneVideoUrl: z.string().url().nullable(),
  angleVideoOverrides: z.record(z.string(), z.string().url()).default({}),
  motionDirections: z.record(z.string(), z.string().max(800)).default({}),
  audioUrl: z.string().url().nullable(),
});
export type PerformanceVariantPayload = z.infer<typeof PerformanceVariantPayloadSchema>;

function objectPath(url: string): string {
  const match = new URL(url).pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/studio\/(.+)$/);
  if (!match) throw new Error("Reference must be stored in Aurora");
  return decodeURIComponent(match[1]);
}
function mediaIdentity(url: string): string {
  try { return `studio:${objectPath(url)}`; }
  catch { const parsed = new URL(url); return `${parsed.origin}${parsed.pathname}`; }
}

export function validateVariantRequirements(payload: PerformanceVariantPayload): void {
  const required = requiredReferenceIds(payload.kind);
  const missing = required.filter((id) => !payload.references[id]);
  if (missing.length) throw new Error(`Missing required references: ${missing.join(", ")}`);
  const supplied = Object.entries(payload.references).filter(([, url]) => !!url);
  const unexpected = supplied.map(([id]) => id).filter((id) => !required.includes(id));
  if (unexpected.length) throw new Error(`Unexpected reference roles: ${unexpected.join(", ")}`);
  if (new Set(supplied.map(([, url]) => mediaIdentity(url!))).size !== supplied.length) {
    throw new Error("Each required role must use a distinct reference asset");
  }
  if (payload.kind === "build_scene" && (payload.selectedAngles.length < 3 || payload.selectedAngles.length > 5)) {
    throw new Error("Choose 3–5 re-angles");
  }
  if (payload.kind === "luxury_interior" && !payload.settings.context?.trim()) {
    throw new Error("Performance context is required");
  }
}

export function validateVariantStructure(payload: PerformanceVariantPayload): void {
  for (const motion of payload.motions) {
    const plate = motion.presetId === "base" ? payload.base : payload.angles.find((item) => item.presetId === motion.presetId);
    if (!plate?.approved || !(payload.angleVideoOverrides[motion.presetId] ?? payload.phoneVideoUrl)) {
      throw new Error("Motion requires its approved plate and matching performance video");
    }
  }
}

async function validateOwned(payload: PerformanceVariantPayload, userId: string): Promise<void> {
  validateVariantStructure(payload);
  await Promise.all(Object.values(payload.references).filter(Boolean).map((url) => assertOwnedReferenceImage(url!, userId)));
  if (payload.phoneVideoUrl) assertOwnStudioUpload(payload.phoneVideoUrl, userId);
  if (payload.audioUrl) assertOwnStudioUpload(payload.audioUrl, userId);
  for (const url of Object.values(payload.angleVideoOverrides)) assertOwnStudioUpload(url, userId);
  for (const plate of [payload.base, ...payload.angles]) {
    if (!plate) continue;
    const { data } = await supabaseAdmin.from("generations")
      .select("id, result_image_url")
      .eq("id", plate.generationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!data?.result_image_url || mediaIdentity(data.result_image_url) !== mediaIdentity(plate.url)) {
      throw new Error("Generated plate provenance is invalid");
    }
  }
  for (const motion of payload.motions) {
    const [{ data: generation }, { data: job }] = await Promise.all([
      supabaseAdmin.from("generations").select("id, kind").eq("id", motion.generationId).eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("jobs").select("id, generation_id").eq("id", motion.jobId).eq("user_id", userId).maybeSingle(),
    ]);
    if (!generation || generation.kind !== "motion" || job?.generation_id !== motion.generationId) {
      throw new Error("Motion generation/job provenance is invalid");
    }
  }
}

function storagePayload(payload: PerformanceVariantPayload, fingerprint: string) {
  const stored: Record<string, unknown> = structuredClone(payload) as unknown as Record<string, unknown>;
  const references = stored.references as Record<string, string | null>;
  const referencePaths: Record<string, string> = {};
  stored.referencePaths = referencePaths;
  for (const [key, url] of Object.entries(payload.references)) {
    if (url) referencePaths[key] = objectPath(url);
    references[key] = null;
  }
  for (const key of ["phoneVideoUrl", "audioUrl"] as const) {
    if (payload[key]) stored[`${key}Path`] = objectPath(payload[key]!);
    stored[key] = null;
  }
  const angleVideoOverridePaths: Record<string, string> = {};
  stored.angleVideoOverridePaths = angleVideoOverridePaths;
  for (const [key, url] of Object.entries(payload.angleVideoOverrides)) {
    angleVideoOverridePaths[key] = objectPath(url);
  }
  stored.angleVideoOverrides = {};
  stored.inputFingerprint = fingerprint;
  stored.approvalProvenance = {
    base: payload.base?.approved ? payload.base.generationId : null,
    angles: Object.fromEntries(payload.angles.filter((angle) => angle.approved).map((angle) => [angle.presetId, angle.generationId])),
  };
  return stored;
}

async function clientPayload(raw: Record<string, unknown>, userId: string): Promise<PerformanceVariantPayload> {
  const value = structuredClone(raw) as Record<string, unknown>;
  value.references = { ...value.references as Record<string, string | null> };
  const referencePaths = value.referencePaths && typeof value.referencePaths === "object"
    ? value.referencePaths as Record<string, unknown>
    : {};
  const angleVideoOverridePaths = value.angleVideoOverridePaths && typeof value.angleVideoOverridePaths === "object"
    ? value.angleVideoOverridePaths as Record<string, unknown>
    : {};
  const sign = async (path: unknown) => {
    if (typeof path !== "string") return null;
    const { data, error } = await supabaseAdmin.storage.from("studio").createSignedUrl(path, 60 * 60 * 24);
    if (error || !data?.signedUrl) throw new Error("Could not restore workflow media");
    return data.signedUrl;
  };
  for (const [key, path] of Object.entries(referencePaths)) {
    (value.references as Record<string, string | null>)[key] = await sign(path);
  }
  value.phoneVideoUrl = await sign(value.phoneVideoUrlPath);
  value.audioUrl = await sign(value.audioUrlPath);
  value.angleVideoOverrides = {};
  for (const [key, path] of Object.entries(angleVideoOverridePaths)) {
    (value.angleVideoOverrides as Record<string, string>)[key] = (await sign(path)) ?? "";
  }
  const rawAngles = Array.isArray(value.angles) ? value.angles : [];
  await Promise.all(([value.base, ...rawAngles]).map(async (plate, index) => {
    if (!plate || typeof plate !== "object") return;
    const plateRecord = plate as Record<string, unknown>;
    const generationId = plateRecord.generationId;
    if (typeof generationId !== "string") return;
    const { data } = await supabaseAdmin.from("generations").select("result_image_url")
      .eq("id", generationId).eq("user_id", userId).maybeSingle();
    if (!data?.result_image_url) throw new Error("Could not restore generated plate");
    let url = data.result_image_url;
    try { url = (await sign(objectPath(url))) ?? url; } catch { /* owned provider URL remains canonical */ }
    if (index === 0) value.base = { ...plateRecord, url };
    else rawAngles[index - 1] = { ...plateRecord, url };
  }));
  value.angles = rawAngles;
  return PerformanceVariantPayloadSchema.parse(value);
}

export const loadPerformanceVariant = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ mode: Mode, kind: Kind }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin.from("performance_variant_drafts")
      .select("payload, revision").eq("user_id", context.userId).eq("mode", data.mode).eq("workflow_kind", data.kind).maybeSingle();
    if (error) throw new Error(error.message);
    return row ? { payload: await clientPayload(row.payload as unknown as Record<string, unknown>, context.userId), revision: row.revision as number } : { payload: null, revision: 0 };
  });

export const savePerformanceVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ expectedRevision: z.number().int().min(0), payload: PerformanceVariantPayloadSchema }).parse(input))
  .handler(async ({ data, context }) => {
    await validateOwned(data.payload, context.userId);
    const { performanceVariantInputFingerprint } = await import("./motion-preview-fingerprint.server");
    const fingerprint = performanceVariantInputFingerprint(data.payload);
    const { data: previous } = await supabaseAdmin.from("performance_variant_drafts").select("payload, revision")
      .eq("user_id", context.userId).eq("mode", data.payload.mode).eq("workflow_kind", data.payload.kind).maybeSingle();
    if (previous && previous.revision !== data.expectedRevision) {
      return { ok: false as const, revision: previous.revision as number, payload: await clientPayload(previous.payload as unknown as Record<string, unknown>, context.userId) };
    }
    const previousPayload = previous?.payload as unknown as Record<string, unknown> | null;
    let canonical = previousPayload?.inputFingerprint && previousPayload.inputFingerprint !== fingerprint
      ? { ...data.payload, base: null, angles: [], motions: [] }
      : data.payload;
    canonical = {
      ...canonical,
      angles: canonical.angles.filter((angle) => canonical.selectedAngles.includes(angle.presetId)),
      motions: canonical.motions.filter((motion) => motion.presetId === "base" || canonical.selectedAngles.includes(motion.presetId)),
    };
    const stored = storagePayload(canonical, fingerprint);
    const next = data.expectedRevision + 1;
    const query = previous
      ? supabaseAdmin.from("performance_variant_drafts").update({ payload: stored as unknown as Json, revision: next, updated_at: new Date().toISOString() })
        .eq("user_id", context.userId).eq("mode", canonical.mode).eq("workflow_kind", canonical.kind).eq("revision", data.expectedRevision)
      : supabaseAdmin.from("performance_variant_drafts").insert({ user_id: context.userId, mode: canonical.mode, workflow_kind: canonical.kind, payload: stored as unknown as Json, revision: 1 });
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true as const, revision: next, payload: canonical };
  });

const GenerateInput = z.object({ payload: PerformanceVariantPayloadSchema, presetId: z.string().optional() });
export const generatePerformanceVariantPlate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    await validateOwned(data.payload, context.userId);
    validateVariantRequirements(data.payload);
    if (data.presetId && !data.payload.base?.approved) throw new Error("Approve the base scene before generating re-angles");
    const preset = data.presetId ? [...REANGLE_PRESETS, ...LUXURY_INTERIOR_PRESETS].find((item) => item.id === data.presetId) : null;
    if (data.presetId && !preset) throw new Error("Unknown re-angle");
    if (data.presetId && !data.payload.selectedAngles.includes(data.presetId)) throw new Error("Select this variant before generating it");
    if (data.presetId) {
      const { data: saved } = await supabaseAdmin.from("performance_variant_drafts").select("payload")
        .eq("user_id", context.userId).eq("mode", data.payload.mode).eq("workflow_kind", data.payload.kind).maybeSingle();
      const savedPayload = saved?.payload as unknown as { approvalProvenance?: { base?: unknown } } | null;
      if (savedPayload?.approvalProvenance?.base !== data.payload.base?.generationId) {
        throw new Error("The approved base must be saved before generating continuity variants");
      }
    }
    const refs = data.presetId
      ? [data.payload.base!.url, data.payload.references.identity!]
      : Object.values(data.payload.references).filter(Boolean) as string[];
    const settings = Object.entries(data.payload.settings).map(([key, value]) => `${key}: ${value}`).join("\n");
    const prompt = preset
      ? `Re-angle the approved base scene. ${preset.direction} Preserve exact identity, outfit, prop, scene geometry, lighting and action. ARRI cinematic image, shallow depth of field, natural detailed skin.`
      : `Create the canonical ${data.payload.kind === "build_scene" ? "performance scene" : "luxury seated interior performance"} from every role reference.\n${settings}\nPreserve exact identity. ARRI cinematic image, shallow depth of field, natural detailed skin, no text.`;
    const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");
    const result = await reserveOrchestrateRecord({
      userId: context.userId, kind: "image", prompt, model: "google/gemini-3.1-flash-image-preview",
      imageUrls: refs, cost: computeCost({ features: ["image"] }).total, reason: "performance_variant",
    });
    if (!result.ok) throw new Error(result.error);
    const { data: generation } = await supabaseAdmin.from("generations").select("result_image_url").eq("id", result.generationId).eq("user_id", context.userId).single();
    if (!generation?.result_image_url) throw new Error("Generated plate was not persisted");
    return { url: generation.result_image_url, generationId: result.generationId, presetId: data.presetId ?? null };
  });