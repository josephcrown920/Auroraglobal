// User-callable job queue server functions.
// Enqueue + atomic credit reservation goes through create_generation_and_reserve.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertTrustedUrl } from "./url-guard";
import type { GenerateKind } from "./orchestrator.server";
import { computeCost, type Feature, type Resolution } from "./pricing";

/** Flat-per-kind reservation for this queue path, sourced from the shared
 *  price list (src/lib/pricing.ts) instead of a local literal table — this
 *  used to hardcode its own numbers (e.g. video=5) that silently drifted
 *  behind a repricing of the shared table. Only "image"/"video"/"lipsync"/
 *  "upscale" are ever passed in (see EnqueueInput below), all valid Features.
 *  `model`/`resolution`/`durationSeconds` are honored so this path gains the
 *  same stacked, resolution/length-aware pricing as every other charge point. */
export function creditCost(
  kind: string,
  opts?: { model?: string | null; resolution?: Resolution | null; durationSeconds?: number | null },
): number {
  return computeCost({
    features: [kind as Feature],
    model: opts?.model,
    resolution: opts?.resolution,
    durationSeconds: opts?.durationSeconds,
  }).total;
}

// Note: "motion" / "performance_reskin" are intentionally NOT enqueueable here.
// They require a motion-capable GPU worker and must go through the dedicated,
// preflighted server fns (generateMimicMotion / generatePerformanceReskin) so a
// "no motion backend" request never reserves credits.
export const EnqueueInput = z.object({
  kind: z.enum(["image", "video", "lipsync", "upscale"]),
  prompt: z.string().max(2000).optional(),
  imageUrls: z.array(z.string().url()).max(6).optional(),
  audioUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  duration: z.number().int().min(3).max(15).optional(),
  resolution: z.enum(["480p", "720p", "1080p", "2160p"]).optional(),
  model: z.string().max(120).optional(),
  // Pluggable-backend passthrough (carried in the job payload → orchestrate).
  params: z.record(z.unknown()).optional(),
  comfyWorkflow: z.unknown().optional(),
  comfyInputs: z.record(z.unknown()).optional(),
  // Preview-confirm gate (task #153): id of a succeeded preview generation the
  // caller owns. Without it, video/lipsync enqueues run as 480p/≤5s previews.
  confirmPreviewId: z.string().uuid().optional(),
});

/** Core enqueue logic, shared between the app server fn and the MCP tool so
 *  billing (preview gate, HD entitlement, flat credit pricing) can never drift
 *  between the two entry points. */
export async function enqueueJobForUser(
  userId: string,
  data: z.infer<typeof EnqueueInput>,
): Promise<{ jobId: string; generationId: string; preview: boolean }> {
  {
    for (const u of data.imageUrls ?? []) assertTrustedUrl(u);
    if (data.audioUrl) assertTrustedUrl(data.audioUrl);
    if (data.videoUrl) assertTrustedUrl(data.videoUrl);

    // Preview-confirm gate: unconfirmed temporal enqueues are forced into a
    // previewOnly job (the worker loop caps them at 480p/≤5s) and priced as a
    // preview. An invalid/expired confirmPreviewId throws before reserving.
    const { resolvePreviewGate, isTemporalKind, PREVIEW_RESOLUTION, PREVIEW_MAX_SECONDS } =
      await import("./cost-guardrails.server");
    let previewPass = false;
    if (isTemporalKind(data.kind)) {
      const gate = await resolvePreviewGate({
        userId,
        confirmPreviewId: data.confirmPreviewId,
      });
      previewPass = !gate.confirmed;
    }
    const payload: Record<string, unknown> = { ...data };
    delete payload.confirmPreviewId;
    if (previewPass) {
      payload.previewOnly = true;
      payload.resolution = PREVIEW_RESOLUTION;
      payload.duration = Math.min(data.duration ?? PREVIEW_MAX_SECONDS, PREVIEW_MAX_SECONDS);
    }

    // HD/4K entitlement: 1080p and 2160p require Pro on confirmed (full-quality) renders.
    const { assertHdEntitlement } = await import("./cost-guardrails.server");
    await assertHdEntitlement(userId, data.resolution, previewPass);

    // Previews are cheaper: half of the DEFAULT-tier flat price (no model,
    // no user-chosen resolution/duration — matching the 480p ×0.5 multiplier).
    // NOTE: never price the preview via the model-tiered/resolution-aware
    // creditCost() below — a premium model or 4K request would make the
    // "cheap" preview cost MORE than the flat full-price render it gates.
    const amount = previewPass
      ? Math.max(1, Math.ceil(creditCost(data.kind) * 0.5))
      : creditCost(data.kind, { model: data.model, resolution: data.resolution, durationSeconds: data.duration });
    const client = supabaseAdmin as unknown as {
      rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: out, error } = await client.rpc("create_generation_and_reserve", {
      _user: userId,
      _kind: data.kind as GenerateKind,
      _prompt: data.prompt ?? "",
      _amount: amount,
      _payload: payload,
    });
    if (error) {
      if (/insufficient_credits/i.test(error.message)) {
        throw new Error("Not enough Aura");
      }
      throw new Error(error.message);
    }
    const row = Array.isArray(out) ? out[0] : out;
    const generationId = (row as { generation_id: string }).generation_id;
    // Mark the generation as a preview so a later confirmPreviewId can verify it.
    if (previewPass && generationId) {
      await supabaseAdmin
        .from("generations")
        .update({ mode: "preview" } as never)
        .eq("id", generationId);
    }
    return {
      jobId: (row as { job_id: string }).job_id,
      generationId,
      preview: previewPass,
    };
  }
}

export const enqueueGenerationJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => EnqueueInput.parse(data))
  .handler(async ({ data, context }) => enqueueJobForUser(context.userId, data));

/** Recent jobs for a user (newest first, capped at 50). Shared by the app
 *  server fn and the MCP tool. */
export async function listJobsForUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select("id, kind, status, attempts, error, generation_id, parent_job_id, created_at, finished_at, result")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data;
}

export const listMyJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return listJobsForUser(context.userId);
  });

/** Single-job status lookup used by client-side poll loops after an
 *  enqueue-only server fn returns {jobId, generationId} — lets the UI keep
 *  showing progress (and eventually the result) even if the tab that started
 *  the render is closed and reopened, since the job/generation rows are the
 *  source of truth, not an in-memory request. */
export const getJobStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: job, error } = await supabaseAdmin
      .from("jobs")
      .select("id, kind, status, error, generation_id")
      .eq("id", data.jobId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) throw new Error("Job not found");

    let generation: {
      status: string | null;
      result_image_url: string | null;
      result_video_url: string | null;
      error: string | null;
    } | null = null;
    if (job.generation_id) {
      const { data: gen } = await supabaseAdmin
        .from("generations")
        .select("status, result_image_url, result_video_url, error")
        .eq("id", job.generation_id)
        .maybeSingle();
      generation = gen ?? null;
    }
    return { job, generation };
  });

export const cancelMyJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => cancelJobForUser(context.userId, data.id));

/** Cancel a queued job (releasing its reservation). Only `queued` jobs can be
 *  cancelled — a processing job already holds a worker lock. Shared by the app
 *  server fn and the MCP tool. */
export async function cancelJobForUser(userId: string, jobId: string): Promise<{ ok: true }> {
  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id, user_id, status, credits_reserved, generation_id, kind")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!job) throw new Error("Not found");
  if (job.status !== "queued") throw new Error(`Cannot cancel a ${job.status} job`);

  // CAS on status='queued' so a concurrent tick/cancel can't double-process
  // (and, critically, so the reservation can't be released twice).
  const { data: cancelled, error: cancelErr } = await supabaseAdmin
    .from("jobs")
    .update({ status: "cancelled", finished_at: new Date().toISOString() } as never)
    .eq("id", job.id)
    .eq("user_id", userId)
    .eq("status", "queued")
    .select("id");
  if (cancelErr) throw new Error(`Cancel failed: ${cancelErr.message}`);
  if (!cancelled || cancelled.length === 0) {
    throw new Error("Cannot cancel: job is no longer queued");
  }

  const client = supabaseAdmin as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  if (job.credits_reserved > 0) {
    const { error: releaseErr } = await client.rpc("release_reservation", {
      _user: userId,
      _amount: job.credits_reserved,
      _reason: `cancel_${job.kind}`,
      _ref: job.id,
    });
    if (releaseErr) {
      throw new Error(
        `Job cancelled but releasing reserved Aura failed: ${releaseErr.message}. Contact support to recover ${job.credits_reserved} Aura.`,
      );
    }
  }
  if (job.generation_id) {
    const { error: genErr } = await supabaseAdmin
      .from("generations")
      .update({ status: "cancelled" } as never)
      .eq("id", job.generation_id);
    if (genErr) throw new Error(`Job cancelled but updating its generation failed: ${genErr.message}`);
  }
  return { ok: true as const };
}