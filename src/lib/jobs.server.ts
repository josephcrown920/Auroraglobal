// Worker loop for the public.jobs queue.
// Runs inside an isolated server-only handler (the /api/public/jobs/tick route
// or any cron caller). Claims one job atomically via claim_next_job(), runs the
// matching pipeline, commits or releases the credit reservation, and updates
// both the job row and the linked generations row.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { orchestrate, type GenerateKind, type GenerateRequest } from "./orchestrator.server";
import { buildMimicMotionRequest, type MotionParams } from "./motion-workflows.server";
import { hfTextToSpeech } from "./hf.server";
import {
  generateUGCScript,
  buildUGCImagePrompt,
  buildUGCMotionPrompt,
  UGC_TTS_MODEL,
} from "./ugc.server";

// `orchestrate` is dependency-injected (threaded through the runners) rather than
// imported-and-called directly so the worker loop is unit-testable WITHOUT
// `mock.module("./orchestrator.server")`. Bun's module mocks are process-global
// and would leak a stubbed orchestrate into the real orchestrator tests.
type Orchestrate = typeof orchestrate;
type JobDeps = { orchestrate: Orchestrate };
const defaultDeps: JobDeps = { orchestrate };

// Result envelope for every job runner. Single-media runners populate `url`;
// the campaign runner additionally sets both `imageUrl` and `videoUrl` so the
// matched pair lands on one generations row. `meta` surfaces graceful
// degradation (template script, skipped voice / lip-sync) to callers.
type JobOutput = {
  url: string;
  provider: string;
  endpoint: string;
  imageUrl?: string;
  videoUrl?: string;
  meta?: Record<string, unknown>;
};

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
  created_at?: string | null;
};

// ─── Persistent retry policy ─────────────────────────────────────────────────
// A failed generation keeps getting re-queued until it succeeds, WITHIN sane
// limits, instead of being abandoned after the old hard `attempts < max_attempts`
// cap. Two independent bounds stop runaway compute/credit cost on hopeless jobs:
//   - an absolute attempt ceiling, and
//   - an absolute age deadline (since the job was created).
// `claim_next_job` increments `attempts` on every claim, so `attempts` doubles as
// the persistent retry counter; `scheduled_at` carries the backoff.
export const PERSISTENT_RETRY_MAX_ATTEMPTS = 48;
export const PERSISTENT_RETRY_MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48h
const RETRY_BACKOFF_BASE_MS = 30_000; // 30s
const RETRY_BACKOFF_CAP_MS = 30 * 60_000; // 30m
const RETRY_BACKOFF_MAX_DOUBLINGS = 6; // base * 2^6 = 32m → clamped by the cap

// How long a job may sit in `processing` before we treat its worker as dead and
// re-queue it (the worker died mid-run under request-driven autoscale). Worker
// finalization is fenced on lock ownership (see finishJob), so if this fires on a
// job that is actually still running, the late finish loses the CAS and can't
// double-commit/release — the threshold only trades orphan-recovery latency
// against the (rare) chance of a duplicate provider call.
export const STALE_PROCESSING_SECONDS = 15 * 60; // 15m

// Clearly-terminal failures: retrying will never help, so stop immediately and
// release the reservation rather than burning credits. Everything else (network
// blips, 429/5xx, timeouts, and unknown errors) is treated as transient and kept
// retrying — we bias toward retrying so a flaky provider never strands a paid
// render. Keep this conservative: a false "terminal" gives up on a paid job.
const TERMINAL_ERROR_RE =
  /\b(insufficient_credits|unauthorized|forbidden|401|403|400)\b|invalid|not[ _]trusted|untrusted|\brequire[ds]?\b|missing\b|unsupported|no path for kind/i;

export function classifyJobError(message: string): "terminal" | "transient" {
  return TERMINAL_ERROR_RE.test(message) ? "terminal" : "transient";
}

/** Capped exponential backoff (+jitter) for the next retry, as an ISO string. */
export function nextRetryAt(attempts: number, now: number = Date.now()): string {
  const doublings = Math.min(Math.max(attempts, 0), RETRY_BACKOFF_MAX_DOUBLINGS);
  const base = Math.min(RETRY_BACKOFF_BASE_MS * Math.pow(2, doublings), RETRY_BACKOFF_CAP_MS);
  const jitter = Math.floor(Math.random() * 5_000);
  return new Date(now + base + jitter).toISOString();
}

export type RetryDecision = { retry: boolean; reason: "transient" | "terminal" | "max_attempts" | "max_age" };

/** Decide whether a failed job should be re-queued or terminally failed. */
export function retryDecision(
  job: Pick<JobRow, "attempts" | "created_at">,
  message: string,
  now: number = Date.now(),
): RetryDecision {
  if (classifyJobError(message) === "terminal") return { retry: false, reason: "terminal" };
  if (job.attempts >= PERSISTENT_RETRY_MAX_ATTEMPTS) return { retry: false, reason: "max_attempts" };
  if (job.created_at) {
    const ageMs = now - new Date(job.created_at).getTime();
    if (Number.isFinite(ageMs) && ageMs >= PERSISTENT_RETRY_MAX_AGE_MS) {
      return { retry: false, reason: "max_age" };
    }
  }
  return { retry: true, reason: "transient" };
}

async function rpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
  // Loose typing — generated types regenerate after migration.
  const client = supabaseAdmin as unknown as {
    rpc: (
      n: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: T; error: { message: string } | null }>;
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
  await supabaseAdmin
    .from("generations")
    .update(patch as never)
    .eq("id", genId);
  void jobId;
}

// Transition a claimed job out of `processing`, FENCED on still owning the lock
// (`locked_by = workerId AND status = 'processing'`). Returns true only if this
// worker won the transition. This is the credit-safety guard against the
// stale-sweep race: if the sweeper requeued this job and another worker reclaimed
// it (changing locked_by), this update matches no row and the caller MUST NOT
// commit or release the reservation — the new owner will.
async function finishJob(
  job: JobRow,
  workerId: string,
  opts: {
    status: "succeeded" | "failed" | "retry";
    result?: Record<string, unknown>;
    error?: string;
  },
): Promise<boolean> {
  const patch: Record<string, unknown> = {
    finished_at: new Date().toISOString(),
    locked_at: null,
    locked_by: null,
  };
  if (opts.status === "retry") {
    patch.status = "queued";
    // `attempts` was already incremented by claim_next_job, so subtract one to
    // keep the first retry at the 30s backoff base rather than 60s.
    patch.scheduled_at = nextRetryAt(Math.max(0, job.attempts - 1));
    patch.error = opts.error ?? null;
  } else {
    patch.status = opts.status;
    if (opts.result) patch.result = opts.result;
    if (opts.error) patch.error = opts.error;
  }
  const { data } = await supabaseAdmin
    .from("jobs")
    .update(patch as never)
    .eq("id", job.id)
    .eq("locked_by", workerId)
    .eq("status", "processing")
    .select("id");
  return Array.isArray(data) && data.length > 0;
}

// ─── Dispatch ───────────────────────────────────────────────────────────────
// kind == "image" | "video" | "lipsync" | "upscale" → run orchestrator
// kind == "tiktok_remix_child" → run a single TikTok variant (image-to-video)

const MEDIA_KINDS = new Set<GenerateKind>(["image", "video", "lipsync", "upscale", "motion"]);

async function runMediaJob(
  job: JobRow,
  orch: Orchestrate,
): Promise<{ url: string; provider: string; endpoint: string }> {
  const req = job.payload as Partial<GenerateRequest>;
  const kind = (req.kind ?? job.kind) as GenerateKind;
  if (!MEDIA_KINDS.has(kind)) throw new Error(`Unsupported media kind: ${kind}`);
  const result = await orch({
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

async function runTiktokRemixChild(job: JobRow, orch: Orchestrate) {
  const p = job.payload as {
    sourceVideoUrl: string;
    sourceImageUrl?: string;
    prompt: string;
    duration?: number;
    remixId: string;
    index: number;
  };
  const result = await orch({
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
  const ids = Array.isArray(remix?.child_generation_ids)
    ? (remix!.child_generation_ids as unknown[])
    : [];
  if (job.generation_id) ids.push(job.generation_id);
  await supabaseAdmin
    .from("tiktok_remixes")
    .update({ child_generation_ids: ids } as never)
    .eq("id", p.remixId);

  return { url: result.url, provider: result.provider, endpoint: result.endpoint };
}

// Performance Shot: reskin a real performance video onto an avatar. Multi-stage,
// each stage reusing the orchestrator so it routes across all configured backends:
//   1. render a styled still of the avatar (outfit / location) — `image`
//   2. drive that still with the performance video — `motion` (MimicMotion)
//   3. (optional) relip to a supplied audio track — `lipsync`
// Stages 2 and 3 are video-producing; the final clip is what we save.
async function runPerformanceReskin(job: JobRow, orch: Orchestrate) {
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
  const still = await orch({
    kind: "image",
    prompt: styleSegs.join(", "),
    imageUrls: [p.avatarImageUrl],
    userId: job.user_id,
    refId: job.id,
  });

  // Stage 2 — drive the styled still with the performance video (MimicMotion).
  const motion = await orch({
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
    final = await orch({
      kind: "lipsync",
      videoUrl: motion.url,
      audioUrl: p.audioUrl,
      userId: job.user_id,
      refId: job.id,
    });
  }

  return { url: final.url, provider: final.provider, endpoint: final.endpoint };
}

// ─── Studio upload helper ─────────────────────────────────────────────────────
// Only used to stash generated TTS audio so the lip-sync stage can reference it;
// `orchestrate` re-signs studio refs before handing them to a provider. Final
// image/video results are returned as the raw provider URL — exactly like every
// other runner (runRemix / runMediaJob / runPerformanceReskin) — because the
// `studio` bucket is private and its `getPublicUrl` is not client-readable.

async function uploadBytesToStudio(
  path: string,
  bytes: Uint8Array | Buffer,
  contentType: string,
): Promise<string> {
  const { error } = await supabaseAdmin.storage
    .from("studio")
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`studio upload failed: ${error.message}`);
  return supabaseAdmin.storage.from("studio").getPublicUrl(path).data.publicUrl;
}

// UGC ad: avatar + scene + product → talking native ad. Multi-stage, each stage
// reusing the orchestrator so it routes across every configured backend:
//   1. script        — LLM (template fallback when no LLM key)
//   2. voice         — HF text-to-speech (skipped when no HF_TOKEN)
//   3. styled still  — `image` (avatar reference + scene + product)
//   4. image→video   — `video`
//   5. lip-sync      — `lipsync` (only when voice audio was produced)
// The final clip is saved; degradation is surfaced in `meta`.
async function runUGCAd(job: JobRow, orch: Orchestrate): Promise<JobOutput> {
  const p = job.payload as {
    avatarImageUrl?: string;
    avatarName?: string;
    vibe?: string | null;
    sceneHint?: string;
    sceneName?: string;
    productPrompt: string;
    aspect?: string;
    duration?: number;
    voiceModel?: string;
  };
  if (!p.productPrompt) throw new Error("ugc_ad requires productPrompt");
  const duration = Math.max(3, Math.min(12, p.duration ?? 8));

  // Stage 1 — script
  const {
    script,
    source: scriptSource,
    provider: scriptProvider,
  } = await generateUGCScript({
    avatarName: p.avatarName,
    productPrompt: p.productPrompt,
    sceneHint: p.sceneHint,
    durationSec: duration,
  });

  // Stage 2 — voice (optional)
  let audioUrl: string | undefined;
  let ttsSkipped: string | null = null;
  if (process.env.HF_TOKEN) {
    try {
      const tts = await hfTextToSpeech(p.voiceModel || UGC_TTS_MODEL, script.full);
      audioUrl = await uploadBytesToStudio(
        `${job.user_id}/audio/${job.id}.flac`,
        Buffer.from(tts.bytes),
        tts.contentType,
      );
    } catch (e) {
      ttsSkipped = `tts_failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    ttsSkipped = "no HF_TOKEN configured";
  }

  // Stage 3 — styled still featuring the avatar
  const still = await orch({
    kind: "image",
    model: "google/nano-banana",
    prompt: buildUGCImagePrompt({
      avatarName: p.avatarName,
      vibe: p.vibe,
      sceneHint: p.sceneHint,
      productPrompt: p.productPrompt,
      aspect: p.aspect,
    }),
    imageUrls: p.avatarImageUrl ? [p.avatarImageUrl] : undefined,
    userId: job.user_id,
    refId: job.id,
  });

  // Stage 4 — animate the still
  const clip = await orch({
    kind: "video",
    model: "seedance-2.0-fast",
    prompt: buildUGCMotionPrompt({
      avatarName: p.avatarName,
      sceneName: p.sceneName,
      productPrompt: p.productPrompt,
    }),
    imageUrls: [still.url],
    duration,
    userId: job.user_id,
    refId: job.id,
  });

  // Stage 5 — lip-sync only when we produced voice audio. If no lip-sync provider
  // is configured (or the stage fails), degrade EXPLICITLY to the silent animated
  // clip instead of failing the whole job; the reason is surfaced in `meta`.
  let final = clip;
  let lipsyncSkipped: string | boolean = true;
  if (audioUrl) {
    try {
      final = await orch({
        kind: "lipsync",
        videoUrl: clip.url,
        audioUrl,
        userId: job.user_id,
        refId: job.id,
      });
      lipsyncSkipped = false;
    } catch (e) {
      final = clip;
      lipsyncSkipped = `lipsync_failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return {
    url: final.url,
    videoUrl: final.url,
    provider: final.provider,
    endpoint: final.endpoint,
    meta: {
      script: script.full,
      script_source: scriptSource,
      ...(scriptProvider ? { script_provider: scriptProvider } : {}),
      tts_skipped: ttsSkipped,
      lipsync_skipped: lipsyncSkipped,
      duration,
    },
  };
}

// UGC campaign item: one matched image + video set for a named avatar. The still
// and its animation are saved together on a single generations row.
async function runCampaignItem(job: JobRow, orch: Orchestrate): Promise<JobOutput> {
  const p = job.payload as {
    avatarImageUrl?: string;
    imagePrompt: string;
    motionPrompt?: string;
    duration?: number;
    label?: string;
  };
  if (!p.imagePrompt) throw new Error("ugc_campaign_item requires imagePrompt");
  const duration = Math.max(3, Math.min(12, p.duration ?? 5));

  const still = await orch({
    kind: "image",
    model: "google/nano-banana",
    prompt: p.imagePrompt,
    imageUrls: p.avatarImageUrl ? [p.avatarImageUrl] : undefined,
    userId: job.user_id,
    refId: job.id,
  });
  const imageUrl = still.url;

  const clip = await orch({
    kind: "video",
    model: "seedance-2.0-fast",
    prompt: p.motionPrompt || `subtle natural motion, ${p.imagePrompt}`,
    imageUrls: [still.url],
    duration,
    userId: job.user_id,
    refId: job.id,
  });
  const videoUrl = clip.url;

  return {
    url: videoUrl,
    imageUrl,
    videoUrl,
    provider: clip.provider,
    endpoint: clip.endpoint,
    meta: { label: p.label ?? null, duration },
  };
}

export async function processOneJob(
  workerId: string,
  deps: JobDeps = defaultDeps,
): Promise<{ processed: boolean; jobId?: string; status?: string; error?: string }> {
  const job = await claimNext(workerId);
  if (!job) return { processed: false };

  const orch = deps.orchestrate;
  try {
    let out: JobOutput;
    if (job.kind === "tiktok_remix_child") {
      out = await runTiktokRemixChild(job, orch);
    } else if (job.kind === "performance_reskin") {
      out = await runPerformanceReskin(job, orch);
    } else if (job.kind === "ugc_ad") {
      out = await runUGCAd(job, orch);
    } else if (job.kind === "ugc_campaign_item") {
      out = await runCampaignItem(job, orch);
    } else {
      out = await runMediaJob(job, orch);
    }

    // Update generations row. A matched image+video result (campaign sets) fills
    // both URL columns; everything else routes to one column by media type.
    const genPatch: Record<string, unknown> = { status: "succeeded", model: out.provider };
    if (out.imageUrl && out.videoUrl) {
      genPatch.result_image_url = out.imageUrl;
      genPatch.result_video_url = out.videoUrl;
    } else {
      const payloadKind = (job.payload as { kind?: string })?.kind;
      const isVideo =
        payloadKind === "video" ||
        payloadKind === "motion" ||
        job.kind === "video" ||
        job.kind === "tiktok_remix_child" ||
        job.kind === "performance_reskin" ||
        job.kind === "ugc_ad" ||
        job.kind === "motion" ||
        job.kind === "lipsync";
      genPatch[isVideo ? "result_video_url" : "result_image_url"] = out.url;
    }
    // Fence the completion on still owning the lock BEFORE writing the success or
    // committing credits. If a stale-sweep requeued this job and another worker
    // reclaimed it — and possibly already terminally failed + released it — we lose
    // the CAS and must touch nothing: writing the generation `succeeded` here would
    // expose a delivered render after a refund, and committing would double-charge.
    // The new owner is authoritative.
    const won = await finishJob(job, workerId, { status: "succeeded", result: out });
    if (won) {
      await markGeneration(job.id, job.generation_id, genPatch);
      if (job.credits_reserved > 0) {
        try {
          await rpc("commit_reservation", {
            _user: job.user_id,
            _amount: job.credits_reserved,
            _reason: `job_${job.kind}`,
            _ref: job.id,
          });
        } catch (commitErr) {
          // The render is delivered and the job is already marked succeeded; never
          // release here (that would refund a delivered render). Surface for ops.
          console.error("[jobs] commit_reservation failed after success", job.id, commitErr);
        }
      }
    }
    return { processed: true, jobId: job.id, status: won ? "succeeded" : "stale" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const decision = retryDecision(job, msg);

    if (decision.retry) {
      // Transient/unknown failure: keep the reservation held (NEVER release on a
      // retry — that would refund a render we still intend to deliver) and
      // re-queue with backoff. Fenced so a worker that has lost the lock to a
      // stale-sweep reclaim doesn't clobber the new owner's run.
      const won = await finishJob(job, workerId, { status: "retry", error: msg });
      if (won) {
        await markGeneration(job.id, job.generation_id, {
          status: "retrying",
          error: msg.slice(0, 1000),
        });
      }
      return { processed: true, jobId: job.id, status: won ? "retry" : "stale", error: msg };
    }

    // Terminal failure (hopeless error, or the retry ceiling/age deadline was
    // reached). Fence the transition first, then release the reservation EXACTLY
    // once — only the worker that wins the CAS releases, so a stale-sweep race can
    // never refund twice.
    const failNote =
      decision.reason === "max_attempts"
        ? ` (gave up after ${job.attempts} attempts)`
        : decision.reason === "max_age"
          ? " (gave up after retry window elapsed)"
          : "";
    const failError = `${msg}${failNote}`;
    const won = await finishJob(job, workerId, { status: "failed", error: failError });
    if (won) {
      if (job.credits_reserved > 0) {
        await rpc("release_reservation", {
          _user: job.user_id,
          _amount: job.credits_reserved,
          _reason: `job_${job.kind}`,
          _ref: job.id,
        });
      }
      await markGeneration(job.id, job.generation_id, {
        status: "failed",
        error: failError.slice(0, 1000),
      });
    }
    return { processed: true, jobId: job.id, status: won ? "failed" : "stale", error: failError };
  }
}

export async function processBatch(
  workerId: string,
  limit = 5,
  deps: JobDeps = defaultDeps,
): Promise<Array<Awaited<ReturnType<typeof processOneJob>>>> {
  const results = [];
  for (let i = 0; i < limit; i++) {
    const r = await processOneJob(workerId, deps);
    results.push(r);
    if (!r.processed) break;
  }
  return results;
}

// ─── Sweeper + scheduler heartbeat ───────────────────────────────────────────

// Recover jobs orphaned in `processing` because their worker instance was killed
// mid-run (the common orphan source under request-driven autoscale). These jobs
// still hold their reservation, so re-queuing them is credit-safe. Terminally
// failed jobs and synchronous-path failed generations are intentionally NOT
// resurrected here: their reservation was already released, so re-running them
// would silently re-charge the customer.
export async function sweepStaleProcessingJobs(
  maxAgeSeconds: number = STALE_PROCESSING_SECONDS,
): Promise<{ reset: number }> {
  const out = await rpc<number | null>("reset_stale_processing_jobs", {
    _max_age_seconds: maxAgeSeconds,
    _backoff_seconds: 15,
  });
  return { reset: typeof out === "number" ? out : 0 };
}

// Untyped accessor — `scheduler_heartbeats` is not in the generated Supabase
// types (same pattern the rest of the codebase uses for not-yet-typed tables).
type HeartbeatUpsert = {
  upsert: (
    values: Record<string, unknown>,
    options: { onConflict: string },
  ) => Promise<{ error: { message: string } | null }>;
};

/**
 * Stamp a scheduler's liveness so a stalled cron is observable in admin. Best
 * effort: a heartbeat write must never break the tick it is reporting on.
 */
export async function recordSchedulerHeartbeat(
  name: string,
  ok: boolean,
  error?: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    name,
    last_run_at: now,
    updated_at: now,
    last_error: ok ? null : (error ?? null),
  };
  if (ok) patch.last_ok_at = now;
  try {
    const table = (supabaseAdmin as unknown as { from: (t: string) => HeartbeatUpsert }).from(
      "scheduler_heartbeats",
    );
    await table.upsert(patch, { onConflict: "name" });
  } catch {
    // swallow — heartbeat is observability, not correctness
  }
}
