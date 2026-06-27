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
  duration: z.number().int().min(3).max(12).optional(),
  resolution: z.enum(["480p", "720p", "1080p"]).optional(),
  model: z.string().max(120).optional(),
  // Pluggable-backend passthrough (carried in the job payload → orchestrate).
  params: z.record(z.unknown()).optional(),
  comfyWorkflow: z.unknown().optional(),
  comfyInputs: z.record(z.unknown()).optional(),
});

export const enqueueGenerationJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => EnqueueInput.parse(data))
  .handler(async ({ data, context }) => {
    for (const u of data.imageUrls ?? []) assertTrustedUrl(u);
    if (data.audioUrl) assertTrustedUrl(data.audioUrl);
    if (data.videoUrl) assertTrustedUrl(data.videoUrl);

    const amount = creditCost(data.kind);
    const client = supabaseAdmin as unknown as {
      rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: out, error } = await client.rpc("create_generation_and_reserve", {
      _user: context.userId,
      _kind: data.kind as GenerateKind,
      _prompt: data.prompt ?? "",
      _amount: amount,
      _payload: data as unknown as Record<string, unknown>,
    });
    if (error) {
      if (/insufficient_credits/i.test(error.message)) {
        throw new Error("Not enough credits");
      }
      throw new Error(error.message);
    }
    const row = Array.isArray(out) ? out[0] : out;
    return { jobId: (row as { job_id: string }).job_id, generationId: (row as { generation_id: string }).generation_id };
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