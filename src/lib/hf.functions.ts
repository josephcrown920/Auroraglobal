import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hfSpeechToText, hfTextToSpeech } from "./hf.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Transcribe an audio file (Whisper). Accepts a base64-encoded blob.
 * Returns the transcript text.
 */
export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      base64: z.string().min(16).max(20_000_000),
      mime: z.string().max(64).optional(),
      model: z.string().max(120).default("openai/whisper-large-v3"),
      timestamps: z.boolean().default(false),
    }).parse
  )
  .handler(async ({ data }) => {
    const bin = atob(data.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const { text, chunks } = await hfSpeechToText(data.model, bytes.buffer, { timestamps: data.timestamps });
    return { text, chunks };
  });

/**
 * Synthesize speech (Bark / SpeechT5). Uploads the audio to the studio
 * bucket and returns a public URL.
 */
export const synthesizeSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      text: z.string().min(1).max(2000),
      model: z.string().max(120).default("suno/bark"),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { bytes, contentType } = await hfTextToSpeech(data.model, data.text);
    const ext = contentType.includes("flac") ? "flac" : contentType.includes("wav") ? "wav" : "mp3";
    const path = `tts/${context.userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("studio")
      .upload(path, new Uint8Array(bytes), { contentType, upsert: false });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);
    const { data: pub } = supabaseAdmin.storage.from("studio").getPublicUrl(path);
    return { url: pub.publicUrl, contentType };
  });
