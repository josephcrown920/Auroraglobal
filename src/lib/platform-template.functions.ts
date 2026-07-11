// Server functions for Platform Talking Avatar Templates.
//
// Generation flow:
//   1. Sign the platform template video URL (1-hour TTL for lipsync provider)
//   2. Generate TTS audio from the user's script (HuggingFace MMS-TTS)
//   3. Upload the audio to studio bucket → sign it
//   4. Reserve credits + dispatch lipsync via sync.so (sync/lipsync-2)

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { reserveOrchestrateRecord } from "@/lib/generate-core.server";
import { computeCost } from "@/lib/pricing";
import { hfTextToSpeech } from "@/lib/hf.server";
import { UGC_TTS_MODEL } from "@/lib/ugc.server";
import { PLATFORM_TEMPLATES } from "@/lib/platform-templates";

export const PLATFORM_TEMPLATE_MODEL = "sync/lipsync-2";
export const PLATFORM_TEMPLATE_COST = computeCost({
  features: ["lipsync"],
  model: PLATFORM_TEMPLATE_MODEL,
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

    // 1. Sign the platform template video so the lipsync provider can fetch it
    const videoUrl = await signPath(template.storagePath, 3600);

    // 2. TTS → audio
    const tts = await hfTextToSpeech(UGC_TTS_MODEL, data.script);
    const audioUrl = await uploadAudioToStudio(
      context.userId,
      tts.bytes,
      tts.contentType,
    );

    // 3. Reserve credits + dispatch via sync/lipsync-2
    const outcome = await reserveOrchestrateRecord({
      userId: context.userId,
      kind: "lipsync",
      cost: PLATFORM_TEMPLATE_COST,
      reason: "platform_template_video",
      prompt: data.script.slice(0, 200),
      model: PLATFORM_TEMPLATE_MODEL,
      pinnedModelOnly: true,
      videoUrl,
      audioUrl,
    });

    if (!outcome.ok) {
      return {
        ok: false,
        error: outcome.error,
        insufficient: outcome.insufficient,
      };
    }
    return { ok: true, generationId: outcome.generationId, url: outcome.url };
  });
