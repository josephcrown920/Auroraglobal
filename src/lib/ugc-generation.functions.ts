import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { COST_UGC_AD } from "@/lib/ugc.server";

/**
 * UGC ad generation — turn an avatar + scene + product into a native talking ad.
 *
 * The full pipeline (script → voice → still → image-to-video → lip-sync) runs
 * asynchronously on the public.jobs queue (kind "ugc_ad", see runUGCAd in
 * jobs.server.ts), reusing the orchestrator and lip-sync stages. This server fn
 * just reserves credits and enqueues the job; clients poll getGenerationStatus.
 *
 * Graceful degradation is explicit: without an LLM key the script falls back to
 * a template, and without TTS the voice + lip-sync stages are skipped, yielding
 * a silent animated clip. The full talking ad is produced when all keys exist.
 */

const UGCAdSchema = z.object({
  avatarImageUrl: z.string().url(),
  avatarName: z.string().max(80).optional(),
  vibe: z.string().max(200).optional(),
  presetHint: z.string().max(600).optional(),
  presetName: z.string().max(120).optional(),
  productPrompt: z.string().min(2).max(1000),
  aspect: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("9:16"),
  duration: z.number().int().min(3).max(12).default(8),
  voiceModel: z.string().max(120).optional(),
});

function rpcClient() {
  return supabaseAdmin as unknown as {
    rpc: (
      n: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

export const generateUGCAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UGCAdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const payload = {
      avatarImageUrl: data.avatarImageUrl,
      avatarName: data.avatarName,
      vibe: data.vibe,
      sceneHint: data.presetHint,
      sceneName: data.presetName,
      productPrompt: data.productPrompt,
      aspect: data.aspect,
      duration: data.duration,
      voiceModel: data.voiceModel,
    };
    const prompt = `UGC ad: ${data.productPrompt}${data.avatarName ? ` — ${data.avatarName}` : ""}`;

    const { data: rows, error } = await rpcClient().rpc("create_generation_and_reserve", {
      _user: userId,
      _kind: "ugc_ad",
      _prompt: prompt,
      _amount: COST_UGC_AD,
      _payload: payload,
    });
    if (error) {
      throw new Error(/insufficient_credits/i.test(error.message) ? "Not enough Aura" : error.message);
    }
    const row = (Array.isArray(rows) ? rows[0] : rows) as { job_id: string; generation_id: string };
    return {
      jobId: row.job_id,
      generationId: row.generation_id,
      status: "queued" as const,
      credits: COST_UGC_AD,
    };
  });

const StatusSchema = z.object({ generationId: z.string().uuid() });

/** Poll a generation row the caller owns (RLS-scoped) for async UGC jobs. */
export const getGenerationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: gen, error } = await supabase
      .from("generations")
      .select("id, status, result_image_url, result_video_url, error, kind")
      .eq("id", data.generationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!gen) throw new Error("Generation not found");
    return {
      id: gen.id,
      status: gen.status,
      imageUrl: gen.result_image_url ?? null,
      videoUrl: gen.result_video_url ?? null,
      error: gen.error ?? null,
      kind: gen.kind,
    };
  });
