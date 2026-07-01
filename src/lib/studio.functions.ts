import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { orchestrate, hasActiveWorkerForKind, assertFreeModeServable } from "./orchestrator.server";
import { buildLatentSyncRequest } from "./lipsync-workflows.server";
import { fetchToBytes } from "./replicate.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertTrustedUrl } from "./url-guard";
import { buildMimicMotionRequest, MOTION_TYPES, CAMERA_MOVEMENTS } from "./motion-workflows.server";
import { computeCost } from "./pricing";
import { isAdmin } from "./admin.server";

const COST_IMAGE = 1;

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
  prompt: z.string().min(3).max(2000),
  imageUrls: z.array(z.string().url()).min(1).max(6),
  motionVideoUrl: z.string().url().optional().nullable(),
  // Default runs on the Replicate key alone (Gemini 2.5 Flash image, a.k.a.
  // Nano Banana). If a Gemini/Lovable key is added later, picking those models
  // uses them first and falls back to Replicate automatically.
  model: z.string().default("google/nano-banana"),
});

export const generatePerformanceShot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: row, error: insErr } = await supabase
      .from("generations")
      .insert({
        user_id: userId,
        prompt: data.prompt,
        status: "processing",
        kind: "image",
        model: data.model,
        input_images: data.imageUrls,
        motion_video_url: data.motionVideoUrl ?? null,
        credits_cost: COST_IMAGE,
      })
      .select()
      .single();
    if (insErr || !row) throw new Error(insErr?.message || "Insert failed");

    await chargeCredits(userId, COST_IMAGE, "image_generation", row.id);

    try {
      // All image models route through the orchestrator, which tries the chosen
      // model/provider first and falls back to the next one automatically.
      const out = await orchestrate({
        kind: "image",
        model: data.model,
        prompt: data.prompt,
        imageUrls: data.imageUrls,
        userId,
        refId: row.id,
      });
      const { bytes, mime } = await fetchToBytes(out.url);
      const ext = (mime || "image/png").split("/")[1]?.split("+")[0] || "png";
      const path = `${userId}/results/${row.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("studio")
        .upload(path, bytes, { contentType: mime || "image/png", upsert: true });
      if (upErr) throw new Error(upErr.message);
      const publicUrl = supabase.storage.from("studio").getPublicUrl(path).data.publicUrl;
      await supabase
        .from("generations")
        .update({ status: "complete", result_image_url: publicUrl })
        .eq("id", row.id);
      return { id: row.id, resultUrl: publicUrl };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await supabase
        .from("generations")
        .update({ status: "failed", error: msg })
        .eq("id", row.id);
      await refundCredits(userId, COST_IMAGE, row.id);
      throw new Error(msg);
    }
  });

const VideoSchema = z.object({
  imageUrl: z.string().url(),
  prompt: z.string().min(2).max(1000),
  duration: z.number().int().min(3).max(12).default(5),
  resolution: z.enum(["480p", "720p", "1080p"]).default("720p"),
  modelKey: z.string().default("seedance-2.0-fast"),
  /** Optional motion / camera control preset (e.g. zoom_in, pan_left, orbit). */
  cameraMovement: z.string().max(40).optional().nullable(),
  /** Optional end-frame image URL (Kling supports start+end frame interpolation). */
  endFrameUrl: z.string().url().optional().nullable(),
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


export const generateVideoFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => VideoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const cameraHint = data.cameraMovement ? CAMERA_HINTS[data.cameraMovement] : null;
    const fullPrompt = cameraHint ? `${data.prompt}. Camera: ${cameraHint}.` : data.prompt;

    const { data: row, error: insErr } = await supabase
      .from("generations")
      .insert({
        user_id: userId,
        prompt: fullPrompt,
        status: "processing",
        kind: "video",
        model: data.modelKey,
        input_images: data.endFrameUrl ? [data.imageUrl, data.endFrameUrl] : [data.imageUrl],
        camera_movement: data.cameraMovement ?? null,
      })
      .select()
      .single();
    if (insErr || !row) throw new Error(insErr?.message || "Insert failed");
    // Free GPU only mode: video has no $0 hosted fallback, so fail before charging
    // credits if no free worker is online (no paid provider can ever be reached).
    await assertFreeModeServable("video");
    // Model-tiered: premium video models cost more Aura so the render stays
    // profitable. Same computeCost the UI previews → preview == charge == refund.
    const videoCost = computeCost({
      features: ["video"],
      model: data.modelKey,
      durationSeconds: data.duration,
      resolution: data.resolution,
    }).total;
    await chargeCredits(userId, videoCost, "video_generation", row.id);
    try {
      const out = await orchestrate({
        kind: "video",
        model: data.modelKey,
        prompt: fullPrompt,
        imageUrls: data.endFrameUrl ? [data.imageUrl, data.endFrameUrl] : [data.imageUrl],
        duration: data.duration,
        resolution: data.resolution,
        cameraMovement: data.cameraMovement,
        userId,
        refId: row.id,
      });
      const { bytes, mime } = await fetchToBytes(out.url);
      const path = `${userId}/videos/${row.id}.mp4`;
      const { error: upErr } = await supabase.storage
        .from("studio")
        .upload(path, bytes, { contentType: mime || "video/mp4", upsert: true });
      if (upErr) throw new Error(upErr.message);
      const publicUrl = supabase.storage.from("studio").getPublicUrl(path).data.publicUrl;
      await supabase
        .from("generations")
        .update({ status: "complete", result_video_url: publicUrl })
        .eq("id", row.id);
      return { id: row.id, videoUrl: publicUrl };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await supabase.from("generations").update({ status: "failed", error: msg }).eq("id", row.id);
      await refundCredits(userId, videoCost, row.id);
      throw new Error(msg);
    }
  });



// ─── Split Reality ─────────────────────────────────────────────────────────
// Runs two image generations in parallel from the same input: ultra-realism + cinematic vision.
const SplitRealitySchema = z.object({
  imageUrls: z.array(z.string().url()).min(1).max(3),
  basePrompt: z.string().min(3).max(1000).default(""),
});

const ULTRA_REALISM_PROMPT =
  "Ultra-realistic mirror-selfie style photograph of the subject, taken on a modern smartphone. Preserve exact facial likeness, skin tone, beard, hairstyle, body proportions and outfit. Natural indoor lighting, subtle window reflections, realistic skin texture with visible pores, natural lens distortion, sharp focus on the face, casual confident pose. Documentary photographic realism, 4K, no styling artifacts, no text or logos.";

const CINEMATIC_VISION_PROMPT =
  "Dramatic cinematic close-up portrait of the subject, anamorphic lens look, intense emotional expression, mid-action (yelling or singing), windswept hair, moody overcast sky in background, desaturated film color grade with subtle teal/charcoal palette. Preserve exact facial likeness. Shallow depth of field, motion in the hair, painterly lighting, shot on ARRI Alexa, film grain, 4K cinematic still.";

export const generateSplitReality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SplitRealitySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const model = "google/gemini-3.1-flash-image-preview";

    const runOne = async (variant: "ultra" | "cinematic", prompt: string) => {
      const { data: row, error: insErr } = await supabase
        .from("generations")
        .insert({
          user_id: userId,
          prompt: `[Split Reality / ${variant}] ${prompt}`,
          status: "processing",
          kind: "image",
          model,
          input_images: data.imageUrls,
          credits_cost: COST_IMAGE,
        })
        .select()
        .single();
      if (insErr || !row) throw new Error(insErr?.message || "Insert failed");
      await chargeCredits(userId, COST_IMAGE, `split_${variant}`, row.id);

      try {
        const out = await orchestrate({
          kind: "image",
          model,
          prompt: prompt + (data.basePrompt ? " " + data.basePrompt : ""),
          imageUrls: data.imageUrls,
          userId,
          refId: row.id,
        });
        const { bytes, mime } = await fetchToBytes(out.url);
        const ext = (mime || "image/png").split("/")[1]?.split("+")[0] || "png";
        const path = `${userId}/results/${row.id}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("studio")
          .upload(path, bytes, { contentType: mime || "image/png", upsert: true });
        if (upErr) throw new Error(upErr.message);
        const publicUrl = supabase.storage.from("studio").getPublicUrl(path).data.publicUrl;
        await supabase.from("generations").update({ status: "complete", result_image_url: publicUrl }).eq("id", row.id);
        return { id: row.id, url: publicUrl, variant };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        await supabase.from("generations").update({ status: "failed", error: msg }).eq("id", row.id);
        await refundCredits(userId, COST_IMAGE, row.id);
        throw new Error(msg);
      }
    };

    const [ultra, cinematic] = await Promise.all([
      runOne("ultra", ULTRA_REALISM_PROMPT),
      runOne("cinematic", CINEMATIC_VISION_PROMPT),
    ]);
    return { ultra, cinematic };
  });

const LipSyncSchema = z.object({
  videoUrl: z.string().url(),
  audioUrl: z.string().url(),
  model: z.enum(["fal-ai/sync-lipsync/v2", "fal-ai/wav2lip", "latentsync"]).default("fal-ai/sync-lipsync/v2"),
});

export const lipSyncVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LipSyncSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
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
    const { data: row, error: insErr } = await supabase
      .from("generations")
      .insert({
        user_id: userId,
        prompt: promptLabel,
        status: "processing",
        kind: "video",
        model,
        input_images: [data.videoUrl],
        audio_url: data.audioUrl,
      })
      .select()
      .single();
    if (insErr || !row) throw new Error(insErr?.message || "Insert failed");
    // Free GPU only mode: lip-sync has no $0 hosted fallback, so a hosted engine
    // can't run for free — fail before charging credits unless a worker is online.
    await assertFreeModeServable("lipsync");
    // Model-tiered: premium engines (Sync 1.9) cost more Aura than the self-hosted
    // budget engine. Same computeCost the UI previews → preview == charge == refund.
    const lipsyncCost = computeCost({ features: ["lipsync"], model }).total;
    await chargeCredits(userId, lipsyncCost, "lipsync", row.id);
    try {
      // Self-hosted LatentSync carries a ComfyUI graph + flat params so it runs
      // on every worker protocol; hosted engines never get these.
      const selfHostedParts = selfHosted
        ? buildLatentSyncRequest({ videoUrl: data.videoUrl, audioUrl: data.audioUrl })
        : undefined;
      const out = await orchestrate({
        kind: "lipsync",
        model,
        selfHostedOnly: selfHosted,
        videoUrl: data.videoUrl,
        audioUrl: data.audioUrl,
        userId,
        refId: row.id,
        ...(selfHostedParts ?? {}),
      });
      const { bytes, mime } = await fetchToBytes(out.url);
      const path = `${userId}/videos/${row.id}.mp4`;
      const { error: upErr } = await supabase.storage
        .from("studio")
        .upload(path, bytes, { contentType: mime || "video/mp4", upsert: true });
      if (upErr) throw new Error(upErr.message);
      const publicUrl = supabase.storage.from("studio").getPublicUrl(path).data.publicUrl;
      await supabase
        .from("generations")
        .update({ status: "complete", result_video_url: publicUrl })
        .eq("id", row.id);
      return { id: row.id, videoUrl: publicUrl };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      await supabase.from("generations").update({ status: "failed", error: msg }).eq("id", row.id);
      await refundCredits(userId, lipsyncCost, row.id);
      throw new Error(msg);
    }
  });

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
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("generations")
      .select("id, prompt, kind, model, result_image_url, result_video_url, is_favorite, tags, created_at, is_watermarked")
      // Sync fns finish as "complete"; async queue jobs (motion, performance_reskin,
      // tiktok_remix_child) finish as "succeeded" — include both so all gens land here.
      .in("status", ["complete", "succeeded"])
      .order("is_favorite", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    // Mask raw provider URLs for free-tier items; replace with signed proxy URLs.
    // Images → signed watermark-image proxy (Sharp-composited AURORA overlay).
    // Videos → signed watermark-video proxy (FFmpeg-composited AURORA overlay).
    // Raw provider URLs are never sent to Free clients.
    const { signWatermarkToken } = await import("@/lib/watermark-token.server");
    // Cast to any[] — is_watermarked is in the DB but not in the generated types.ts;
    // accessing it via the SelectQueryError type would require a full types regen.
    const items = ((data ?? []) as any[]).map((row: any) => {
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
      const { bytes, mime } = await fetchToBytes(out.url);
      const ext = (mime || "image/png").split("/")[1]?.split("+")[0] || "png";
      const path = `${userId}/results/${row.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("studio")
        .upload(path, bytes, { contentType: mime || "image/png", upsert: true });
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
});

const PerformanceReskinSchema = z.object({
  performanceVideoUrl: z.string().url(),
  avatarImageUrl: z.string().url(),
  outfit: z.string().max(400).optional(),
  location: z.string().max(400).optional(),
  audioUrl: z.string().url().optional(),
  prompt: z.string().max(2000).optional(),
  params: MotionParamsSchema,
});

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
    assertTrustedUrl(data.imageUrl);
    assertTrustedUrl(data.drivingVideoUrl);

    if (!(await hasActiveWorkerForKind("motion"))) {
      throw new Error(NO_MOTION_BACKEND_MSG);
    }

    const req = buildMimicMotionRequest({
      imageUrl: data.imageUrl,
      drivingVideoUrl: data.drivingVideoUrl,
      prompt: data.prompt,
      params: data.params,
    });
    const out = await reserveGenerationJob(
      userId,
      "motion",
      data.prompt ?? "Motion transfer",
      computeCost({ features: ["motion"] }).total,
      req as unknown as Record<string, unknown>,
    );
    await trackServer("motion_transfer_enqueued", userId, { jobId: out.jobId });
    return out;
  });

export const generatePerformanceReskin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PerformanceReskinSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    assertTrustedUrl(data.performanceVideoUrl);
    assertTrustedUrl(data.avatarImageUrl);
    if (data.audioUrl) assertTrustedUrl(data.audioUrl);

    if (!(await hasActiveWorkerForKind("motion"))) {
      throw new Error(NO_MOTION_BACKEND_MSG);
    }

    const payload = {
      performanceVideoUrl: data.performanceVideoUrl,
      avatarImageUrl: data.avatarImageUrl,
      outfit: data.outfit,
      location: data.location,
      audioUrl: data.audioUrl,
      prompt: data.prompt,
      params: data.params,
    };
    const out = await reserveGenerationJob(
      userId,
      "performance_reskin",
      data.prompt ?? "Performance reskin",
      computeCost({ features: ["video", "motion"] }).total,
      payload as Record<string, unknown>,
    );
    await trackServer("performance_reskin_enqueued", userId, { jobId: out.jobId });
    return out;
  });
