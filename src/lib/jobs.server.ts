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
async function runUGCAd(job: JobRow): Promise<JobOutput> {
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
  const { script, source: scriptSource, provider: scriptProvider } = await generateUGCScript({
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
  const still = await orchestrate({
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
  const clip = await orchestrate({
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
      final = await orchestrate({
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
async function runCampaignItem(job: JobRow): Promise<JobOutput> {
  const p = job.payload as {
    avatarImageUrl?: string;
    imagePrompt: string;
    motionPrompt?: string;
    duration?: number;
    label?: string;
  };
  if (!p.imagePrompt) throw new Error("ugc_campaign_item requires imagePrompt");
  const duration = Math.max(3, Math.min(12, p.duration ?? 5));

  const still = await orchestrate({
    kind: "image",
    model: "google/nano-banana",
    prompt: p.imagePrompt,
    imageUrls: p.avatarImageUrl ? [p.avatarImageUrl] : undefined,
    userId: job.user_id,
    refId: job.id,
  });
  const imageUrl = still.url;

  const clip = await orchestrate({
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

export async function processOneJob(workerId: string): Promise<{ processed: boolean; jobId?: string; status?: string; error?: string }> {
  const job = await claimNext(workerId);
  if (!job) return { processed: false };

  try {
    let out: JobOutput;
    if (job.kind === "tiktok_remix_child") {
      out = await runTiktokRemixChild(job);
    } else if (job.kind === "performance_reskin") {
      out = await runPerformanceReskin(job);
    } else if (job.kind === "ugc_ad") {
      out = await runUGCAd(job);
    } else if (job.kind === "ugc_campaign_item") {
      out = await runCampaignItem(job);
    } else {
      out = await runMediaJob(job);
    }

    // Update generations row. A matched image+video result (campaign sets) fills
    // both URL columns; everything else routes to one column by media type.
    const genPatch: Record<string, unknown> = { status: "succeeded", model: out.provider };
    if (out.imageUrl && out.videoUrl) {
      genPatch.result_image_url = out.imageUrl;
      genPatch.result_video_url = out.videoUrl;
    } else {
      const payloadKind = (job.payload as { kind?: string })?.kind;
      const isVideo = payloadKind === "video"
        || payloadKind === "motion"
        || job.kind === "video"
        || job.kind === "tiktok_remix_child"
        || job.kind === "performance_reskin"
        || job.kind === "ugc_ad"
        || job.kind === "motion"
        || job.kind === "lipsync";
      genPatch[isVideo ? "result_video_url" : "result_image_url"] = out.url;
    }
    await markGeneration(job.id, job.generation_id, genPatch);

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