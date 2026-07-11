// Server functions for Platform Talking Avatar Templates.
//
// Three generation paths by template kind:
//   "photo"         → TTS → HeyGen photo-video (heygen/photo-video, ultra)
//   "video"         → TTS → sync.so lipsync-2 (sync/lipsync-2, premium)
//   "heygen-avatar" → NO TTS — HeyGen handles speech internally via avatar_id+voice_id (heygen/avatar, ultra)

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { reserveOrchestrateRecord } from "@/lib/generate-core.server";
import { computeCost } from "@/lib/pricing";
import { hfTextToSpeech } from "@/lib/hf.server";
import { UGC_TTS_MODEL } from "@/lib/ugc.server";
import { PLATFORM_TEMPLATES } from "@/lib/platform-templates";

export const PLATFORM_VIDEO_MODEL = "sync/lipsync-2";
export const PLATFORM_PHOTO_MODEL = "heygen/photo-video";
export const PLATFORM_AVATAR_MODEL = "heygen/avatar";

export const PLATFORM_VIDEO_COST = computeCost({
  features: ["lipsync"],
  model: PLATFORM_VIDEO_MODEL,
}).total;

export const PLATFORM_PHOTO_COST = computeCost({
  features: ["lipsync"],
  model: PLATFORM_PHOTO_MODEL,
}).total;

export const PLATFORM_AVATAR_COST = computeCost({
  features: ["lipsync"],
  model: PLATFORM_AVATAR_MODEL,
}).total;

/** Cost in Aura for the given template kind — used by the UI. */
export function templateCost(kind: "photo" | "video" | "heygen-avatar"): number {
  if (kind === "photo") return PLATFORM_PHOTO_COST;
  if (kind === "heygen-avatar") return PLATFORM_AVATAR_COST;
  return PLATFORM_VIDEO_COST;
}

/** Total Aura to generate ALL platform templates (for "Generate All" button). */
export const GENERATE_ALL_COST = PLATFORM_TEMPLATES.reduce(
  (sum, t) => sum + templateCost(t.kind),
  0,
);

async function signPath(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from("studio")
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl)
    throw new Error(`sign failed: ${error?.message ?? "no url"}`);
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

export type TemplateGenerateResult =
  | { ok: true; generationId: string; url: string }
  | { ok: false; error: string; insufficient?: boolean };

export const generateFromPlatformTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        templateId: z.string().min(1),
        script: z.string().min(1).max(2000),
        voiceId: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<TemplateGenerateResult> => {
    const template = PLATFORM_TEMPLATES.find((t) => t.id === data.templateId);
    if (!template) throw new Error("Unknown template");

    // ── HeyGen avatar: no TTS needed — HeyGen handles speech internally ─────
    if (template.kind === "heygen-avatar") {
      if (!template.avatarId) throw new Error("Template missing avatarId");
      const outcome = await reserveOrchestrateRecord({
        userId: context.userId,
        kind: "lipsync",
        cost: PLATFORM_AVATAR_COST,
        reason: "platform_template_avatar",
        prompt: data.script,
        model: PLATFORM_AVATAR_MODEL,
        pinnedModelOnly: true,
        params: {
          avatarId: template.avatarId,
          voiceId: data.voiceId ?? template.voiceId ?? "m3Fp8hA8nS1Gc1Ne9FIf",
        },
      });
      if (!outcome.ok)
        return { ok: false, error: outcome.error, insufficient: outcome.insufficient };
      return { ok: true, generationId: outcome.generationId, url: outcome.url };
    }

    // ── Photo / video: TTS first, then sign asset URL ────────────────────────
    if (!template.storagePath) throw new Error("Template missing storagePath");
    const assetUrl = await signPath(template.storagePath, 3600);
    const tts = await hfTextToSpeech(UGC_TTS_MODEL, data.script);
    const audioUrl = await uploadAudioToStudio(context.userId, tts.bytes, tts.contentType);

    if (template.kind === "photo") {
      const outcome = await reserveOrchestrateRecord({
        userId: context.userId,
        kind: "lipsync",
        cost: PLATFORM_PHOTO_COST,
        reason: "platform_template_photo",
        prompt: data.script.slice(0, 200),
        model: PLATFORM_PHOTO_MODEL,
        pinnedModelOnly: true,
        imageUrls: [assetUrl],
        audioUrl,
      });
      if (!outcome.ok)
        return { ok: false, error: outcome.error, insufficient: outcome.insufficient };
      return { ok: true, generationId: outcome.generationId, url: outcome.url };
    }

    // kind === "video"
    const outcome = await reserveOrchestrateRecord({
      userId: context.userId,
      kind: "lipsync",
      cost: PLATFORM_VIDEO_COST,
      reason: "platform_template_video",
      prompt: data.script.slice(0, 200),
      model: PLATFORM_VIDEO_MODEL,
      pinnedModelOnly: true,
      videoUrl: assetUrl,
      audioUrl,
    });
    if (!outcome.ok)
      return { ok: false, error: outcome.error, insufficient: outcome.insufficient };
    return { ok: true, generationId: outcome.generationId, url: outcome.url };
  });
