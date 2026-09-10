import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { orchestrate, hasActiveWorkerForKind, assertFreeModeServable } from "./orchestrator.server";
import { buildLatentSyncRequest } from "./lipsync-workflows.server";
import { fetchToBytes } from "./replicate.server";
import { compressImageBytes } from "./compress.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertTrustedUrl, assertOwnedReferenceImage, assertOwnStudioUpload } from "./url-guard";
import { buildMimicMotionRequest, MOTION_TYPES, CAMERA_MOVEMENTS } from "./motion-workflows.server";
import { computeCost, TEMPLATE_VIDEO_PRESET_FEE } from "./pricing";
// Client-safe manifest (no *.server imports) — used to derive the video preset
// fee from the template id the drawer sends, never from a client-sent amount.
import { getStudioTemplate } from "./template-studio";
import { isAdmin } from "./admin.server";
import {
  resolvePreviewGate,
  validateConfirmedPreview,
  type PreviewRowCheck,
  assertDurationCap,
  assertHdEntitlement,
  PREVIEW_RESOLUTION,
  PREVIEW_MAX_SECONDS,
} from "./cost-guardrails.server";
import { DURATION_CAPS } from "./billing.plans";
import { videoPreviewFingerprint } from "./motion-preview-fingerprint.server";

// Sourced from the shared price list (src/lib/pricing.ts) rather than a local
// literal, so a future repricing of the "image" base can't silently drift
// between this flat-priced studio path and every other charge point.
export const COST_IMAGE = computeCost({ features: ["image"] }).total;

// Shown when no GPU worker advertises the "motion" capability. Surfaced verbatim
// to the UI / MCP caller; credits are never reserved when this fires.
export const NO_MOTION_BACKEND_MSG =
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
    _actor: null,
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

// Injectable seams for _enqueuePerformanceShot — unit tests stub these to
// prove the ownership guard fires BEFORE any credits are reserved, without a
// real DB. Production callers always use the defaults.
type EnqueueShotDeps = {
  assertOwned: (url: string, userId: string) => Promise<void>;
  reserve: typeof reserveGenerationJob;
  track: typeof trackServer;
  // Optional so unit-test stubs that omit it don't crash — production default
  // always supplies it.
  markDemo?: (generationId: string) => Promise<void>;
};

// The bundled demo selfie is uploaded (client-side) to the caller's own studio
// folder at exactly this path; matching on it lets us persistently label
// gallery items made with the sample face. Exported for unit tests.
export function isDemoSelfieUrl(url: string, userId: string): boolean {
  try {
    const pathname = decodeURIComponent(new URL(url).pathname);
    return pathname.endsWith(`/${userId}/demo/selfie.jpg`);
  } catch {
    return false;
  }
}

// Persist the "demo" marker on the generation row so the gallery can badge it
// forever — the row is freshly created with tags='{}' so a plain set is safe.
async function tagGenerationDemo(generationId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("generations")
    .update({ tags: ["demo"] })
    .eq("id", generationId);
  // Non-fatal: the render must not fail because a cosmetic label didn't stick.
  if (error) console.error("demo tag write failed", error.message);
}

// Internal canonical dispatch — shared by the generatePerformanceShot handler
// AND runSmokeStudioChain so the two can NEVER drift on critical params.
// The reference-image ownership guard lives HERE (not in the handler) so every
// caller — server fn, smoke chain, and any future internal path — enforces it.
// Exported for unit tests only.
export async function _enqueuePerformanceShot(
  userId: string,
  data: z.infer<typeof GenerateSchema>,
  deps: EnqueueShotDeps = {
    assertOwned: assertOwnedReferenceImage,
    reserve: reserveGenerationJob,
    track: trackServer,
    markDemo: tagGenerationDemo,
  },
): Promise<{ jobId: string; generationId: string }> {
  // Ownership guard: each reference image must belong to the caller.
  // Purely text-to-image calls (empty imageUrls) pass through without a check.
  for (const url of data.imageUrls) {
    await deps.assertOwned(url, userId);
  }
  const out = await deps.reserve(userId, "image", data.prompt, COST_IMAGE, {
    kind: "image",
    prompt: data.prompt,
    imageUrls: data.imageUrls,
    model: data.model,
    motionVideoUrl: data.motionVideoUrl ?? null,
  });
  // Persistently label generations made with the bundled sample face so the
  // gallery can badge them (covers demoMut AND runRecipe — both route here).
  if (data.imageUrls.some((u) => isDemoSelfieUrl(u, userId))) {
    await deps.markDemo?.(out.generationId);
  }
  await deps.track("performance_shot_enqueued", userId, { jobId: out.jobId });
  return out;
}

// Enqueue-only: reserves credits + creates the job/generation row atomically,
// then returns immediately. The jobs/tick worker (running independently of
// this request) renders it, so the result survives the tab closing — the
// client polls getJobStatus (or listGenerations) to learn when it's ready.
// Ownership of data.imageUrls is enforced inside _enqueuePerformanceShot.
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
  /**
   * Template Studio provenance: the drawer sends the manifest template id when
   * a run is a one-tap video preset. The server derives the preset fee from
   * the manifest (getStudioTemplate) — no fee value ever crosses the wire, so
   * a client can neither forge a discount nor be overcharged.
   */
  templateId: z.string().max(100).optional().nullable(),
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


type EnqueueVideoDeps = {
  assertOwned: (url: string, userId: string) => Promise<void>;
  resolveGate?: typeof resolvePreviewGate;
  assertPreviewBinding?: (
    userId: string,
    previewId: string,
    fingerprint: string,
  ) => Promise<void>;
  reserve?: typeof reserveGenerationJob;
  markPreview?: (generationId: string, fingerprint?: string) => Promise<void>;
  track?: typeof trackServer;
};

type VideoPreviewBindingRow = PreviewRowCheck & {
  result_video_url: string | null;
  preview_fingerprint: string | null;
};

/**
 * The generic preview gate deliberately accepts every temporal kind.  Video
 * confirmation needs a stricter second gate: only an owned, successful video
 * preview with a binding fingerprint for the exact request can unlock the
 * full render.  Legacy previews have no fingerprint and fail closed.
 *
 * This is pure so the no-spend contract can be tested without a database.
 */
export function validateVideoPreviewBinding(
  row: VideoPreviewBindingRow | null,
  userId: string,
  expectedFingerprint: string,
  nowMs: number = Date.now(),
): void {
  const reject = (why: string): never => {
    throw new Error(`Unsupported preview confirmation: ${why}`);
  };
  // Keep the null guard as an explicit throw rather than relying on control
  // flow through the `never`-returning helper; strict TypeScript can then
  // narrow the row for every binding check below.
  if (!row) {
    throw new Error("Unsupported preview confirmation: preview not found");
  }
  if (row.user_id !== userId) {
    throw new Error("Unsupported preview confirmation: preview not found");
  }
  validateConfirmedPreview(row, userId, nowMs);
  if (row.kind !== "video") reject("preview is not a video render");
  if (!row.result_video_url) reject("video preview has no completed video result");
  if (!row.preview_fingerprint) {
    reject("legacy video preview has no exact input binding — generate a fresh preview first");
  }
  if (row.preview_fingerprint !== expectedFingerprint) {
    reject("video preview does not match these exact inputs — generate a fresh preview first");
  }
}

/**
 * Read the existing generation metadata used by the generic gate, then apply
 * the video-specific binding check.  No new table/column is needed:
 * `generations.preview_fingerprint` already exists and is populated for new
 * video previews by _enqueueVideoFromImage.
 */
async function assertVideoPreviewBinding(
  userId: string,
  previewId: string,
  expectedFingerprint: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("generations")
    .select("id, user_id, kind, mode, status, created_at, result_video_url, preview_fingerprint")
    .eq("id", previewId)
    .maybeSingle();
  if (error) {
    // Fail closed if the binding metadata cannot be read.  The caller must
    // never fall through to a paid full render on an unverifiable ticket.
    throw new Error("Unsupported preview confirmation: could not verify the exact video preview");
  }
  validateVideoPreviewBinding(
    (data as VideoPreviewBindingRow | null) ?? null,
    userId,
    expectedFingerprint,
  );
}

// Internal canonical dispatch — shared by the generateVideoFromImage handler
// AND runSmokeStudioChain so the two can NEVER drift on gating or payload shape.
// The reference-image ownership guard lives HERE (same contract as
// _enqueuePerformanceShot): the start frame and optional end frame must be the
// caller's own upload/result/avatar, checked before any gate, row or charge —
// otherwise a crafted request could animate another user's private studio
// object (the orchestrator signs studio refs with service-role access).
// Exported for unit tests only.
export async function _enqueueVideoFromImage(
  userId: string,
  data: z.infer<typeof VideoSchema>,
  deps: EnqueueVideoDeps = { assertOwned: assertOwnedReferenceImage },
): Promise<{ jobId: string; generationId: string; preview: boolean }> {
  const assertOwned = deps.assertOwned ?? assertOwnedReferenceImage;
  await assertOwned(data.imageUrl, userId);
  if (data.endFrameUrl) await assertOwned(data.endFrameUrl, userId);

  const cameraHint = data.cameraMovement ? CAMERA_HINTS[data.cameraMovement] : null;
  const fullPrompt = cameraHint ? `${data.prompt}. Camera: ${cameraHint}.` : data.prompt;
  // Bind the ticket to the original request, not the worker's preview-capped
  // 480p/5s effective values. This lets a later confirm prove the exact
  // requested full-quality inputs, including the intended resolution.
  const fingerprint = videoPreviewFingerprint({
    imageUrl: data.imageUrl,
    endFrameUrl: data.endFrameUrl ?? null,
    prompt: data.prompt,
    duration: data.duration,
    resolution: data.resolution,
    modelKey: data.modelKey,
    cameraMovement: data.cameraMovement ?? null,
    templateId: data.templateId ?? null,
  });

  // Preview-confirm gate: without a valid confirmPreviewId the render is
  // forced to 480p/≤5s and recorded as mode='preview' — its id is the ticket
  // for the follow-up full-quality render. Invalid/expired ids throw here,
  // before any row insert or charge.
  const resolveGate = deps.resolveGate ?? resolvePreviewGate;
  const gate = await resolveGate({
    userId,
    confirmPreviewId: data.confirmPreviewId ?? undefined,
  });
  if (gate.confirmed) {
    // resolvePreviewGate is intentionally generic across temporal kinds. This
    // second check narrows this video path to an owned, completed video whose
    // persisted fingerprint matches every requested input exactly.
    const assertBinding = deps.assertPreviewBinding ?? assertVideoPreviewBinding;
    if (!data.confirmPreviewId) {
      // Defensive only: the generic gate cannot confirm without a ticket.
      throw new Error("Unsupported preview confirmation: preview ticket is missing");
    }
    await assertBinding(userId, data.confirmPreviewId, fingerprint);
  }
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
  // Template Studio preset fee (owner-set 2026-08-13): running a curated video
  // preset costs a flat premium on top of the metered stage cost. Derived
  // SERVER-SIDE from the manifest — the client only names the template, so the
  // reserved amount always matches what templateCost() displayed on the card.
  let presetFee = 0;
  if (data.templateId) {
    const preset = getStudioTemplate(data.templateId);
    if (!preset) throw new Error(`Unknown template "${data.templateId}"`);
    if (preset.dispatch === "studio" && preset.kinds.includes("video")) {
      presetFee = TEMPLATE_VIDEO_PRESET_FEE;
    }
  }
  // Model-tiered: premium video models cost more Aura so the render stays
  // profitable. Same computeCost the UI previews → preview == charge == refund.
  const videoCost =
    computeCost({
      features: ["video"],
      model: data.modelKey,
      durationSeconds: effDuration,
      resolution: effResolution,
    }).total + presetFee;
  const reserve = deps.reserve ?? reserveGenerationJob;
  const out = await reserve(userId, "video", fullPrompt, videoCost, {
    kind: "video",
    model: data.modelKey,
    prompt: fullPrompt,
    imageUrls: data.endFrameUrl ? [data.imageUrl, data.endFrameUrl] : [data.imageUrl],
    duration: effDuration,
    resolution: effResolution,
    cameraMovement: data.cameraMovement,
    cameraMovementKey: data.cameraMovement ?? null,
    // Keep the original requested quality in existing job metadata; the
    // worker still receives the effective preview values above.
    requestedDuration: data.duration,
    requestedResolution: data.resolution,
    ...(previewPass ? { previewFingerprint: fingerprint } : {}),
    ...(previewPass ? { previewOnly: true } : {}),
  });
  if (previewPass) {
    const markPreview = deps.markPreview ?? markGenerationPreview;
    await markPreview(out.generationId, fingerprint);
  }
  const track = deps.track ?? trackServer;
  await track("video_enqueued", userId, { jobId: out.jobId });
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
): Promise<{ resultImageUrl: string | null; resultVideoUrl: string | null; modelUsed: string | null }> {
  for (let i = 0; i < SMOKE_MAX_POLL_ATTEMPTS; i++) {
    const { data: job } = await supabaseAdmin
      .from("jobs")
      .select("id, status, error, generation_id")
      .eq("id", jobId)
      .maybeSingle();
    if (!job) throw new Error(`Smoke: job ${jobId} not found`);

    let gen: { status: string | null; result_image_url: string | null; result_video_url: string | null; error: string | null; model: string | null } | null = null;
    if (job.generation_id) {
      const { data } = await supabaseAdmin
        .from("generations")
        .select("status, result_image_url, result_video_url, error, model")
        .eq("id", job.generation_id)
        .maybeSingle();
      gen = data ?? null;
    }

    const status = gen?.status ?? job.status;
    if (status === "succeeded" || status === "complete") {
      return {
        resultImageUrl: gen?.result_image_url ?? null,
        resultVideoUrl: gen?.result_video_url ?? null,
        modelUsed: gen?.model ?? null,
      };
    }
    if (status === "failed" || status === "cancelled" || job.status === "failed" || job.status === "cancelled") {
      throw new Error(gen?.error ?? job.error ?? "Generation failed");
    }
    await new Promise<void>((r) => setTimeout(r, SMOKE_POLL_INTERVAL_MS));
  }
  throw new Error("Studio chain smoke: job timed out after ~5 minutes");
}

/** Ensure the smoke chain's reference image is an asset the given user OWNS.
 *  Already-owned URLs (own studio upload / saved avatar / own generation
 *  result) pass through untouched; anything else is fetched (SSRF-guarded)
 *  and re-uploaded into the user's own studio folder. */
async function ensureOwnedSmokeReference(userId: string, url: string): Promise<string> {
  try {
    await assertOwnedReferenceImage(url, userId);
    return url;
  } catch {
    // Not owned — stage a caller-owned copy below.
  }
  assertTrustedUrl(url);
  const { bytes, mime } = await fetchToBytes(url);
  const path = `${userId}/smoke/reference-${crypto.randomUUID()}.jpg`;
  const { error } = await supabaseAdmin.storage
    .from("studio")
    .upload(path, bytes, { contentType: mime || "image/jpeg", upsert: true });
  if (error) throw new Error(`Smoke reference staging failed: ${error.message}`);
  return supabaseAdmin.storage.from("studio").getPublicUrl(path).data.publicUrl;
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
): Promise<{ url: string; cost: number; videoModelUsed: string | null; lipsyncModelUsed: string | null }> {
  const { getStudioTemplate, TEMPLATE_DEFAULTS } = await import("./template-studio");
  const tpl = getStudioTemplate("concert-lipsync");
  if (!tpl) throw new Error("concert-lipsync not found in template manifest");

  const imageModel = tpl.imageModel ?? TEMPLATE_DEFAULTS.imageModel;
  const videoModel = tpl.videoModel ?? TEMPLATE_DEFAULTS.videoModel;
  const lipsyncModel = LipSyncSchema.shape.model.parse(
    tpl.lipsyncModel ?? TEMPLATE_DEFAULTS.lipsyncModel,
  );

  // Stage 0: _enqueuePerformanceShot enforces the reference-image ownership
  // guard for EVERY caller (no smoke bypass). The canonical smoke selfie is an
  // external asset, so stage a copy into the smoke user's own studio folder —
  // the chain then passes the exact same guard a real user does.
  const ownedRef = await ensureOwnedSmokeReference(userId, referenceImageUrl);

  // Stage 1: generate the performance still — same dispatch as generatePerformanceShot.
  const imgPrompt = tpl.imagePrompt ?? "smoke test: studio performance portrait";
  const img = await _enqueuePerformanceShot(userId, {
    prompt: imgPrompt,
    imageUrls: [ownedRef],
    model: imageModel,
    motionVideoUrl: null,
  });
  const imgResult = await awaitSmokeJob(img.jobId);
  if (!imgResult.resultImageUrl) throw new Error("Studio chain stage 1 (image) returned no URL");

  // Stage 2: animate the still — same dispatch as generateVideoFromImage. No
  // confirmPreviewId, so the preview gate forces the cheap 480p/≤5s pass —
  // identical to a first-time user render, and exercises the gate itself.
  // Primary model: seedance-2.0-fast (BytePlus). Throws on provider failure so
  // the smoke step accurately reflects provider reachability.
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
  if (!vidResult.resultVideoUrl) throw new Error("Studio chain stage 2 (video) returned no URL");
  const resultVideoUrl = vidResult.resultVideoUrl;
  // modelUsed is the actual model key written to the generation row by the
  // orchestrator on success — may differ from videoModel if fallback triggered.
  const videoModelUsed = vidResult.modelUsed;
  const videoCost = computeCost({
    features: ["video"],
    model: videoModel,
    durationSeconds: Math.min(TEMPLATE_DEFAULTS.durationSeconds, PREVIEW_MAX_SECONDS),
    resolution: PREVIEW_RESOLUTION,
  }).total;

  // Stage 3: lip-sync the clip to the test audio — same dispatch as lipSyncVideo.
  // Throws on provider failure so the smoke step accurately reflects lipsync provider
  // reachability and confirms the fal-ai/sync-lipsync/v2 adapter is wired correctly.
  const lip = await _enqueueLipSync(userId, {
    videoUrl: resultVideoUrl,
    audioUrl,
    model: lipsyncModel,
  });
  const lipResult = await awaitSmokeJob(lip.jobId);
  if (!lipResult.resultVideoUrl) throw new Error("Studio chain stage 3 (lipsync) returned no URL");
  const finalLipsyncUrl = lipResult.resultVideoUrl;
  // modelUsed is the actual model key written to the generation row by the
  // orchestrator on success — may differ from lipsyncModel if fallback triggered.
  const lipsyncModelUsed = lipResult.modelUsed;
  const lipsyncCost = computeCost({ features: ["lipsync"], model: lipsyncModel }).total;

  return { url: finalLipsyncUrl, cost: COST_IMAGE + videoCost + lipsyncCost, videoModelUsed, lipsyncModelUsed };
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
      .eq("is_hidden", showHidden);
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
    // is_watermarked is in the generated types; rows is already correctly typed.
    const items = (rows ?? []).map((row) => {
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
    // is_watermarked is in the generated types; data is already correctly typed.
    const items = (data ?? []).map((row) => {
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
  sourceGenerationId: z.string().uuid().optional(),
  workflowMode: z.enum(["colors", "anywhere"]).optional(),
  workflowAngle: z.enum(["wide", "closeup"]).optional(),
  variantWorkflowKind: z.enum(["build_scene", "luxury_interior"]).optional(),
  variantMode: z.enum(["colors", "anywhere"]).optional(),
  variantPresetId: z.string().max(100).optional(),
  prompt: z.string().max(2000).optional(),
  params: MotionParamsSchema,
  /** Preview-confirm gate: a succeeded preview's id unlocks the full render. */
  confirmPreviewId: z.string().uuid().optional().nullable(),
}).refine(
  (value) => (!!value.workflowMode === !!value.workflowAngle),
  "Workflow mode and angle must be supplied together",
).refine(
  (value) => [value.variantWorkflowKind, value.variantMode, value.variantPresetId].filter(Boolean).length % 3 === 0,
  "Variant workflow kind, mode and preset must be supplied together",
);

export const PerformanceReskinSchema = z.object({
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
  fingerprint?: string,
): Promise<{ previewPass: boolean; params: z.infer<typeof MotionParamsSchema> }> {
  if (confirmPreviewId && fingerprint) {
    const { data: preview } = await supabaseAdmin
      .from("generations")
      .select("id")
      .eq("id", confirmPreviewId)
      .eq("user_id", userId)
      .eq("mode", "preview")
      .eq("preview_fingerprint", fingerprint)
      .in("status", ["succeeded", "complete"])
      .not("result_video_url", "is", null)
      .maybeSingle();
    if (!preview) throw new Error("Preview does not match these exact motion inputs or has not completed successfully");
    return { previewPass: false, params };
  }
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
async function markGenerationPreview(generationId: string, fingerprint?: string, motionSeed?: number): Promise<void> {
  await supabaseAdmin
    .from("generations")
    .update({
      mode: "preview",
      ...(fingerprint ? { preview_fingerprint: fingerprint } : {}),
      ...(typeof motionSeed === "number" ? { motion_seed: motionSeed } : {}),
    })
    .eq("id", generationId);
}

function canonicalMotionMedia(raw: string): string {
  const url = new URL(raw);
  const storage = url.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/studio\/(.+)$/);
  return storage ? `studio:${decodeURIComponent(storage[1])}` : `${url.origin}${url.pathname}`;
}

export function motionParamsWithEffectiveSeed(
  params: z.infer<typeof MotionParamsSchema>,
  previewSeed?: number | null,
  generatedSeed = Math.floor(Math.random() * 2_147_483_647),
): NonNullable<z.infer<typeof MotionParamsSchema>> {
  return { ...(params ?? {}), seed: params?.seed ?? previewSeed ?? generatedSeed };
}

async function previewMotionSeed(userId: string, previewId: string | null | undefined): Promise<number | null> {
  if (!previewId) return null;
  const { data } = await supabaseAdmin.from("generations")
    .select("motion_seed")
    .eq("id", previewId)
    .eq("user_id", userId)
    .eq("mode", "preview")
    .maybeSingle();
  return typeof data?.motion_seed === "number" ? data.motion_seed : null;
}

type MotionWorkflowPayload = {
  approvalProvenance?: {
    wideGenerationId?: unknown;
    closeupGenerationId?: unknown;
    base?: unknown;
    angles?: Record<string, unknown>;
  };
  assetPaths?: Record<string, unknown>;
  angleVideoOverridePaths?: Record<string, unknown>;
  phoneVideoUrlPath?: unknown;
};

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
  const { data, error } = kind === "motion"
    ? await client.rpc("create_motion_generation_and_reserve", {
        _user: userId,
        _prompt: prompt,
        _amount: amount,
        _payload: payload,
      })
    : await client.rpc("create_generation_and_reserve", {
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
    if (/motion_enqueue_limit/i.test(error.message)) {
      throw new Error("Two motion angles are already rendering. Wait for one to finish before retrying.");
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
    assertOwnStudioUpload(data.drivingVideoUrl, userId);
    if (data.sourceGenerationId) {
      const { data: source } = await supabaseAdmin
        .from("generations")
        .select("id, result_image_url")
        .eq("id", data.sourceGenerationId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!source || !source.result_image_url || canonicalMotionMedia(source.result_image_url) !== canonicalMotionMedia(data.imageUrl)) {
        throw new Error("Source plate does not match its owned generation");
      }
    }
    if (data.workflowMode && data.workflowAngle) {
      const { data: workflow } = await supabaseAdmin
        .from("performance_workflow_drafts")
        .select("payload")
        .eq("user_id", userId)
        .eq("mode", data.workflowMode)
        .maybeSingle();
      const payload = workflow?.payload as unknown as MotionWorkflowPayload | undefined;
      const provenance = payload?.approvalProvenance;
      const expected = data.workflowAngle === "wide"
        ? provenance?.wideGenerationId
        : provenance?.closeupGenerationId;
      const paths = payload?.assetPaths;
      if (
        expected !== data.sourceGenerationId ||
        typeof paths?.wideReferenceUrl !== "string" ||
        typeof paths?.closeupReferenceUrl !== "string"
      ) {
        throw new Error("Approve this plate in the saved workflow with both composition references before motion transfer");
      }
    }
    if (data.variantWorkflowKind && data.variantMode && data.variantPresetId) {
      const { data: workflow } = await supabaseAdmin
        .from("performance_variant_drafts")
        .select("payload")
        .eq("user_id", userId)
        .eq("mode", data.variantMode)
        .eq("workflow_kind", data.variantWorkflowKind)
        .maybeSingle();
      const payload = workflow?.payload as unknown as MotionWorkflowPayload | undefined;
      const approved = data.variantPresetId === "base"
        ? payload?.approvalProvenance?.base
        : payload?.approvalProvenance?.angles?.[data.variantPresetId];
      const drivingPath = canonicalMotionMedia(data.drivingVideoUrl).replace(/^studio:/, "");
      const expectedPath = payload?.angleVideoOverridePaths?.[data.variantPresetId] ?? payload?.phoneVideoUrlPath;
      if (
        approved !== data.sourceGenerationId ||
        drivingPath !== expectedPath
      ) {
        throw new Error("Motion input does not match the saved approved variant and performance recording");
      }
    }

    if (!(await hasActiveWorkerForKind("motion"))) {
      throw new Error(NO_MOTION_BACKEND_MSG);
    }

    // Preview-confirm gate: unconfirmed runs get a capped frame budget and
    // preview pricing; the preview's id is the ticket for the full render.
    const effectiveParams = motionParamsWithEffectiveSeed(
      data.params,
      await previewMotionSeed(userId, data.confirmPreviewId),
    );
    const { motionInputFingerprint } = await import("./motion-preview-fingerprint.server");
    const fingerprint = motionInputFingerprint({ ...data, params: effectiveParams });
    const gated = await gateMotionEnqueue(userId, data.confirmPreviewId, effectiveParams, fingerprint);

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
    if (gated.previewPass) await markGenerationPreview(out.generationId, fingerprint, effectiveParams.seed);
    await trackServer("motion_transfer_enqueued", userId, { jobId: out.jobId });
    return { ...out, preview: gated.previewPass };
  });

/**
 * Shared enqueue core for the Performance Shot (video-driven avatar reskin).
 * Called by BOTH the web server fn below and the public mobile endpoint
 * (/api/public/perform) so guards, preview gate, and pricing never drift
 * between surfaces.
 */
export async function _enqueuePerformanceReskin(
  userId: string,
  data: z.infer<typeof PerformanceReskinSchema>,
): Promise<{ jobId: string; generationId: string; preview: boolean }> {
  assertOwnStudioUpload(data.performanceVideoUrl, userId);
  await assertOwnedReferenceImage(data.avatarImageUrl, userId);
  if (data.audioUrl) assertOwnStudioUpload(data.audioUrl, userId);

  if (!(await hasActiveWorkerForKind("motion"))) {
    throw new Error(NO_MOTION_BACKEND_MSG);
  }

  // Preview-confirm gate: unconfirmed runs get a capped frame budget and
  // preview pricing; the preview's id is the ticket for the full render.
  const effectiveParams = motionParamsWithEffectiveSeed(
    data.params,
    await previewMotionSeed(userId, data.confirmPreviewId),
  );
  const { performanceReskinFingerprint } = await import("./motion-preview-fingerprint.server");
  const fingerprint = performanceReskinFingerprint({ ...data, params: effectiveParams });
  const gated = await gateMotionEnqueue(userId, data.confirmPreviewId, effectiveParams, fingerprint);

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
  if (gated.previewPass) await markGenerationPreview(out.generationId, fingerprint, effectiveParams.seed);
  await trackServer("performance_reskin_enqueued", userId, { jobId: out.jobId });
  return { ...out, preview: gated.previewPass };
}

export const generatePerformanceReskin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PerformanceReskinSchema.parse(input))
  .handler(async ({ data, context }) => _enqueuePerformanceReskin(context.userId, data));
