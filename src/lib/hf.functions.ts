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

export type CaptionSegment = { start: number; end: number; text: string };

/**
 * Transcribe a video (or audio) URL via Whisper and return timed caption
 * segments. The server fetches the video bytes (up to 50 MB) and sends them
 * to the Whisper model so the client never proxies large binary files.
 */
export const transcribeVideoForCaptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      videoUrl: z.string().url().max(2048),
      model: z.string().max(120).default("openai/whisper-large-v3"),
    }).parse
  )
  .handler(async ({ data }) => {
    const res = await fetch(data.videoUrl, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`Fetch video failed: ${res.status}`);
    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > 50 * 1024 * 1024) {
      throw new Error("Video is too large to transcribe (max 50 MB)");
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 50 * 1024 * 1024) {
      throw new Error("Video is too large to transcribe (max 50 MB)");
    }
    const { text, chunks } = await hfSpeechToText(data.model, buf, { timestamps: true });
    const segments: CaptionSegment[] = (chunks ?? []).map((c) => ({
      start: c.start,
      end: c.end > c.start ? c.end : c.start + 3,
      text: c.text.trim(),
    })).filter((s) => s.text.length > 0);
    if (segments.length === 0 && text.trim()) {
      segments.push({ start: 0, end: 5, text: text.trim() });
    }
    return { text, segments };
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
