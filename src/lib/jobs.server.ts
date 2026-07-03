// Worker loop for the public.jobs queue.
// Runs inside an isolated server-only handler (the /api/public/jobs/tick route
// or any cron caller). Claims one job atomically via claim_next_job(), runs the
// matching pipeline, commits or releases the credit reservation, and updates
// both the job row and the linked generations row.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  orchestrate,
  hasActiveWorkerForKind,
  type GenerateKind,
  type GenerateRequest,
} from "./orchestrator.server";
import { buildMimicMotionRequest, type MotionParams } from "./motion-workflows.server";
import { hfTextToSpeech } from "./hf.server";
import {
  generateUGCScript,
  buildUGCImagePrompt,
  buildUGCMotionPrompt,
  UGC_TTS_MODEL,
} from "./ugc.server";
import {
  generateKidsStoryScript,
  buildKidsIllustrationPrompt,
  buildKidsMotionPrompt,
  pickKidsMusic,
  estimateNarrationSeconds,
  KIDS_LENGTHS,
  KIDS_MAX_SCENES,
  KIDS_ASPECT,
  KIDS_TTS_MODEL,
  type KidsScene,
  type KidsContentType,
  type KidsAgeRange,
  type KidsLengthId,
} from "./kids-story.server";
import { getMusicTrack, signedAutocutUrl } from "./autocut.server";
import { assertDurationCap } from "./cost-guardrails.server";
import { persistResultUrl, resultMediaTypeForKind } from "./result-store.server";

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

export type RetryDecision = {
  retry: boolean;
  reason: "transient" | "terminal" | "max_attempts" | "max_age";
};

/** Decide whether a failed job should be re-queued or terminally failed. */
export function retryDecision(
  job: Pick<JobRow, "attempts" | "created_at">,
  message: string,
  now: number = Date.now(),
): RetryDecision {
  if (classifyJobError(message) === "terminal") return { retry: false, reason: "terminal" };
  if (job.attempts >= PERSISTENT_RETRY_MAX_ATTEMPTS)
    return { retry: false, reason: "max_attempts" };
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

// Queue lanes (task #153). Every job sits in exactly one lane (`jobs.queue`);
// claims filter on the lanes the caller is willing to serve.
export const JOB_LANES = ["standard", "heavy"] as const;
export type JobLane = (typeof JOB_LANES)[number];

async function claimNext(workerId: string, lanes: readonly JobLane[]): Promise<JobRow | null> {
  const row = await rpc<JobRow | JobRow[] | null>("claim_next_job_v2", {
    _worker: workerId,
    _lanes: [...lanes],
  });
  if (!row) return null;
  return Array.isArray(row) ? (row[0] ?? null) : row;
}

// Lane policy for one batch slot. All slots serve both lanes (priority already
// sorts heavy below standard, so standard drains first), EXCEPT the final slot
// of a multi-slot batch, which is reserved for the heavy lane — under a
// constant flood of standard work heavy jobs still get ≥1 slot per tick
// instead of starving forever. A mixed-lane claim returning null means BOTH
// lanes are empty, so breaking early never skips waiting heavy work.
export function lanesForSlot(slot: number, limit: number): readonly JobLane[] {
  if (limit > 1 && slot === limit - 1) return ["heavy"];
  return JOB_LANES;
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
  const req = job.payload as Partial<GenerateRequest> & { previewOnly?: boolean };
  const kind = (req.kind ?? job.kind) as GenerateKind;
  if (!MEDIA_KINDS.has(kind)) throw new Error(`Unsupported media kind: ${kind}`);

  // Duration cap: enforce the user's plan maximum before dispatching any provider.
  // Only applies to temporal kinds (video/motion) with an explicit requested duration.
  // Error message starts with "Unsupported" which TERMINAL_ERROR_RE matches, so
  // processOneJob refunds credits immediately rather than retrying a hopeless request.
  const isTemporalKind = kind === "video" || kind === "motion";
  const requestedDuration =
    typeof req.duration === "number" && req.duration > 0 ? req.duration : null;
  if (isTemporalKind && requestedDuration !== null && job.user_id) {
    await assertDurationCap(job.user_id, requestedDuration);
  }

  // Preview mode: jobs queued with previewOnly:true are capped at 480p/5s to
  // produce a cheap fast clip. The caller creates a separate full-quality job
  // after the user confirms the preview looks correct.
  const previewOnly = !!req.previewOnly;
  const effDuration = previewOnly ? Math.min(requestedDuration ?? 5, 5) : req.duration;
  const effResolution = previewOnly ? ("480p" as const) : req.resolution;

  const result = await orch({
    kind,
    prompt: req.prompt,
    imageUrls: req.imageUrls,
    audioUrl: req.audioUrl,
    videoUrl: req.videoUrl,
    duration: effDuration,
    resolution: effResolution,
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

// Sign a private-studio object path so a remote worker can fetch it. Used for the
// kids-story `assemble` params (narration + music), which orchestrate's
// signStudioRefs does NOT touch — it only signs the top-level imageUrls/audio/video.
async function signedStudioUrl(path: string, expiresSec = 3 * 60 * 60): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from("studio")
    .createSignedUrl(path, expiresSec);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

// kids_stories is written by the service-role worker; it is not in the generated
// Supabase types until codegen re-runs, so go through a loosely-typed client (the
// same approach avatars.server.ts uses for its table).
function kidsStoriesTable() {
  return (
    supabaseAdmin as unknown as {
      from: (t: string) => {
        update: (patch: Record<string, unknown>) => {
          eq: (
            col: string,
            val: string,
          ) => {
            eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
          };
        };
      };
    }
  ).from("kids_stories");
}

// Every kids-story write is owner-scoped (id + user_id). Both ids come from the
// server-created job, so this is a defense-in-depth invariant: a malformed payload
// can never flip another user's story row.
async function updateStory(
  storyId: string,
  userId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!storyId) return;
  await kidsStoriesTable().update(patch).eq("id", storyId).eq("user_id", userId);
}

// Mark a kids-story row terminally failed (owner-scoped). Called from the job
// terminal-failure path so /kids shows the failed (refunded) state instead of
// spinning on pending/scripting/rendering/assembling forever.
async function failStory(storyId: string, userId: string, error: string): Promise<void> {
  if (!storyId) return;
  await kidsStoriesTable()
    .update({ status: "failed", error: error.slice(0, 1000) })
    .eq("id", storyId)
    .eq("user_id", userId);
}

// Heartbeat: refresh the job's lock timestamp, FENCED on still owning the lock, so
// the 15-minute stale-processing sweep never re-queues a long kids-story render
// (illustration + video + TTS for several scenes) mid-flight and duplicates the
// expensive work. A no-op if this worker has already lost the lock.
async function touchJobLock(jobId: string, workerId: string): Promise<void> {
  await supabaseAdmin
    .from("jobs")
    .update({ locked_at: new Date().toISOString() } as never)
    .eq("id", jobId)
    .eq("locked_by", workerId)
    .eq("status", "processing");
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

// Faceless kids story: a single reserved job that builds an entire illustrated,
// narrated kids video and stitches it into ONE MP4 on a self-hosted GPU worker.
// Per scene it chains illustration → image-to-video → narration TTS, holding the
// character's look across scenes (character description in every prompt PLUS the
// first illustration reused as a reference image). The ordered clips, per-scene
// narrations and a curated, ducked music bed are then assembled by the worker.
// Progress + per-stage errors are written to the kids_stories row throughout, and
// the job lock is heartbeated after each stage so the stale sweep never duplicates
// this expensive multi-minute render.
async function runKidsStory(job: JobRow, orch: Orchestrate, workerId: string): Promise<JobOutput> {
  const p = job.payload as {
    storyId: string;
    contentType: KidsContentType;
    ageRange: KidsAgeRange;
    topic: string;
    lengthId: KidsLengthId;
    characterName: string;
    characterDescription?: string;
    characterImageUrl?: string | null;
    musicId?: string | null;
    aspect?: string;
    sceneCount?: number;
    secondsPerScene?: number;
    script?: { title?: string; scenes?: { narration: string; illustration: string }[] };
  };
  if (!p.storyId) throw new Error("kids_story requires storyId");
  if (!p.topic) throw new Error("kids_story requires a topic");

  // Preflight: the final stitch MUST run on a self-hosted GPU worker. If none can
  // do `assemble`, fail terminally up front (refund) rather than paying for the
  // whole illustration+video+TTS pipeline only to die at the last step. The word
  // "required" classifies this as a terminal error (no retry, reservation released).
  const canAssemble = await hasActiveWorkerForKind("assemble");
  if (!canAssemble) {
    throw new Error(
      "A self-hosted GPU worker with the 'assemble' capability is required to stitch the final kids video, but none is online",
    );
  }

  // Preflight: narration is a required stage — every scene gets its own TTS track. If
  // no TTS backend is configured, fail terminally up front (refund) rather than
  // spending on illustration+video and then silently shipping a video with no
  // narration. "required" classifies this as terminal (no retry, reservation released).
  if (!process.env.HF_TOKEN) {
    throw new Error(
      "Text-to-speech narration is required for kids stories, but no HF_TOKEN is configured to generate it",
    );
  }

  const len = KIDS_LENGTHS[p.lengthId] ?? KIDS_LENGTHS.short;
  const sceneCount = Math.max(1, Math.min(p.sceneCount ?? len.scenes, KIDS_MAX_SCENES));
  const secondsPerScene = Math.max(3, Math.min(p.secondsPerScene ?? len.secondsPerScene, 10));
  const aspect = p.aspect ?? KIDS_ASPECT;

  // Stage 0 — script. Prefer the user-reviewed/edited script from the brief step;
  // otherwise generate one now (template fallback when no LLM key is configured).
  await updateStory(p.storyId, job.user_id, { status: "scripting" });
  let title: string;
  let scenes: KidsScene[];
  let scriptSource: "llm" | "template" | "user" = "user";
  let scriptProvider: string | undefined;
  const edited = p.script?.scenes?.filter((s) => s.narration || s.illustration) ?? [];
  if (edited.length > 0) {
    title = (p.script?.title ?? "").trim() || p.characterName;
    scenes = edited
      .slice(0, sceneCount)
      .map((s) => ({ narration: s.narration.trim(), illustration: s.illustration.trim() }));
  } else {
    const gen = await generateKidsStoryScript({
      contentType: p.contentType,
      ageRange: p.ageRange,
      topic: p.topic,
      characterName: p.characterName,
      characterDescription: p.characterDescription,
      sceneCount,
    });
    title = gen.script.title;
    scenes = gen.script.scenes;
    scriptSource = gen.source;
    scriptProvider = gen.provider;
  }

  // Narration is a required stage for every scene; refuse to render a scene with no
  // narration text rather than producing a silent clip. Terminal (data) error.
  const missingNarration = scenes.findIndex((s) => !s.narration.trim());
  if (missingNarration >= 0) {
    throw new Error(`kids_story scene ${missingNarration + 1} is missing required narration text`);
  }

  // Seed per-scene progress so the /kids page can show step-by-step state.
  const sceneStates = scenes.map((s, i) => ({
    index: i,
    narration: s.narration,
    illustration: s.illustration,
    status: "pending" as string,
    imageUrl: null as string | null,
    clipUrl: null as string | null,
    error: null as string | null,
  }));
  await updateStory(p.storyId, job.user_id, { status: "rendering", title, scenes: sceneStates });

  // Run one pipeline stage for a scene, recording a per-scene error to the story row
  // (so /kids shows exactly which stage failed) and re-throwing so the job's normal
  // failure path retries (transient) or refunds (terminal). No stage is swallowed.
  const runStage = async <T>(i: number, label: string, fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      sceneStates[i].error = `${label}_failed: ${msg}`;
      await updateStory(p.storyId, job.user_id, { scenes: sceneStates });
      throw e instanceof Error ? e : new Error(msg);
    }
  };

  const clipUrls: string[] = [];
  const narrationPaths: string[] = [];
  const durations: number[] = [];
  let firstStill: string | undefined;
  // Identity anchor: an explicit avatar/uploaded image when supplied, otherwise
  // scene 1's own illustration becomes the reference for every later scene.
  let identityRef: string | undefined = p.characterImageUrl ?? undefined;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    // Stage A — identity-locked illustration.
    sceneStates[i].status = "illustrating";
    await updateStory(p.storyId, job.user_id, { scenes: sceneStates });
    const still = await runStage(i, "illustration", () =>
      orch({
        kind: "image",
        model: "google/nano-banana",
        prompt: buildKidsIllustrationPrompt({
          sceneIllustration: scene.illustration,
          characterName: p.characterName,
          characterDescription: p.characterDescription,
          aspect,
        }),
        imageUrls: identityRef ? [identityRef] : undefined,
        userId: job.user_id,
        refId: job.id,
      }),
    );
    sceneStates[i].imageUrl = still.url;
    if (!firstStill) firstStill = still.url;
    if (!identityRef) identityRef = still.url;
    await touchJobLock(job.id, workerId);

    // Stage B — animate the still into a short clip.
    sceneStates[i].status = "animating";
    await updateStory(p.storyId, job.user_id, { scenes: sceneStates });
    const clip = await runStage(i, "animation", () =>
      orch({
        kind: "video",
        model: "seedance-2.0-fast",
        prompt: buildKidsMotionPrompt({
          sceneIllustration: scene.illustration,
          characterName: p.characterName,
        }),
        imageUrls: [still.url],
        duration: secondsPerScene,
        userId: job.user_id,
        refId: job.id,
      }),
    );
    clipUrls.push(clip.url);
    sceneStates[i].clipUrl = clip.url;
    await touchJobLock(job.id, workerId);

    // Stage C — narration TTS (required). Uploaded to the private studio bucket; the
    // path (not a URL) is kept and freshly signed at assembly time so it can't expire
    // mid-render. A TTS failure is NOT swallowed — runStage records the per-scene
    // error and re-throws so the job retries (transient) or refunds (terminal); we
    // never ship a kids video with missing narration.
    sceneStates[i].status = "narrating";
    await updateStory(p.storyId, job.user_id, { scenes: sceneStates });
    const narrPath = `${job.user_id}/kids/${p.storyId}/narration-${i}.flac`;
    await runStage(i, "narration", async () => {
      const tts = await hfTextToSpeech(KIDS_TTS_MODEL, scene.narration);
      await uploadBytesToStudio(narrPath, Buffer.from(tts.bytes), tts.contentType);
    });
    narrationPaths.push(narrPath);
    durations.push(estimateNarrationSeconds(scene.narration, secondsPerScene));

    sceneStates[i].status = "done";
    await updateStory(p.storyId, job.user_id, { scenes: sceneStates });
    await touchJobLock(job.id, workerId);
  }

  // Stage D — final assembly on the self-hosted GPU worker (ffmpeg). Pre-sign the
  // nested studio refs (narration + music) HERE: signStudioRefs does not touch
  // `params`, and the studio bucket is private. Clip URLs are public provider URLs
  // and pass through as-is.
  await updateStory(p.storyId, job.user_id, { status: "assembling" });
  const narrationUrls = await Promise.all(narrationPaths.map((path) => signedStudioUrl(path)));
  // Narration is required, so every track must sign — a null here would silently drop
  // a scene's audio at stitch time. Fail terminally (refund) instead.
  const unsignedNarration = narrationUrls.findIndex((u) => !u);
  if (unsignedNarration >= 0) {
    throw new Error(
      `kids_story failed to sign required narration audio for scene ${unsignedNarration + 1}`,
    );
  }

  let musicUrl: string | null = null;
  let musicSkipped: string | null = null;
  const track = pickKidsMusic(p.contentType, p.musicId);
  if (track) {
    musicUrl = await signedStudioUrl(track.storagePath);
    if (!musicUrl) musicSkipped = `music_unavailable: ${track.id}`;
  } else {
    musicSkipped = "none";
  }

  const assembled = await orch({
    kind: "assemble",
    model: "ffmpeg-assemble",
    selfHostedOnly: true,
    userId: job.user_id,
    refId: job.id,
    params: {
      clips: clipUrls,
      narrations: narrationUrls,
      durations,
      music_url: musicUrl,
      music_volume: 0.18,
    },
  });

  await updateStory(p.storyId, job.user_id, {
    status: "succeeded",
    final_video_url: assembled.url,
    poster_url: firstStill ?? null,
    error: null,
  });

  return {
    url: assembled.url,
    imageUrl: firstStill,
    videoUrl: assembled.url,
    provider: assembled.provider,
    endpoint: assembled.endpoint,
    meta: {
      story_id: p.storyId,
      title,
      scenes: scenes.length,
      script_source: scriptSource,
      ...(scriptProvider ? { script_provider: scriptProvider } : {}),
      music: track?.id ?? null,
      music_skipped: musicSkipped,
    },
  };
}

// AutoCut: stitch user-uploaded clips into a polished 9:16 short (max 60 s).
// Assembly runs on the self-hosted GPU worker.
// If no worker is online the job fails immediately and credits are refunded.
async function runAutocut(job: JobRow, orch: Orchestrate, workerId: string): Promise<JobOutput> {
  const p = job.payload as {
    clipUrls: string[];
    style: string;
    musicTrackId?: string | null;
    aspect?: string;
  };

  if (!p.clipUrls?.length) {
    throw new Error("autocut requires at least one clip URL [required]");
  }

  await touchJobLock(job.id, workerId);

  // Stage 1: analysing — job is locked, worker is reviewing clips.
  await supabaseAdmin
    .from("jobs")
    .update({ payload: { ...(job.payload as object), workerStage: "analysing" } })
    .eq("id", job.id);

  // Resolve optional music track (signed from storage; null if track unavailable).
  let musicUrl: string | null = null;
  if (p.musicTrackId) {
    const track = getMusicTrack(p.musicTrackId);
    if (track) {
      musicUrl = await signedAutocutUrl(track.storagePath, 3600);
    }
  }

  // ── Primary: self-hosted GPU assembler ─────────────────────────────────
  const canAssemble = await hasActiveWorkerForKind("assemble");
  if (canAssemble) {
    // Stage 2: assembling — downloading clips and compositing.
    await supabaseAdmin
      .from("jobs")
      .update({ payload: { ...(job.payload as object), workerStage: "assembling" } })
      .eq("id", job.id);

    // Stage 3: rendering — orch dispatched to the GPU worker.
    await supabaseAdmin
      .from("jobs")
      .update({ payload: { ...(job.payload as object), workerStage: "rendering" } })
      .eq("id", job.id);

    const assembled = await orch({
      kind: "assemble",
      model: "ffmpeg-assemble",
      selfHostedOnly: true,
      userId: job.user_id,
      refId: job.id,
      params: {
        clips: p.clipUrls,
        style: p.style,
        aspect: p.aspect ?? "9:16",
        max_duration: 60,
        music_url: musicUrl,
        music_volume: 0.15,
      },
    });

    return {
      url: assembled.url,
      videoUrl: assembled.url,
      provider: assembled.provider,
      endpoint: assembled.endpoint,
      meta: {
        style: p.style,
        clip_count: p.clipUrls.length,
        music_track: p.musicTrackId ?? null,
        fallback: false,
      },
    };
  }

  // ── No self-hosted assembler online: fail explicitly and refund ────────
  // AutoCut is a TRUE multi-clip edit — concatenating every uploaded clip and
  // beat-syncing style + music — which only the self-hosted FFmpeg "assemble"
  // worker performs. No hosted provider replicates that pipeline (generative
  // video models produce a NEW clip, not an edit of the user's footage), so
  // rather than silently degrading to a single-clip approximation we fail
  // cleanly. The message contains "requires", matched by TERMINAL_ERROR_RE, so
  // processOneJob treats it as terminal and releases the credit reservation
  // immediately — the user is never charged for an undelivered edit.
  throw new Error(
    "AutoCut requires an online video assembler and none is currently available — your Aura was not charged. Please try again shortly.",
  );
}

export async function processOneJob(
  workerId: string,
  deps: JobDeps = defaultDeps,
  lanes: readonly JobLane[] = JOB_LANES,
): Promise<{ processed: boolean; jobId?: string; status?: string; error?: string }> {
  const job = await claimNext(workerId, lanes);
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
    } else if (job.kind === "kids_story") {
      out = await runKidsStory(job, orch, workerId);
    } else if (job.kind === "autocut") {
      out = await runAutocut(job, orch, workerId);
    } else {
      out = await runMediaJob(job, orch);
    }

    // Persist provider URLs into our own storage (compresses + re-hosts) before
    // writing to the generations row. Falls back to the raw provider URL on
    // error so a delivered render is never lost.
    const payloadKind = (job.payload as { kind?: string })?.kind;
    const effectiveKind = payloadKind ?? job.kind;

    let persistedUrl = out.url;
    let persistedImageUrl = out.imageUrl;
    let persistedVideoUrl = out.videoUrl;

    if (out.imageUrl && out.videoUrl) {
      [persistedImageUrl, persistedVideoUrl] = await Promise.all([
        persistResultUrl({
          userId: job.user_id,
          refId: `${job.id}-img`,
          mediaType: "image",
          url: out.imageUrl,
        }).then((r) => r.url),
        persistResultUrl({
          userId: job.user_id,
          refId: `${job.id}-vid`,
          mediaType: "video",
          url: out.videoUrl,
        }).then((r) => r.url),
      ]);
    } else if (out.url) {
      const mediaType = resultMediaTypeForKind(effectiveKind);
      if (mediaType) {
        persistedUrl = (
          await persistResultUrl({ userId: job.user_id, refId: job.id, mediaType, url: out.url })
        ).url;
      }
    }

    // Update generations row. A matched image+video result (campaign sets) fills
    // both URL columns; everything else routes to one column by media type.
    const genPatch: Record<string, unknown> = { status: "succeeded", model: out.provider };
    if (persistedImageUrl && persistedVideoUrl) {
      genPatch.result_image_url = persistedImageUrl;
      genPatch.result_video_url = persistedVideoUrl;
    } else {
      const isVideo =
        payloadKind === "video" ||
        payloadKind === "motion" ||
        job.kind === "video" ||
        job.kind === "tiktok_remix_child" ||
        job.kind === "performance_reskin" ||
        job.kind === "ugc_ad" ||
        job.kind === "kids_story" ||
        job.kind === "motion" ||
        job.kind === "lipsync" ||
        job.kind === "autocut";
      genPatch[isVideo ? "result_video_url" : "result_image_url"] = persistedUrl;
    }
    // Fence the completion on still owning the lock, write the generation result,
    // and commit the credit reservation ALL IN ONE transactional RPC (task #94).
    // Previously these were three separate writes (finishJob -> markGeneration ->
    // commit_reservation); a crash or a thrown commit RPC between them could leave
    // a job marked succeeded with its reservation never committed — credits
    // stranded (neither spent nor returned). finalize_job runs them inside a
    // single Postgres transaction, so ANY failure anywhere inside it rolls back
    // every write together: the job stays `processing` for the stale-sweeper to
    // reclaim, nothing is marked succeeded, and no credits move. This mirrors (and
    // replaces) the old lock-ownership fence: a stale-sweep reclaim by another
    // worker makes the CAS inside finalize_job match no row, so it returns
    // 'stale' and this worker must touch nothing further — the new owner is
    // authoritative.
    let finalizeOutcome: string;
    try {
      finalizeOutcome = await rpc<string>("finalize_job", {
        _job: job.id,
        _worker: workerId,
        _outcome: "succeeded",
        _result: out as unknown as Record<string, unknown>,
        _error: null,
        _model: (genPatch.model as string | undefined) ?? null,
        _result_image_url: (genPatch.result_image_url as string | undefined) ?? null,
        _result_video_url: (genPatch.result_video_url as string | undefined) ?? null,
      });
    } catch (finalizeErr) {
      // The render is delivered but finalize_job itself threw/never returned —
      // because it's one transaction, NOTHING committed (job is still
      // `processing`, generation untouched, credits untouched). Never re-finalize
      // here: doing so from this catch would race the eventual successful retry
      // or the stale-sweeper's reclaim. Surface for ops and let the sweeper
      // recover the job.
      console.error("[jobs] finalize_job threw on success path", job.id, finalizeErr);
      return { processed: true, jobId: job.id, status: "stale", error: String(finalizeErr) };
    }
    return {
      processed: true,
      jobId: job.id,
      status: finalizeOutcome === "finalized" ? "succeeded" : "stale",
    };
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
    // reached). Fence the CAS, write the failed generation, and release the
    // reservation in the SAME single transactional RPC as the success path
    // (task #94) — only the worker that wins the CAS releases (so a stale-sweep
    // race can never release twice), and if finalize_job throws for any reason
    // the whole transaction rolls back: the job stays `processing` rather than
    // being marked failed with its reservation left un-released.
    const failNote =
      decision.reason === "max_attempts"
        ? ` (gave up after ${job.attempts} attempts)`
        : decision.reason === "max_age"
          ? " (gave up after retry window elapsed)"
          : "";
    const failError = `${msg}${failNote}`;
    let finalizeOutcome: string;
    try {
      finalizeOutcome = await rpc<string>("finalize_job", {
        _job: job.id,
        _worker: workerId,
        _outcome: "failed",
        _result: null,
        _error: failError.slice(0, 1000),
        _model: null,
        _result_image_url: null,
        _result_video_url: null,
      });
    } catch (finalizeErr) {
      // One transaction: nothing committed (job still `processing`, reservation
      // untouched). Never retry-finalize from here — let the stale-sweeper
      // reclaim it. Surface for ops.
      console.error("[jobs] finalize_job threw on terminal-failure path", job.id, finalizeErr);
      return { processed: true, jobId: job.id, status: "stale", error: failError };
    }
    const won = finalizeOutcome === "finalized";
    // Surface the terminal failure on the kids-story row too, so the /kids page
    // (which polls kids_stories, not jobs/generations) shows the failed/refunded
    // state instead of spinning forever on its last in-progress stage. Best-effort,
    // outside the transaction — kids_stories is a UI-polling convenience table, not
    // part of the credit-safety invariant finalize_job just closed.
    if (won && job.kind === "kids_story") {
      await failStory((job.payload as { storyId?: string })?.storyId ?? "", job.user_id, failError);
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
    const lanes = lanesForSlot(i, limit);
    const r = await processOneJob(workerId, deps, lanes);
    results.push(r);
    // A mixed-lane miss means the whole queue is drained — stop. A heavy-only
    // miss just means the reserved heavy slot had nothing to do.
    if (!r.processed) break;
  }
  return results;
}

// ─── Sweeper + scheduler heartbeat ───────────────────────────────────────────

// Recover jobs orphaned in `processing` because their worker instance was killed
// mid-run (the common orphan source under request-driven autoscale). These jobs
// still hold their reservation, so re-queuing them is credit-safe (the eventual
// success commits it, or the persistent-retry ceiling/age release it). Failed
// jobs are NOT handled here — they already released their reservation; recovering
// those is sweepFailedJobs' job (it re-reserves fresh).
export async function sweepStaleProcessingJobs(
  maxAgeSeconds: number = STALE_PROCESSING_SECONDS,
): Promise<{ reset: number }> {
  const out = await rpc<number | null>("reset_stale_processing_jobs", {
    _max_age_seconds: maxAgeSeconds,
    _backoff_seconds: 15,
  });
  return { reset: typeof out === "number" ? out : 0 };
}

// How many orphaned failures to recover per sweep. Bounds the work — and the
// credit re-reservations — done in a single tick.
export const FAILED_SWEEP_BATCH = 25;

// Re-enqueue generations/jobs that ended up `failed` but should still be retried.
// This catches failures that the normal queue flow will NOT pick back up:
// failures recorded before persistent retry existed (the old `attempts <
// max_attempts` cap marked them failed permanently), or any job otherwise left
// `failed` with a transient error. Because every generation is created together
// with a job (create_generation_and_reserve), recovering failed jobs also
// recovers their linked failed generations — there are no job-less generations to
// sweep separately.
//
// Same gate as the worker loop (retryDecision): only TRANSIENT errors within the
// attempt ceiling and age deadline are eligible; clearly-terminal failures and
// jobs past the bounds are left dead so hopeless jobs never thrash.
//
// Credit safety: a `failed` job already had its reservation RELEASED by the
// terminal path, so recovery RE-RESERVES fresh credits, done atomically inside
// requeue_failed_job (re-reserve + flip to `queued`, under a row lock). A user who
// can no longer afford the job is left failed rather than retried. A retry that
// eventually succeeds commits exactly this re-reserved amount — never a double
// charge.
export async function sweepFailedJobs(
  now: number = Date.now(),
  batch: number = FAILED_SWEEP_BATCH,
): Promise<{ requeued: number; skipped: number }> {
  const ageFloorIso = new Date(now - PERSISTENT_RETRY_MAX_AGE_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select("id, error")
    .eq("status", "failed")
    .lt("attempts", PERSISTENT_RETRY_MAX_ATTEMPTS)
    .gt("created_at", ageFloorIso)
    .order("created_at", { ascending: true })
    .limit(batch);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ id: string; error: string | null }>;

  let requeued = 0;
  let skipped = 0;
  for (const row of rows) {
    // A missing error string is treated as transient (bias toward retrying a paid
    // render); only an explicitly-terminal error is skipped.
    if (classifyJobError(row.error ?? "") === "terminal") {
      skipped++;
      continue;
    }
    const outcome = await rpc<string>("requeue_failed_job", {
      _job: row.id,
      _backoff_seconds: 15,
    });
    if (outcome === "requeued") requeued++;
    else skipped++;
  }
  return { requeued, skipped };
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
