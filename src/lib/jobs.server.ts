// Worker loop for the public.jobs queue.
// Runs inside an isolated server-only handler (the /api/public/jobs/tick route
// or any cron caller). Claims one job atomically via claim_next_job(), runs the
// matching pipeline, commits or releases the credit reservation, and updates
// both the job row and the linked generations row.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { orchestrate, type GenerateKind, type GenerateRequest } from "./orchestrator.server";
import { buildMimicMotionRequest, type MotionParams } from "./motion-workflows.server";

type JobRow = {
  id: string;
  user_id: string;
  kind: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
  credits_reserved: number;
  generation_id: string | null;
  parent_job_id: string | null;
};

async function rpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
  // Loose typing — generated types regenerate after migration.
  const client = supabaseAdmin as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: T; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

async function claimNext(workerId: string): Promise<JobRow | null> {
  const row = await rpc<JobRow | JobRow[] | null>("claim_next_job", { _worker: workerId });
  if (!row) return null;
  return Array.isArray(row) ? (row[0] ?? null) : row;
}

async function markGeneration(jobId: string, genId: string | null, patch: Record<string, unknown>) {
  if (!genId) return;
  await supabaseAdmin.from("generations").update(patch as never).eq("id", genId);
  void jobId;
}

async function finishJob(job: JobRow, opts: {
  status: "succeeded" | "failed" | "retry";
  result?: Record<string, unknown>;
  error?: string;
}) {
  const patch: Record<string, unknown> = {
    finished_at: new Date().toISOString(),
    locked_at: null,
    locked_by: null,
  };
  if (opts.status === "retry") {
    patch.status = "queued";
    patch.scheduled_at = new Date(Date.now() + 30_000 * Math.pow(2, job.attempts)).toISOString();
    patch.error = opts.error ?? null;
  } else {
    patch.status = opts.status;
    if (opts.result) patch.result = opts.result;
    if (opts.error) patch.error = opts.error;
  }
  await supabaseAdmin.from("jobs").update(patch as never).eq("id", job.id);
}

// ─── Dispatch ───────────────────────────────────────────────────────────────
// kind == "image" | "video" | "lipsync" | "upscale" → run orchestrator
// kind == "tiktok_remix_child" → run a single TikTok variant (image-to-video)

const MEDIA_KINDS = new Set<GenerateKind>(["image", "video", "lipsync", "upscale", "motion"]);

async function runMediaJob(job: JobRow): Promise<{ url: string; provider: string; endpoint: string }> {
  const req = job.payload as Partial<GenerateRequest>;
  const kind = (req.kind ?? job.kind) as GenerateKind;
  if (!MEDIA_KINDS.has(kind)) throw new Error(`Unsupported media kind: ${kind}`);
  const result = await orchestrate({
    kind,
    prompt: req.prompt,
    imageUrls: req.imageUrls,
    audioUrl: req.audioUrl,
    videoUrl: req.videoUrl,
    duration: req.duration,
    resolution: req.resolution,
    model: req.model,
    params: req.params,
    comfyWorkflow: req.comfyWorkflow,
    comfyInputs: req.comfyInputs,
    userId: job.user_id,
    refId: job.id,
  });
  return { url: result.url, provider: result.provider, endpoint: result.endpoint };
}

async function runTiktokRemixChild(job: JobRow) {
  const p = job.payload as {
    sourceVideoUrl: string;
    sourceImageUrl?: string;
    prompt: string;
    duration?: number;
    remixId: string;
    index: number;
  };
  const result = await orchestrate({
    kind: "video",
    prompt: p.prompt,
    imageUrls: p.sourceImageUrl ? [p.sourceImageUrl] : undefined,
    videoUrl: p.sourceVideoUrl,
    duration: p.duration ?? 5,
    model: "seedance-2.0-fast",
    userId: job.user_id,
    refId: job.id,
  });

  // Append to parent remix.child_generation_ids
  const { data: remix } = await supabaseAdmin
    .from("tiktok_remixes")
    .select("child_generation_ids")
    .eq("id", p.remixId)
    .maybeSingle();
  const ids = Array.isArray(remix?.child_generation_ids) ? (remix!.child_generation_ids as unknown[]) : [];
  if (job.generation_id) ids.push(job.generation_id);
  await supabaseAdmin.from("tiktok_remixes").update({ child_generation_ids: ids } as never).eq("id", p.remixId);

  return { url: result.url, provider: result.provider, endpoint: result.endpoint };
}

// Performance Shot: reskin a real performance video onto an avatar. Multi-stage,
// each stage reusing the orchestrator so it routes across all configured backends:
//   1. render a styled still of the avatar (outfit / location) — `image`
//   2. drive that still with the performance video — `motion` (MimicMotion)
//   3. (optional) relip to a supplied audio track — `lipsync`
// Stages 2 and 3 are video-producing; the final clip is what we save.
async function runPerformanceReskin(job: JobRow) {
  const p = job.payload as {
    performanceVideoUrl: string;
    avatarImageUrl: string;
    outfit?: string;
    location?: string;
    audioUrl?: string;
    prompt?: string;
    params?: MotionParams;
  };
  if (!p.performanceVideoUrl || !p.avatarImageUrl) {
    throw new Error("performance_reskin requires performanceVideoUrl and avatarImageUrl");
  }

  // Stage 1 — styled avatar still. Outfit/location are STRUCTURED inputs folded
  // into the image prompt here (not motion params).
  const styleSegs = [
    p.prompt?.trim() || "full-body portrait of the same person, photorealistic",
    p.outfit ? `wearing ${p.outfit}` : null,
    p.location ? `at ${p.location}` : null,
    "natural lighting, sharp focus",
  ].filter(Boolean) as string[];
  const still = await orchestrate({
    kind: "image",
    prompt: styleSegs.join(", "),
    imageUrls: [p.avatarImageUrl],
    userId: job.user_id,
    refId: job.id,
  });

  // Stage 2 — drive the styled still with the performance video (MimicMotion).
  const motion = await orchestrate({
    ...buildMimicMotionRequest({
      imageUrl: still.url,
      drivingVideoUrl: p.performanceVideoUrl,
      prompt: p.prompt,
      params: p.params,
    }),
    userId: job.user_id,
    refId: job.id,
  });

  // Stage 3 — optional lip-sync to a supplied audio track. When no audio is
  // given we rely on the motion worker to preserve the source performance audio.
  let final = motion;
  if (p.audioUrl) {
    final = await orchestrate({
      kind: "lipsync",
      videoUrl: motion.url,
      audioUrl: p.audioUrl,
      userId: job.user_id,
      refId: job.id,
    });
  }

  return { url: final.url, provider: final.provider, endpoint: final.endpoint };
}

export async function processOneJob(workerId: string): Promise<{ processed: boolean; jobId?: string; status?: string; error?: string }> {
  const job = await claimNext(workerId);
  if (!job) return { processed: false };

  try {
    let out: { url: string; provider: string; endpoint: string };
    if (job.kind === "tiktok_remix_child") {
      out = await runTiktokRemixChild(job);
    } else if (job.kind === "performance_reskin") {
      out = await runPerformanceReskin(job);
    } else {
      out = await runMediaJob(job);
    }

    // Update generations row
    const payloadKind = (job.payload as { kind?: string })?.kind;
    const isVideo = payloadKind === "video"
      || payloadKind === "motion"
      || job.kind === "video"
      || job.kind === "tiktok_remix_child"
      || job.kind === "performance_reskin"
      || job.kind === "motion"
      || job.kind === "lipsync";
    await markGeneration(job.id, job.generation_id, {
      status: "succeeded",
      model: out.provider,
      [isVideo ? "result_video_url" : "result_image_url"]: out.url,
    });

    // Commit credit reservation
    if (job.credits_reserved > 0) {
      await rpc("commit_reservation", {
        _user: job.user_id,
        _amount: job.credits_reserved,
        _reason: `job_${job.kind}`,
        _ref: job.id,
      });
    }

    await finishJob(job, { status: "succeeded", result: out });
    return { processed: true, jobId: job.id, status: "succeeded" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const canRetry = job.attempts < job.max_attempts && !/insufficient_credits|invalid|unauthorized/i.test(msg);

    if (canRetry) {
      await finishJob(job, { status: "retry", error: msg });
      return { processed: true, jobId: job.id, status: "retry", error: msg };
    }

    // Final failure: release reservation, mark gen failed
    if (job.credits_reserved > 0) {
      await rpc("release_reservation", {
        _user: job.user_id,
        _amount: job.credits_reserved,
        _reason: `job_${job.kind}`,
        _ref: job.id,
      });
    }
    await markGeneration(job.id, job.generation_id, { status: "failed", error: msg.slice(0, 1000) });
    await finishJob(job, { status: "failed", error: msg });
    return { processed: true, jobId: job.id, status: "failed", error: msg };
  }
}

export async function processBatch(workerId: string, limit = 5): Promise<Array<Awaited<ReturnType<typeof processOneJob>>>> {
  const results = [];
  for (let i = 0; i < limit; i++) {
    const r = await processOneJob(workerId);
    results.push(r);
    if (!r.processed) break;
  }
  return results;
}