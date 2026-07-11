// Photo Avatar ("Talking Photo") generation.
//
// Flow:
//   1. User uploads a photo/video-frame client-side → studio bucket path saved here.
//   2. At generation time: HF TTS converts the script to audio → both photo and
//      audio get fresh 1-hour signed URLs → heygen/photo-video adapter animates
//      the face and returns a video URL.
//
// Credit flow: same as every other Aurora render — reserveOrchestrateRecord
// reserves before the API call and commits on success.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { reserveOrchestrateRecord } from "@/lib/generate-core.server";
import { computeCost } from "@/lib/pricing";
import { hfTextToSpeech } from "@/lib/hf.server";
import { UGC_TTS_MODEL } from "@/lib/ugc.server";

export const PHOTO_AVATAR_MODEL = "heygen/photo-video";
const PHOTO_AVATAR_COST = computeCost({
  features: ["lipsync"],
  model: PHOTO_AVATAR_MODEL,
}).total;

export type PhotoAvatarRow = {
  id: string;
  user_id: string;
  name: string;
  storage_path: string;
  created_at: string;
};

export type PhotoAvatarWithUrl = PhotoAvatarRow & { signedUrl: string };

// ─── helpers ─────────────────────────────────────────────────────────────────

async function signPath(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from("studio")
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) throw new Error(`sign failed: ${error?.message ?? "no url"}`);
  return data.signedUrl;
}

async function uploadAudioToStudio(
  userId: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<string> {
  const ext = contentType.includes("flac") ? "flac" : "mp3";
  const path = `${userId}/avatars/tts-${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from("studio")
    .upload(path, Buffer.from(bytes), { contentType, upsert: true });
  if (error) throw new Error(`audio upload failed: ${error.message}`);
  return signPath(path);
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export const savePhotoAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1).max(100),
        storagePath: z.string().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("user_photo_avatars" as never)
      .insert({
        user_id: context.userId,
        name: data.name.trim(),
        storage_path: data.storagePath,
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as PhotoAvatarRow;
  });

export const listPhotoAvatars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("user_photo_avatars" as never)
      .select("*")
      .eq("user_id" as never, context.userId)
      .order("created_at" as never, { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as PhotoAvatarRow[];
    const withUrls = await Promise.all(
      rows.map(async (r) => {
        try {
          const signedUrl = await signPath(r.storage_path);
          return { ...r, signedUrl } as PhotoAvatarWithUrl;
        } catch {
          return { ...r, signedUrl: "" } as PhotoAvatarWithUrl;
        }
      }),
    );
    return withUrls;
  });

export const deletePhotoAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("user_photo_avatars" as never)
      .select("storage_path")
      .eq("id" as never, data.id)
      .eq("user_id" as never, context.userId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Avatar not found");

    const { error: delErr } = await supabaseAdmin
      .from("user_photo_avatars" as never)
      .delete()
      .eq("id" as never, data.id)
      .eq("user_id" as never, context.userId);
    if (delErr) throw new Error(delErr.message);

    try {
      await supabaseAdmin.storage
        .from("studio")
        .remove([(row as PhotoAvatarRow).storage_path]);
    } catch {
      // best-effort
    }

    return { ok: true };
  });

// ─── Generation ──────────────────────────────────────────────────────────────

export type PhotoAvatarGenerateResult =
  | { ok: true; generationId: string; url: string }
  | { ok: false; error: string; insufficient?: boolean };

export const generateFromPhotoAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        avatarId: z.string().uuid(),
        script: z.string().min(1).max(2000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<PhotoAvatarGenerateResult> => {
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("user_photo_avatars" as never)
      .select("*")
      .eq("id" as never, data.avatarId)
      .eq("user_id" as never, context.userId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Avatar not found");
    const avatar = row as PhotoAvatarRow;

    // 1. Sign the stored photo for HeyGen access (1 hour)
    const photoUrl = await signPath(avatar.storage_path, 3600);

    // 2. Generate TTS audio from the script (HuggingFace MMS-TTS)
    const tts = await hfTextToSpeech(UGC_TTS_MODEL, data.script);
    const audioUrl = await uploadAudioToStudio(
      context.userId,
      tts.bytes,
      tts.contentType,
    );

    // 3. Reserve credits + dispatch via heygen/photo-video adapter
    const outcome = await reserveOrchestrateRecord({
      userId: context.userId,
      kind: "lipsync",
      cost: PHOTO_AVATAR_COST,
      reason: "photo_avatar_video",
      prompt: data.script.slice(0, 200),
      model: PHOTO_AVATAR_MODEL,
      pinnedModelOnly: true,
      imageUrls: [photoUrl],
      audioUrl,
    });

    if (!outcome.ok) {
      return { ok: false, error: outcome.error, insufficient: outcome.insufficient };
    }
    return { ok: true, generationId: outcome.generationId, url: outcome.url };
  });

export { PHOTO_AVATAR_COST };
