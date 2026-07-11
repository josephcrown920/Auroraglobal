// Server functions for Platform Talking Avatar Templates.
//
// Two generation paths depending on template kind:
//   "video"  → sign video URL → TTS → sync/lipsync-2  (lipsync on the clip)
//   "photo"  → sign photo URL → TTS → heygen/photo-video  (animate the face)

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

export const PLATFORM_VIDEO_COST = computeCost({
  features: ["lipsync"],
  model: PLATFORM_VIDEO_MODEL,
}).total;

export const PLATFORM_PHOTO_COST = computeCost({
  features: ["lipsync"],
  model: PLATFORM_PHOTO_MODEL,
}).total;

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
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<TemplateGenerateResult> => {
    const template = PLATFORM_TEMPLATES.find((t) => t.id === data.templateId);
    if (!template) throw new Error("Unknown template");

    // Sign the asset URL so the provider can fetch it
    const assetUrl = await signPath(template.storagePath, 3600);

    // TTS → upload audio
    const tts = await hfTextToSpeech(UGC_TTS_MODEL, data.script);
    const audioUrl = await uploadAudioToStudio(
      context.userId,
      tts.bytes,
      tts.contentType,
    );

    if (template.kind === "photo") {
      // Photo template → HeyGen photo-video (face animation)
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
    } else {
      // Video template → sync.so lipsync-2 (mouth-sync on the clip)
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
    }
  });

/** Cost in Aura for a given template — used by the UI. */
export function templateCost(kind: "video" | "photo"): number {
  return kind === "photo" ? PLATFORM_PHOTO_COST : PLATFORM_VIDEO_COST;
}
