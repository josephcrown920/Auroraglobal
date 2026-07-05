import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reserveOrchestrateRecord } from "@/lib/generate-core.server";
import { computeCost } from "@/lib/pricing";
import { hfSpeechToText } from "@/lib/hf.server";
import { assertTrustedUrl } from "@/lib/url-guard";
import { hasActiveWorkerForKind } from "@/lib/orchestrator.server";

const CAPTION_COST = computeCost({ features: ["caption_burn"] }).total;
const LYRIC_VIDEO_COST = computeCost({ features: ["lyric_video"] }).total;

const SegmentSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string().max(500),
});

/**
 * Reserve 2 Aura, dispatch a `caption_burn` job to the GPU worker pool, and
 * record the resulting video as a new generation row. The GPU worker uses
 * FFmpeg `drawtext` to render each timed segment onto the video stream.
 *
 * Credit flow runs through `reserveOrchestrateRecord` (the project's single
 * billing path) so reserve/commit/release accounting never drifts.
 */
export const burnCaptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      videoUrl: z.string().url().max(2048),
      segments: z.array(SegmentSchema).min(1).max(500),
      /** Optional source generation to link the captioned output to. */
      sourceGenerationId: z.string().uuid().optional(),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const outcome = await reserveOrchestrateRecord({
      userId: context.userId,
      kind: "caption_burn",
      cost: CAPTION_COST,
      reason: "caption_burn",
      prompt: `Captions burned (${data.segments.length} segments)`,
      videoUrl: data.videoUrl,
      segments: data.segments,
      // No model pin: orchestrator picks ffmpeg-captionburn (GPU worker, fastest)
      // then falls back to zsxkib/add-subtitles-to-video (Replicate) if no
      // capable worker is online.
    });

    if (!outcome.ok) {
      return { ok: false as const, error: outcome.error, insufficient: outcome.insufficient };
    }

    return { ok: true as const, videoUrl: outcome.url, generationId: outcome.generationId };
  });

/**
 * One-call lyric video: transcribe the video's audio (Whisper) and burn the
 * resulting captions in immediately, without the caller round-tripping
 * through `transcribeVideoForCaptions` + a separate `burnCaptions` confirm
 * step. Still reserves the same 2 Aura via `reserveOrchestrateRecord` — this
 * is a convenience wrapper, not a new billing path.
 *
 * Returns the transcript segments alongside the result so callers that want
 * a review/edit step can still show one (re-burn via `burnCaptions` if the
 * user edits the auto-generated lines).
 */
export const generateLyricVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      videoUrl: z.string().url().max(2048),
      model: z.string().max(120).default("openai/whisper-large-v3"),
      sourceGenerationId: z.string().uuid().optional(),
    }).parse
  )
  .handler(async ({ data, context }) => {
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
    const segments = (chunks ?? [])
      .map((c) => ({
        start: c.start,
        end: c.end > c.start ? c.end : c.start + 3,
        text: c.text.trim(),
      }))
      .filter((s) => s.text.length > 0);
    if (segments.length === 0 && text.trim()) {
      segments.push({ start: 0, end: 5, text: text.trim() });
    }
    if (segments.length === 0) {
      return { ok: false as const, error: "No speech or lyrics detected in this video." };
    }

    const outcome = await reserveOrchestrateRecord({
      userId: context.userId,
      kind: "caption_burn",
      cost: CAPTION_COST,
      reason: "caption_burn",
      prompt: `Lyric video captions burned (${segments.length} lines)`,
      videoUrl: data.videoUrl,
      segments,
    });

    if (!outcome.ok) {
      return { ok: false as const, error: outcome.error, insufficient: outcome.insufficient };
    }

    return {
      ok: true as const,
      videoUrl: outcome.url,
      generationId: outcome.generationId,
      segments,
      language: language ?? null,
    };
  });

const LyricLineSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string().min(1).max(500),
});

/**
 * Lyric Video: synthesize a NEW video from an uploaded song + user-timed
 * lyric lines — a generated background with the lines burned in via the GPU
 * worker's FFmpeg pipeline, muxed with the song. Distinct from
 * `generateLyricVideo` above (which transcribes an EXISTING video's dialogue
 * and burns it back onto that same video); this has no source video at all.
 *
 * Self-hosted GPU worker ONLY — preflighted with `hasActiveWorkerForKind`
 * before any Aura is reserved (no hosted provider does audio+lyrics-in /
 * synced-video-out, so there is no fallback to fail into). Billed under its
 * own `lyric_video` pricing entry, never `caption_burn`.
 */
export const generateLyricVideoFromSong = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      audioUrl: z.string().url().max(2048),
      lines: z.array(LyricLineSchema).min(1).max(500),
      style: z.string().max(60).optional(),
    }).parse
  )
  .handler(async ({ data, context }) => {
    assertTrustedUrl(data.audioUrl);

    if (!(await hasActiveWorkerForKind("lyric_video"))) {
      return {
        ok: false as const,
        error: "No rendering worker is online right now — start your GPU worker and try again.",
      };
    }

    const outcome = await reserveOrchestrateRecord({
      userId: context.userId,
      kind: "lyric_video",
      cost: LYRIC_VIDEO_COST,
      reason: "lyric_video",
      prompt: `Lyric video (${data.lines.length} lines)${data.style ? `, ${data.style} style` : ""}`,
      audioUrl: data.audioUrl,
      segments: data.lines,
      params: data.style ? { style: data.style } : undefined,
    });

    if (!outcome.ok) {
      return { ok: false as const, error: outcome.error, insufficient: outcome.insufficient };
    }

    return { ok: true as const, videoUrl: outcome.url, generationId: outcome.generationId };
  });
