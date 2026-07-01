import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reserveOrchestrateRecord } from "@/lib/generate-core.server";
import { computeCost } from "@/lib/pricing";

const CAPTION_COST = computeCost({ features: ["caption_burn"] }).total;

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
      model: "ffmpeg-captionburn",
    });

    if (!outcome.ok) {
      return { ok: false as const, error: outcome.error, insufficient: outcome.insufficient };
    }

    return { ok: true as const, videoUrl: outcome.url, generationId: outcome.generationId };
  });
