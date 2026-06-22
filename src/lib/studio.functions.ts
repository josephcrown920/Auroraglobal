import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { orchestrate } from "./orchestrator.server";
import { fetchToBytes } from "./replicate.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const COST_IMAGE = 1;
const COST_VIDEO = 5;
const COST_LIPSYNC = 3;

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

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
  if (data === false) throw new Error("Not enough credits. Buy more from the Credits panel.");
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
    await chargeCredits(userId, COST_VIDEO, "video_generation", row.id);
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
      await refundCredits(userId, COST_VIDEO, row.id);
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
  model: z.enum(["fal-ai/sync-lipsync/v2", "fal-ai/wav2lip"]).default("fal-ai/sync-lipsync/v2"),
});

export const lipSyncVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LipSyncSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const model = data.model;
    const { data: row, error: insErr } = await supabase
      .from("generations")
      .insert({
        user_id: userId,
        prompt: model === "fal-ai/wav2lip" ? "lip sync (wav2lip)" : "lip sync (sync 1.9)",
        status: "processing",
        kind: "video",
        model,
        input_images: [data.videoUrl],
        audio_url: data.audioUrl,
      })
      .select()
      .single();
    if (insErr || !row) throw new Error(insErr?.message || "Insert failed");
    await chargeCredits(userId, COST_LIPSYNC, "lipsync", row.id);
    try {
      const out = await orchestrate({
        kind: "lipsync",
        model,
        videoUrl: data.videoUrl,
        audioUrl: data.audioUrl,
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
      await refundCredits(userId, COST_LIPSYNC, row.id);
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
    const { supabase } = context;
    const { data, error } = await supabase
      .from("generations")
      .select("id, prompt, kind, model, result_image_url, result_video_url, is_favorite, tags, created_at")
      .eq("status", "complete")
      .order("is_favorite", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const listGenerations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("generations")
      .select("id, prompt, status, kind, model, result_image_url, result_video_url, input_images, motion_video_url, audio_url, camera_movement, created_at, error")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
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
