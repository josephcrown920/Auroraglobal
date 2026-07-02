// User-callable job queue server functions.
// Enqueue + atomic credit reservation goes through create_generation_and_reserve.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertTrustedUrl } from "./url-guard";
import type { GenerateKind } from "./orchestrator.server";

function creditCost(kind: string): number {
  switch (kind) {
    case "image":
    case "upscale":
      return 1;
    case "lipsync":
      return 3;
    case "video":
    case "tiktok_remix_child":
    case "motion":
      return 5;
    case "performance_reskin":
      return 8;
    default:
      return 1;
  }
}

// Note: "motion" / "performance_reskin" are intentionally NOT enqueueable here.
// They require a motion-capable GPU worker and must go through the dedicated,
// preflighted server fns (generateMimicMotion / generatePerformanceReskin) so a
// "no motion backend" request never reserves credits.
const EnqueueInput = z.object({
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

export const enqueueGenerationJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => EnqueueInput.parse(data))
  .handler(async ({ data, context }) => {
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
        userId: context.userId,
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
    await assertHdEntitlement(context.userId, data.resolution, previewPass);

    // Previews are cheaper: the queue path prices flat (creditCost), so the
    // preview is half of that flat price (matching the 480p ×0.5 multiplier).
    // NOTE: never price the preview via the model-tiered computeCost here —
    // premium tiers would make the "cheap" preview cost MORE than the flat
    // full-price render it gates.
    const amount = previewPass
      ? Math.max(1, Math.ceil(creditCost(data.kind) * 0.5))
      : creditCost(data.kind);
    const client = supabaseAdmin as unknown as {
      rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: out, error } = await client.rpc("create_generation_and_reserve", {
      _user: context.userId,
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
  });

export const listMyJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("jobs")
      .select("id, kind, status, attempts, error, generation_id, parent_job_id, created_at, finished_at, result")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data;
  });

export const cancelMyJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: job } = await supabaseAdmin
      .from("jobs")
      .select("id, user_id, status, credits_reserved, generation_id, kind")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!job) throw new Error("Not found");
    if (job.status !== "queued") throw new Error(`Cannot cancel a ${job.status} job`);

    const client = supabaseAdmin as unknown as {
      rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    if (job.credits_reserved > 0) {
      await client.rpc("release_reservation", {
        _user: context.userId,
        _amount: job.credits_reserved,
        _reason: `cancel_${job.kind}`,
        _ref: job.id,
      });
    }
    await supabaseAdmin
      .from("jobs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() } as never)
      .eq("id", job.id);
    if (job.generation_id) {
      await supabaseAdmin
        .from("generations")
        .update({ status: "cancelled" } as never)
        .eq("id", job.generation_id);
    }
    return { ok: true as const };
  });