import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hfSpeechToText, hfTextToSpeech } from "./hf.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertTrustedUrl } from "./url-guard";
import { PRICING } from "./pricing";

type _Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpcAdmin = (name: string, args: Record<string, unknown>) =>
  (supabaseAdmin as unknown as { rpc: _Rpc }).rpc(name, args);

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
    assertTrustedUrl(data.videoUrl);
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
    const { text, chunks, language } = await hfSpeechToText(data.model, buf, { timestamps: true });
    const segments: CaptionSegment[] = (chunks ?? []).map((c) => ({
      start: c.start,
      end: c.end > c.start ? c.end : c.start + 3,
      text: c.text.trim(),
    })).filter((s) => s.text.length > 0);
    if (segments.length === 0 && text.trim()) {
      segments.push({ start: 0, end: 5, text: text.trim() });
    }
    return { text, segments, language: language ?? null };
  });

/**
 * Synthesize speech (Bark / SpeechT5). Reserves 20 Aura credits, runs HF
 * TTS, uploads the audio to the studio bucket as a signed URL (studio bucket
 * is private — getPublicUrl returns a 403), commits credits, and returns the
 * signed URL so the client can play and download the result.
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
    const cost = PRICING.base.audio;
    const ref = crypto.randomUUID();

    // Reserve credits upfront (same pattern as generate-core.server)
    const { data: reserved, error: resErr } = await rpcAdmin("reserve_credits", {
      _user: context.userId,
      _amount: cost,
      _reason: "speech_tts",
      _ref: ref,
    });
    if (resErr) throw new Error(resErr.message);
    if (!reserved) throw new Error("Insufficient credits");

    try {
      const { bytes, contentType } = await hfTextToSpeech(data.model, data.text);
      const ext = contentType.includes("flac") ? "flac" : contentType.includes("wav") ? "wav" : "mp3";
      const path = `tts/${context.userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("studio")
        .upload(path, new Uint8Array(bytes), { contentType, upsert: false });
      if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

      // Studio bucket is PRIVATE — getPublicUrl returns a non-working URL.
      // Use a 4-hour signed URL so the client can play and download the file.
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from("studio")
        .createSignedUrl(path, 4 * 60 * 60);
      if (signErr || !signed?.signedUrl) throw new Error("Could not create signed audio URL");
      const signedUrl = signed.signedUrl;

      // Atomically commit credits + record the generation in one transaction
      const { error: finalizeErr } = await rpcAdmin("finalize_sync_render", {
        _user_id: context.userId,
        _prompt: data.text,
        _kind: "audio",
        _mode: "performance",
        _input_images: [],
        _audio_url: signedUrl,
        _model: data.model,
        _result_image_url: null,
        _result_video_url: null,
        _result_text: null,
        _credits_cost: cost,
        _session_id: null,
        _agent_shot_id: null,
        _amount: cost,
        _reason: "speech_tts",
        _ref: ref,
      });
      if (finalizeErr) throw new Error(`Failed to commit credits: ${finalizeErr.message}`);

      return { url: signedUrl, contentType };
    } catch (e) {
      // Release the reservation so credits are returned on any failure.
      // Never swallow a release failure — that is a real credit leak.
      const { error: relErr } = await rpcAdmin("release_reservation", {
        _user: context.userId,
        _amount: cost,
        _reason: "release_speech_tts",
        _ref: ref,
      });
      if (relErr) {
        const original = e instanceof Error ? e.message : String(e);
        throw new Error(
          `${original}; additionally failed to release reservation ${ref}: ${relErr.message}`,
        );
      }
      throw e;
    }
  });
