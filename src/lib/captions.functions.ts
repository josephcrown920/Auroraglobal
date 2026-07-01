import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { orchestrate } from "@/lib/orchestrator.server";
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
    const userId = context.userId;
    const reservationRef = crypto.randomUUID();
    let reservedAmount = 0;

    const client = supabaseAdmin as unknown as {
      rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };

    async function rpc(name: string, args: Record<string, unknown>) {
      const { data: d, error } = await client.rpc(name, args);
      if (error) throw new Error(error.message);
      return d;
    }

    try {
      const reserved = await rpc("reserve_credits", {
        _user: userId,
        _amount: CAPTION_COST,
        _reason: "caption_burn",
        _ref: reservationRef,
      });
      if (!reserved) {
        return { ok: false as const, error: "Insufficient credits", insufficient: true };
      }
      reservedAmount = CAPTION_COST;

      const result = await orchestrate({
        kind: "caption_burn",
        videoUrl: data.videoUrl,
        segments: data.segments,
        userId,
        refId: reservationRef,
        selfHostedOnly: true,
      });

      const { data: gen, error: genErr } = await supabaseAdmin
        .from("generations")
        .insert({
          user_id: userId,
          prompt: `Captions burned (${data.segments.length} segments)`,
          kind: "video",
          mode: "performance",
          status: "succeeded",
          input_images: [],
          model: result.provider,
          result_video_url: result.url,
          credits_cost: CAPTION_COST,
          audio_url: null,
          result_image_url: null,
          result_text: null,
          session_id: null,
          agent_shot_id: null,
        } as never)
        .select("id")
        .single();
      if (genErr) throw new Error(genErr.message);

      await rpc("commit_reservation", {
        _user: userId,
        _amount: reservedAmount,
        _reason: "caption_burn",
        _ref: reservationRef,
      });
      reservedAmount = 0;

      return { ok: true as const, videoUrl: result.url, generationId: gen.id };
    } catch (e) {
      if (reservedAmount > 0) {
        await rpc("release_reservation", {
          _user: userId,
          _amount: reservedAmount,
          _reason: "release_caption_burn",
          _ref: reservationRef,
        }).catch(() => null);
      }
      throw e;
    }
  });
