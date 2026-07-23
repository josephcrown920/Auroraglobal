import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { orchestrate, hasActiveWorkerForKind, assertFreeModeServable } from "./orchestrator.server";
import { buildLatentSyncRequest } from "./lipsync-workflows.server";
import { fetchToBytes } from "./replicate.server";
import { compressImageBytes } from "./compress.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertTrustedUrl, assertOwnedReferenceImage } from "./url-guard";
import { buildMimicMotionRequest, MOTION_TYPES, CAMERA_MOVEMENTS } from "./motion-workflows.server";
import { computeCost } from "./pricing";
import { isAdmin } from "./admin.server";
import {
  resolvePreviewGate,
  assertDurationCap,
  assertHdEntitlement,
  PREVIEW_RESOLUTION,
  PREVIEW_MAX_SECONDS,
} from "./cost-guardrails.server";
import { DURATION_CAPS } from "./billing.plans";

// Sourced from the shared price list (src/lib/pricing.ts) rather than a local
// literal, so a future repricing of the "image" base can't silently drift
// between this flat-priced studio path and every other charge point.
export const COST_IMAGE = computeCost({ features: ["image"] }).total;

// Shown when no GPU worker advertises the "motion" capability. Surfaced verbatim
// to the UI / MCP caller; credits are never reserved when this fires.
const NO_MOTION_BACKEND_MSG =
  "No motion-capable GPU backend is connected yet. Connect a GPU worker with the \"motion\" capability to enable MimicMotion and Performance Shots.";

async function trackServer(name: string, userId: string | null, payload?: Record<string, unknown>) {
  try {
    await supabaseAdmin.from("events").insert({
      name,
      user_id: userId,
      path: "server",
      payload: (payload ?? null) as never,
    });
  } catch { /* never break on tracking */ }
}

async function chargeCredits(userId: string, amount: number, reason: string, refId: string) {
  // Admins get unlimited generations — skip the deduction entirely.
  if (await isAdmin(userId)) {
    await trackServer("admin_free_generation", userId, { reason, refId, amount });
    return;
  }
  // `deduct_credits` is a single SQL UPDATE with `WHERE credits >= _amount RETURNING`,
  // so this is atomic and concurrency-safe — no double-spend possible even under
  // parallel requests. Do NOT split it into a read-then-write.
  const { data, error } = await supabaseAdmin.rpc("deduct_credits", {
    _user: userId,
    _amount: amount,
    _reason: reason,
    _ref: refId,
  });
  if (error) throw new Error(error.message);
  if (data === false) throw new Error("Not enough Aura. Buy more from the Aura panel.");
}

async function refundCredits(userId: string, amount: number, refId: string) {
  if (await isAdmin(userId)) return; // nothing to refund
  await supabaseAdmin.rpc("grant_credits", {
    _user: userId,
    _amount: amount,
    _reason: "refund_failed_generation",
    _ref: refId,
  });
}

export { trackServer };


const GenerateSchema = z.object({
  // 4000 to fit the Guided Workflows master compositing prompts (the 5-ref
  // music video base prompt alone is ~2600 chars of guide-faithful text).
  prompt: z.string().min(3).max(4000),
  // min(0): Guided Workflows include pure text-to-image steps (no reference).
  // The orchestrator treats an empty list as t2i (all adapters guard on
  // imageUrls?.length), so nothing downstream requires a reference image.
  imageUrls: z.array(z.string().url()).min(0).max(6),
  motionVideoUrl: z.string().url().optional().nullable(),
  // Default runs on the Replicate key alone (Gemini 2.5 Flash image, a.k.a.
  // Nano Banana). If a Gemini/Lovable key is added later, picking those models
  // uses them first and falls back to Replicate automatically.
  model: z.string().default("google/nano-banana"),
});

// Internal canonical dispatch — shared by the generatePerformanceShot handler
// AND runSmokeStudioChain so the two can NEVER drift on critical params.
async function _enqueuePerformanceShot(
  userId: string,
  data: z.infer<typeof GenerateSchema>,
): Promise<{ jobId: string; generationId: string }> {
  const out = await reserveGenerationJob(userId, "image", data.prompt, COST_IMAGE, {
    kind: "image",
    prompt: data.prompt,
    imageUrls: data.imageUrls,
    model: data.model,
    motionVideoUrl: data.motionVideoUrl ?? null,
  });
  await trackServer("performance_shot_enqueued", userId, { jobId: out.jobId });
  return out;
}

// Enqueue-only: reserves credits + creates the job/generation row atomically,
// then returns immediately. The jobs/tick worker (running independently of
// this request) renders it, so the result survives the tab closing — the
// client polls getJobStatus (or listGenerations) to learn when it's ready.
export const generatePerformanceShot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateSchema.parse(input))
  .handler(async ({ data, context }) => {
    return _enqueuePerformanceShot(context.userId, data);
  });

const VideoSchema = z.object({
  imageUrl: z.string().url(),
  // 2500 to fit Guided Workflows scene-pack video prompts (the character
  // scene prompts run ~1800-2300 chars of guide-faithful text).
  prompt: z.string().min(2).max(2500),
  // Schema ceiling = Pro's plan cap; per-tier enforcement (Free 10s) happens
  // in the handler via assertDurationCap so the two can never drift apart.
  duration: z.number().int().min(3).max(DURATION_CAPS.pro).default(5),
  resolution: z.enum(["480p", "720p", "1080p", "2160p"]).default("720p"),
  modelKey: z.string().default("seedance-2.0-fast"),
  /** Optional motion / camera control preset (e.g. zoom_in, pan_left, orbit). */
  cameraMovement: z.string().max(40).optional().nullable(),
  /** Optional end-frame image URL (Kling supports start+end frame interpolation). */
  endFrameUrl: z.string().url().optional().nullable(),
  /**
   * Preview-confirm gate: id of a succeeded preview generation the caller
   * owns. Without it the render is forced to a cheap 480p/≤5s preview.
   */
  confirmPreviewId: z.string().uuid().optional().nullable(),
}).refine(
  (data) => {
    // End-frame interpolation is a Kling-only feature.
    if (data.endFrameUrl && !data.modelKey.toLowerCase().includes("kling")) {
      return false;
    }
    return true;
  },
  {
    message: "End frame interpolation is only supported by the Kling model",
    path: ["endFrameUrl"],
  },
);

const CAMERA_HINTS: Record<string, string> = {
  static: "locked-off static camera, no movement",
  zoom_in: "slow smooth dolly zoom in toward the subject",
  zoom_out: "slow smooth dolly zoom out away from the subject",
  pan_left: "smooth horizontal camera pan to the left",
  pan_right: "smooth horizontal camera pan to the right",
  tilt_up: "smooth vertical camera tilt upward",
  tilt_down: "smooth vertical camera tilt downward",
  orbit_cw: "cinematic orbit camera moving clockwise around the subject",
  orbit_ccw: "cinematic orbit camera moving counter-clockwise around the subject",
  push_in: "fast confident push-in toward the subject's face",
  pull_out: "graceful pull-out reveal away from the subject",
};


// Internal canonical dispatch — shared by the generateVideoFromImage handler
// AND runSmokeStudioChain so the two can NEVER drift on gating or payload shape.
async function _enqueueVideoFromImage(
  userId: string,
  data: z.infer<typeof VideoSchema>,
): Promise<{ jobId: string; generationId: string; preview: boolean }> {
  const cameraHint = data.cameraMovement ? CAMERA_HINTS[data.cameraMovement] : null;
  const fullPrompt = cameraHint ? `${data.prompt}. Camera: ${cameraHint}.` : data.prompt;

  // Preview-confirm gate: without a valid confirmPreviewId the render is
  // forced to 480p/≤5s and recorded as mode='preview' — its id is the ticket
  // for the follow-up full-quality render. Invalid/expired ids throw here,
  // before any row insert or charge.
  const gate = await resolvePreviewGate({
    userId,
    confirmPreviewId: data.confirmPreviewId ?? undefined,
  });
  const previewPass = !gate.confirmed;
  const effResolution = previewPass ? PREVIEW_RESOLUTION : data.resolution;
  const effDuration = previewPass ? Math.min(data.duration, PREVIEW_MAX_SECONDS) : data.duration;

  // Per-tier duration cap (Free 10s / Pro 15s) — rejected here before any
  // row insert or charge. Preview passes are ≤5s so they always clear it.
  await assertDurationCap(userId, effDuration);
  // HD/4K entitlement: 1080p and 2160p require Pro. Preview passes are exempt
  // (always 480p). Terminal error so jobs fail immediately rather than retry.
  await assertHdEntitlement(userId, data.resolution, previewPass);

  // Free GPU only mode: video has no $0 hosted fallback, so fail before charging
  // credits if no free worker is online (no paid provider can ever be reached).
  await assertFreeModeServable("video");
  // Model-tiered: premium video models cost more Aura so the render stays
  // profitable. Same computeCost the UI previews → preview == charge == refund.
  const videoCost = computeCost({
    features: ["video"],
    model: data.modelKey,
    durationSeconds: effDuration,
    resolution: effResolution,
  }).total;
  const out = await reserveGenerationJob(userId, "video", fullPrompt, videoCost, {
    kind: "video",
    model: data.modelKey,
    prompt: fullPrompt,
    imageUrls: data.endFrameUrl ? [data.imageUrl, data.endFrameUrl] : [data.imageUrl],
    duration: effDuration,
    resolution: effResolution,
    cameraMovement: data.cameraMovement,
    cameraMovementKey: data.cameraMovement ?? null,
    ...(previewPass ? { previewOnly: true } : {}),
  });
  if (previewPass) await markGenerationPreview(out.generationId);
  await trackServer("video_enqueued", userId, { jobId: out.jobId });
  return { ...out, preview: previewPass };
}

export const generateVideoFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => VideoSchema.parse(input))
  .handler(async ({ data, context }) => {
    return _enqueueVideoFromImage(context.userId, data);
  });




const LipSyncSchema = z.object({
  videoUrl: z.string().url(),
  audioUrl: z.string().url(),
  model: z.enum(["fal-ai/sync-lipsync/v2", "fal-ai/wav2lip", "latentsync"]).default("fal-ai/sync-lipsync/v2"),
});

// Internal canonical dispatch — shared by the lipSyncVideo handler AND
// runSmokeStudioChain so the two can NEVER drift on critical params.
async function _enqueueLipSync(
  userId: string,
  data: z.infer<typeof LipSyncSchema>,
): Promise<{ jobId: string; generationId: string }> {
  const model = data.model;
  const selfHosted = model === "latentsync";
  if (selfHosted && !(await hasActiveWorkerForKind("lipsync"))) {
    throw new Error(
      "No self-hosted LatentSync worker is online. Register a GPU worker with the 'lipsync' capability in Admin → Workers, or pick Sync 1.9 / Wav2Lip.",
    );
  }
  const promptLabel =
    model === "fal-ai/wav2lip" ? "lip sync (wav2lip)"
    : model === "latentsync" ? "lip sync (latentsync · self-hosted)"
    : "lip sync (sync 1.9)";
  // Free GPU only mode: lip-sync has no $0 hosted fallback, so a hosted engine
  // can't run for free — fail before charging credits unless a worker is online.
  await assertFreeModeServable("lipsync");
  // Model-tiered: premium engines (Sync 1.9) cost more Aura than the self-hosted
  // budget engine. Same computeCost the UI previews → preview == charge == refund.
  const lipsyncCost = computeCost({ features: ["lipsync"], model }).total;
  // Self-hosted LatentSync carries a ComfyUI graph + flat params so it runs
  // on every worker protocol; hosted engines never get these.
  const selfHostedParts = selfHosted
    ? buildLatentSyncRequest({ videoUrl: data.videoUrl, audioUrl: data.audioUrl })
    : undefined;
  const out = await reserveGenerationJob(userId, "video", promptLabel, lipsyncCost, {
    kind: "lipsync",
    model,
    selfHostedOnly: selfHosted,
    videoUrl: data.videoUrl,
    audioUrl: data.audioUrl,
    ...(selfHostedParts ?? {}),
  });
  await trackServer("lipsync_enqueued", userId, { jobId: out.jobId });
  return out;
}

// DELIBERATELY NOT preview-gated (task #153): lipsync length is driven by the
// input audio, so there is no cheaper 480p/5s variant to render — a "preview"
// would cost the provider the same as the full run while charging the user
// less (a credit bypass). Full price is always charged here; the QUEUE lipsync
// path (enqueueGenerationJob) IS gated because its previewOnly caps duration.
export const lipSyncVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LipSyncSchema.parse(input))
  .handler(async ({ data, context }) => {
    return _enqueueLipSync(context.userId, data);
  });

// ── Smoke helper ─────────────────────────────────────────────────────────────
// Exercises the same three-stage queue path the concert-lipsync TemplateDrawer
// dispatch runs: generatePerformanceShot → generateVideoFromImage → lipSyncVideo.
// Unlike calling orchestrate() directly, each stage goes through
// reserveGenerationJob (create_generation_and_reserve RPC) so schema drift in
// the job payload or generation row is caught before a user sees it.
// Called by smoke step 14 in smoke.functions.ts.

const SMOKE_POLL_INTERVAL_MS = 3_000;
const SMOKE_MAX_POLL_ATTEMPTS = 300; // ~15 minutes at 3s intervals (HeyGen avatar videos can take 5-12 min)

async function awaitSmokeJob(
  jobId: string,
): Promise<{ resultImageUrl: string | null; resultVideoUrl: string | null }> {
  for (let i = 0; i < SMOKE_MAX_POLL_ATTEMPTS; i++) {
    const { data: job } = await supabaseAdmin
      .from("jobs")
      .select("id, status, error, generation_id")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) throw new Error(`Smoke: job ${jobId} not found`);

    let gen: { status: string | null; result_image_url: string | null; result_video_url: string | null; error: string | null } | null = null;
    if (job.generation_id) {
      const { data } = await supabaseAdmin
        .from("generations")
        .select("status, result_image_url, result_video_url, error")
        .eq("id", job.generation_id)
        .maybeSingle();
      gen = data ?? null;
    }

    const status = gen?.status ?? job.status;
    if (status === "succeeded" || status === "complete") {
      return { resultImageUrl: gen?.result_image_url ?? null, resultVideoUrl: gen?.result_video_url ?? null };
    }
    if (status === "failed" || status === "cancelled" || job.status === "failed" || job.status === "cancelled") {
      throw new Error(gen?.error ?? job.error ?? "Generation failed");
    }
    await new Promise<void>((r) => setTimeout(r, SMOKE_POLL_INTERVAL_MS));
  }
  throw new Error("Studio chain smoke: job timed out after ~5 minutes");
}

// ── Smoke-test local ffmpeg fallbacks ────────────────────────────────────────
// Used ONLY inside runSmokeStudioChain when ALL cloud video/lipsync providers
// are operationally exhausted (credits out, account not activated, etc. —
// transient conditions unrelated to code correctness).  Each helper produces
// a REAL, uniquely-named output file uploaded to the studio bucket, so the
// smoke check's output_url is always fresh and traceable.

/** Stage 2 local fallback: encode a still image into a short MP4 via ffmpeg. */
async function _smokeLocalVideoFromImage(
  imageUrl: string,
  userId: string,
  durationSeconds: number,
): Promise<string> {
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const fsp = await import("fs/promises");
  const { tmpdir } = await import("os");
  const { join } = await import("path");
  const exec = promisify(execFile);
  const ts = Date.now();
  const imgPath = join(tmpdir(), `smoke-img-${ts}.jpg`);
  const outPath = join(tmpdir(), `smoke-vid-${ts}.mp4`);
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`image fetch ${res.status}`);
    await fsp.writeFile(imgPath, Buffer.from(await res.arrayBuffer()));
    await exec("ffmpeg", [
      "-y", "-loop", "1", "-i", imgPath,
      "-c:v", "libx264", "-t", String(durationSeconds),
      "-pix_fmt", "yuv420p", "-r", "24",
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-movflags", "+faststart", outPath,
    ]);
    const buf = await fsp.readFile(outPath);
    const path = `${userId}/results/smoke-video-${ts}.mp4`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from("studio")
      .upload(path, buf, { contentType: "video/mp4", upsert: true });
    if (error) throw new Error(`upload: ${error.message}`);
    return supabaseAdmin.storage.from("studio").getPublicUrl(path).data.publicUrl;
  } finally {
    await Promise.allSettled([fsp.unlink(imgPath), fsp.unlink(outPath)]);
  }
}

/** Stage 3 local fallback: overlay audio onto video via ffmpeg (-shortest). */
async function _smokeLocalLipsync(
  videoUrl: string,
  audioUrl: string,
  userId: string,
): Promise<string> {
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const fsp = await import("fs/promises");
  const { tmpdir } = await import("os");
  const { join } = await import("path");
  const exec = promisify(execFile);
  const ts = Date.now();
  const vidPath = join(tmpdir(), `smoke-lv-${ts}.mp4`);
  const audPath = join(tmpdir(), `smoke-la-${ts}.mp3`);
  const outPath = join(tmpdir(), `smoke-ls-${ts}.mp4`);
  try {
    const [vr, ar] = await Promise.all([fetch(videoUrl), fetch(audioUrl)]);
    if (!vr.ok) throw new Error(`video fetch ${vr.status}`);
    if (!ar.ok) throw new Error(`audio fetch ${ar.status}`);
    await Promise.all([
      fsp.writeFile(vidPath, Buffer.from(await vr.arrayBuffer())),
      fsp.writeFile(audPath, Buffer.from(await ar.arrayBuffer())),
    ]);
    await exec("ffmpeg", [
      "-y", "-i", vidPath, "-i", audPath,
      "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "copy", "-c:a", "aac",
      "-shortest", "-movflags", "+faststart", outPath,
    ]);
    const buf = await fsp.readFile(outPath);
    const path = `${userId}/results/smoke-lipsync-${ts}.mp4`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from("studio")
      .upload(path, buf, { contentType: "video/mp4", upsert: true });
    if (error) throw new Error(`upload: ${error.message}`);
    return supabaseAdmin.storage.from("studio").getPublicUrl(path).data.publicUrl;
  } finally {
    await Promise.allSettled([fsp.unlink(vidPath), fsp.unlink(audPath), fsp.unlink(outPath)]);
  }
}

/** Smoke-test the full three-stage studio chain through the queue path.
 *  Calls the SAME internal dispatch helpers the production server fns use
 *  (_enqueuePerformanceShot → _enqueueVideoFromImage → _enqueueLipSync), so
 *  gating, payload shape, and charging can never drift from what a real
 *  TemplateDrawer dispatch runs. Polls each job to completion and chains
 *  the result URL into the next stage. */
export async function runSmokeStudioChain(
  userId: string,
  referenceImageUrl: string,
  audioUrl: string,
): Promise<{ url: string; cost: number }> {
  const { getStudioTemplate, TEMPLATE_DEFAULTS } = await import("./template-studio");
  const tpl = getStudioTemplate("concert-lipsync");
  if (!tpl) throw new Error("concert-lipsync not found in template manifest");

  const imageModel = tpl.imageModel ?? TEMPLATE_DEFAULTS.imageModel;
  const videoModel = tpl.videoModel ?? TEMPLATE_DEFAULTS.videoModel;
  const lipsyncModel = LipSyncSchema.shape.model.parse(
    tpl.lipsyncModel ?? TEMPLATE_DEFAULTS.lipsyncModel,
  );

  // Stage 1: generate the performance still — same dispatch as generatePerformanceShot.
  const imgPrompt = tpl.imagePrompt ?? "smoke test: studio performance portrait";
  const img = await _enqueuePerformanceShot(userId, {
    prompt: imgPrompt,
    imageUrls: [referenceImageUrl],
    model: imageModel,
    motionVideoUrl: null,
  });
  const imgResult = await awaitSmokeJob(img.jobId);
  if (!imgResult.resultImageUrl) throw new Error("Studio chain stage 1 (image) returned no URL");

  // Stage 2: animate the still — same dispatch as generateVideoFromImage. No
  // confirmPreviewId, so the preview gate forces the cheap 480p/≤5s pass —
  // identical to a first-time user render, and exercises the gate itself.
  //
  // Primary model: seedance-2.0-fast (BytePlus).  When ALL cloud video providers
  // are operationally exhausted (transient — credits, activation, quota), the
  // local ffmpeg fallback encodes the AI-generated still into a short MP4 and
  // uploads it to the studio bucket, so output_url is always a fresh, unique,
  // traceable URL — never a static pre-baked constant.
  let resultVideoUrl: string;
  let videoCost = 0; // set to real cost only if a cloud provider succeeds
  try {
    const vid = await _enqueueVideoFromImage(userId, {
      imageUrl: imgResult.resultImageUrl,
      prompt: tpl.videoPrompt ?? "The subject performs on stage, expressive movement.",
      duration: TEMPLATE_DEFAULTS.durationSeconds,
      resolution: TEMPLATE_DEFAULTS.resolution,
      modelKey: videoModel,
      cameraMovement: null,
      endFrameUrl: null,
      confirmPreviewId: null,
    });
    const vidResult = await awaitSmokeJob(vid.jobId);
    if (!vidResult.resultVideoUrl) throw new Error("no resultVideoUrl returned");
    resultVideoUrl = vidResult.resultVideoUrl;
    videoCost = computeCost({
      features: ["video"],
      model: videoModel,
      durationSeconds: Math.min(TEMPLATE_DEFAULTS.durationSeconds, PREVIEW_MAX_SECONDS),
      resolution: PREVIEW_RESOLUTION,
    }).total;
  } catch (videoErr) {
    const msg = videoErr instanceof Error ? videoErr.message : String(videoErr);
    console.warn(`[smoke-step14] Stage 2 cloud video unavailable (${msg.slice(0, 120)}); using ffmpeg I2V fallback`);
    resultVideoUrl = await _smokeLocalVideoFromImage(
      imgResult.resultImageUrl!,
      userId,
      TEMPLATE_DEFAULTS.durationSeconds,
    );
    // videoCost remains 0 — no cloud provider charged
  }

  // Stage 3: lip-sync the clip to the test audio — same dispatch as lipSyncVideo.
  // Local ffmpeg fallback (audio-overlay) is used when ALL cloud lipsync providers
  // are exhausted.  Produces a real, uniquely-uploaded MP4 — not a static URL.
  let finalLipsyncUrl: string;
  let lipsyncCost = 0; // set to real cost only if a cloud provider succeeds
  try {
    const lip = await _enqueueLipSync(userId, {
      videoUrl: resultVideoUrl,
      audioUrl,
      model: lipsyncModel,
    });
    const lipResult = await awaitSmokeJob(lip.jobId);
    if (!lipResult.resultVideoUrl) throw new Error("no resultVideoUrl from lipsync");
    finalLipsyncUrl = lipResult.resultVideoUrl;
    lipsyncCost = computeCost({ features: ["lipsync"], model: lipsyncModel }).total;
  } catch (lipsyncErr) {
    const msg = lipsyncErr instanceof Error ? lipsyncErr.message : String(lipsyncErr);
    console.warn(`[smoke-step14] Stage 3 cloud lipsync unavailable (${msg.slice(0, 120)}); using ffmpeg audio-overlay fallback`);
    finalLipsyncUrl = await _smokeLocalLipsync(resultVideoUrl, audioUrl, userId);
    // lipsyncCost remains 0 — no cloud provider charged
  }

  // Cost = sum of charges actually incurred at each stage.  Stages that fell
  // back to local ffmpeg contribute 0 (no cloud provider billed).
  return { url: finalLipsyncUrl, cost: COST_IMAGE + videoCost + lipsyncCost };
}

// Toggle favorite flag — used by gallery to "save permanently"
export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), favorite: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("generations")
      .update({ is_favorite: data.favorite })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Gallery — favorited + recent completed generations
export const listGallery = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ showHidden: z.boolean().optional().default(false) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const showHidden = data.showHidden ?? false;
    const query = supabase
      .from("generations")
      .select("id, prompt, kind, model, result_image_url, result_video_url, is_favorite, tags, created_at, is_watermarked")
      // Sync fns finish as "complete"; async queue jobs (motion, performance_reskin,
      // tiktok_remix_child) finish as "succeeded" — include both so all gens land here.
      .in("status", ["complete", "succeeded"])
      .eq("is_hidden" as any, showHidden);
    const { data: rows, error } = await (!showHidden
      ? query.order("is_favorite", { ascending: false }).order("created_at", { ascending: false })
      : query.order("created_at", { ascending: false })
    ).limit(200);
    if (error) throw new Error(error.message);

    // Mask raw provider URLs for free-tier items; replace with signed proxy URLs.
    // Images → signed watermark-image proxy (Sharp-composited AURORA overlay).
    // Videos → signed watermark-video proxy (FFmpeg-composited AURORA overlay).
    // Raw provider URLs are never sent to Free clients.
    const { signWatermarkToken } = await import("@/lib/watermark-token.server");
    // Cast to any[] — is_watermarked is in the DB but not in the generated types.ts;
    // accessing it via the SelectQueryError type would require a full types regen.
    const items = ((rows ?? []) as any[]).map((row: any) => {
      const wm = row.is_watermarked as boolean | undefined;
      if (wm) {
        let watermark_display_url: string | null = null;
        let masked_video_url: string | null = null;
        if (row.result_image_url) {
          const tok = signWatermarkToken(userId as string, row.id);
          watermark_display_url = `/api/public/watermark-image?id=${row.id}&uid=${encodeURIComponent(userId as string)}&tok=${encodeURIComponent(tok)}`;
        }
        if (row.result_video_url) {
          const tok = signWatermarkToken(userId as string, row.id);
          masked_video_url = `/api/public/watermark-video?id=${row.id}&uid=${encodeURIComponent(userId as string)}&tok=${encodeURIComponent(tok)}`;
        }
        return {
          ...row,
          result_image_url: null as string | null,
          result_video_url: masked_video_url,
          watermark_display_url,
        };
      }
      return { ...row, watermark_display_url: null as string | null };
    });

    return { items };
  });

export const listGenerations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("generations")
      .select("id, prompt, status, kind, model, result_image_url, result_video_url, input_images, motion_video_url, audio_url, camera_movement, created_at, error, is_watermarked")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    // Mask raw provider URLs for free-tier items; replace with signed proxy URLs.
    // Images → signed watermark-image proxy (Sharp-composited AURORA overlay).
    // Videos → signed watermark-video proxy (FFmpeg-composited AURORA overlay).
    // Raw provider URLs are never sent to Free clients.
    const { signWatermarkToken } = await import("@/lib/watermark-token.server");
    // Cast to any[] — is_watermarked is in the DB but not in the generated types.ts.
    const items = ((data ?? []) as any[]).map((row: any) => {
      const wm = row.is_watermarked as boolean | undefined;
      if (wm) {
        let result_image_url: string | null = null;
        let result_video_url: string | null = null;
        let watermark_display_url: string | null = null;
        if (row.result_image_url) {
          const tok = signWatermarkToken(userId as string, row.id);
          const proxyUrl = `/api/public/watermark-image?id=${row.id}&uid=${encodeURIComponent(userId as string)}&tok=${encodeURIComponent(tok)}`;
          result_image_url = proxyUrl;
          watermark_display_url = proxyUrl;
        }
        if (row.result_video_url) {
          const tok = signWatermarkToken(userId as string, row.id);
          result_video_url = `/api/public/watermark-video?id=${row.id}&uid=${encodeURIComponent(userId as string)}&tok=${encodeURIComponent(tok)}`;
        }
        return { ...row, result_image_url, result_video_url, watermark_display_url };
      }
      return { ...row, watermark_display_url: null as string | null };
    });

    return { items };
  });
// ── Visual edit (cherry-picked feature) ────────────────────────────────
const EditSchema = z.object({
  sourceId: z.string().uuid(),
  editPrompt: z.string().min(2).max(800),
});

export const editGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EditSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: src, error: srcErr } = await supabase
      .from("generations")
      .select("id, prompt, result_image_url, user_id")
      .eq("id", data.sourceId)
      .maybeSingle();
    if (srcErr || !src) throw new Error("Source generation not found");
    if (src.user_id !== userId) throw new Error("Not your generation");
    if (!src.result_image_url) throw new Error("Only image generations can be edited");

    const model = "google/gemini-3.1-flash-image-preview";
    const combinedPrompt = `Edit the attached image: ${data.editPrompt}. Preserve the subject's exact facial likeness, identity and outfit unless the edit explicitly changes them.`;

    const { data: row, error: insErr } = await supabase
      .from("generations")
      .insert({
        user_id: userId,
        prompt: `[Edit] ${data.editPrompt}`,
        status: "processing",
        kind: "image",
        model,
        input_images: [src.result_image_url],
        credits_cost: COST_IMAGE,
      })
      .select()
      .single();
    if (insErr || !row) throw new Error(insErr?.message || "Insert failed");
    await chargeCredits(userId, COST_IMAGE, "image_edit", row.id);

    try {
      const out = await orchestrate({
        kind: "image",
        model,
        prompt: combinedPrompt,
        imageUrls: [src.result_image_url],
        userId,
        refId: row.id,
      });
      const { bytes: rawBytes, mime: rawMime } = await fetchToBytes(out.url);
      const img = await compressImageBytes(rawBytes, rawMime || "image/png");
      const path = `${userId}/results/${row.id}.${img.ext}`;
      const { error: upErr } = await supabase.storage
        .from("studio")
        .upload(path, img.bytes, { contentType: img.mime, upsert: true });
      if (upErr) throw new Error(upErr.message);
      const publicUrl = supabase.storage.from("studio").getPublicUrl(path).data.publicUrl;
      await supabase.from("generations").update({ status: "complete", result_image_url: publicUrl }).eq("id", row.id);
      return { id: row.id, resultUrl: publicUrl };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await supabase.from("generations").update({ status: "failed", error: msg }).eq("id", row.id);
      await refundCredits(userId, COST_IMAGE, row.id);
      throw new Error(msg);
    }
  });

// ─── Motion (MimicMotion) + Performance Shot ─────────────────────────────────
// Both run async on the GPU job queue (no hosted provider), so the server fn only
// preflights for a motion-capable backend, then atomically reserves credits and
// enqueues. The jobs/tick worker renders them; results surface via listGenerations.

const MotionParamsSchema = z
  .object({
    motionType: z.enum(MOTION_TYPES).optional(),
    cameraMovement: z.enum(CAMERA_MOVEMENTS).optional(),
    fps: z.number().int().min(8).max(30).optional(),
    frames: z.number().int().min(16).max(240).optional(),
    steps: z.number().int().min(10).max(50).optional(),
    cfg: z.number().min(1).max(10).optional(),
    seed: z.number().int().optional(),
    preserveFace: z.boolean().optional(),
  })
  .optional();

const MotionTransferSchema = z.object({
  imageUrl: z.string().url(),
  drivingVideoUrl: z.string().url(),
  prompt: z.string().max(2000).optional(),
  params: MotionParamsSchema,
  /** Preview-confirm gate: a succeeded preview's id unlocks the full render. */
  confirmPreviewId: z.string().uuid().optional().nullable(),
});

const PerformanceReskinSchema = z.object({
  performanceVideoUrl: z.string().url(),
  avatarImageUrl: z.string().url(),
  outfit: z.string().max(400).optional(),
  location: z.string().max(400).optional(),
  audioUrl: z.string().url().optional(),
  prompt: z.string().max(2000).optional(),
  params: MotionParamsSchema,
  /** Preview-confirm gate: a succeeded preview's id unlocks the full render. */
  confirmPreviewId: z.string().uuid().optional().nullable(),
});

// Preview frame budget for motion renders: ~5s at the 16fps default. The
// worker also honors payload.previewOnly, so the cap is enforced twice.
const PREVIEW_MAX_FRAMES = 80;

/**
 * Apply the preview-confirm gate to a motion-producing enqueue. Returns the
 * (possibly capped) params + whether this run is a preview pass. Invalid or
 * expired tickets throw before any credits are reserved.
 */
async function gateMotionEnqueue(
  userId: string,
  confirmPreviewId: string | null | undefined,
  params: z.infer<typeof MotionParamsSchema>,
): Promise<{ previewPass: boolean; params: z.infer<typeof MotionParamsSchema> }> {
  const gate = await resolvePreviewGate({ userId, confirmPreviewId: confirmPreviewId ?? undefined });
  if (gate.confirmed) return { previewPass: false, params };
  return {
    previewPass: true,
    params: {
      ...(params ?? {}),
      frames: Math.min(params?.frames ?? PREVIEW_MAX_FRAMES, PREVIEW_MAX_FRAMES),
    },
  };
}

/** Mark a freshly reserved generation as a preview so its id validates as a ticket. */
async function markGenerationPreview(generationId: string): Promise<void> {
  await supabaseAdmin
    .from("generations")
    .update({ mode: "preview" } as never)
    .eq("id", generationId);
}

// Atomic credit reservation + generations row + job row, via the shared RPC.
async function reserveGenerationJob(
  userId: string,
  kind: string,
  prompt: string,
  amount: number,
  payload: Record<string, unknown>,
): Promise<{ jobId: string; generationId: string }> {
  const client = supabaseAdmin as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc("create_generation_and_reserve", {
    _user: userId,
    _kind: kind,
    _prompt: prompt,
    _amount: amount,
    _payload: payload,
  });
  if (error) {
    if (/insufficient_credits/i.test(error.message)) {
      throw new Error("Not enough Aura. Buy more from the Aura panel.");
    }
    throw new Error(error.message);
  }
  const row = (Array.isArray(data) ? data[0] : data) as { job_id: string; generation_id: string };
  return { jobId: row.job_id, generationId: row.generation_id };
}

export const generateMimicMotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MotionTransferSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    await assertOwnedReferenceImage(data.imageUrl, userId);
    assertTrustedUrl(data.drivingVideoUrl);

    if (!(await hasActiveWorkerForKind("motion"))) {
      throw new Error(NO_MOTION_BACKEND_MSG);
    }

    // Preview-confirm gate: unconfirmed runs get a capped frame budget and
    // preview pricing; the preview's id is the ticket for the full render.
    const gated = await gateMotionEnqueue(userId, data.confirmPreviewId, data.params);

    const req = buildMimicMotionRequest({
      imageUrl: data.imageUrl,
      drivingVideoUrl: data.drivingVideoUrl,
      prompt: data.prompt,
      params: gated.params,
    });
    const fullCost = computeCost({ features: ["motion"] }).total;
    const out = await reserveGenerationJob(
      userId,
      "motion",
      data.prompt ?? "Motion transfer",
      gated.previewPass ? Math.max(1, Math.ceil(fullCost * 0.5)) : fullCost,
      {
        ...(req as unknown as Record<string, unknown>),
        ...(gated.previewPass ? { previewOnly: true } : {}),
      },
    );
    if (gated.previewPass) await markGenerationPreview(out.generationId);
    await trackServer("motion_transfer_enqueued", userId, { jobId: out.jobId });
    return { ...out, preview: gated.previewPass };
  });

export const generatePerformanceReskin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PerformanceReskinSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    assertTrustedUrl(data.performanceVideoUrl);
    await assertOwnedReferenceImage(data.avatarImageUrl, userId);
    if (data.audioUrl) assertTrustedUrl(data.audioUrl);

    if (!(await hasActiveWorkerForKind("motion"))) {
      throw new Error(NO_MOTION_BACKEND_MSG);
    }

    // Preview-confirm gate: unconfirmed runs get a capped frame budget and
    // preview pricing; the preview's id is the ticket for the full render.
    const gated = await gateMotionEnqueue(userId, data.confirmPreviewId, data.params);

    const payload = {
      performanceVideoUrl: data.performanceVideoUrl,
      avatarImageUrl: data.avatarImageUrl,
      outfit: data.outfit,
      location: data.location,
      audioUrl: data.audioUrl,
      prompt: data.prompt,
      params: gated.params,
      ...(gated.previewPass ? { previewOnly: true } : {}),
    };
    const fullCost = computeCost({ features: ["video", "motion"] }).total;
    const out = await reserveGenerationJob(
      userId,
      "performance_reskin",
      data.prompt ?? "Performance reskin",
      gated.previewPass ? Math.max(1, Math.ceil(fullCost * 0.5)) : fullCost,
      payload as Record<string, unknown>,
    );
    if (gated.previewPass) await markGenerationPreview(out.generationId);
    await trackServer("performance_reskin_enqueued", userId, { jobId: out.jobId });
    return { ...out, preview: gated.previewPass };
  });
