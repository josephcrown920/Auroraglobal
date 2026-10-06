import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { COST_UGC_AD } from "@/lib/ugc.server";
import { COST_PRODUCT_DEMO } from "@/lib/pricing";
import { assertOwnedReferenceImage, assertOwnStudioUpload } from "@/lib/url-guard";

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
  /** Exact creator copy supplied by a script-writing surface. When present the
   * worker must speak this verbatim rather than asking the UGC scriptwriter to
   * generate a replacement. */
  scriptOverride: z.string().min(2).max(6000).optional(),
  /** Short, post-ready caption burned into the final clip by the established
   * caption_burn renderer. */
  captionText: z.string().min(1).max(500).optional(),
  aspect: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("9:16"),
  // Content Line authors 15/30/45s briefs. Long authored scripts are rendered
  // as ordered 15-second talking-head scenes and locally assembled by the
  // existing UGC worker rather than being silently squeezed into one short clip.
  duration: z.number().int().min(3).max(45).default(8),
  voiceModel: z.string().max(120).optional(),
  /** The character's own voice track. When set it always drives the final
   *  lip-sync — no generated/TTS voice is ever shipped in its place. */
  audioUrl: z.string().url().optional(),
});

function rpcClient() {
  return supabaseAdmin as unknown as {
    rpc: (
      n: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

// Internal canonical dispatch — shared by the generateUGCAd handler AND the
// admin smoke step so the two can never drift on the reserve/enqueue contract.
// The character-image ownership guard lives HERE (not in the handler) so every
// caller — server fn, smoke runner, or any future internal path — enforces it
// BEFORE any credits are reserved, matching _enqueuePerformanceShot.
export async function _enqueueUGCAd(
  userId: string,
  data: z.infer<typeof UGCAdSchema>,
): Promise<{ jobId: string; generationId: string; status: "queued"; credits: number }> {
  await assertOwnedReferenceImage(data.avatarImageUrl, userId);
  // The voice track flows into provider/worker-side fetches at render time, so
  // it gets the same SSRF + ownership discipline as the character image — the
  // caller's own studio upload only — checked BEFORE any credits are reserved.
  if (data.audioUrl) assertOwnStudioUpload(data.audioUrl, userId);

  const payload = {
      avatarImageUrl: data.avatarImageUrl,
      avatarName: data.avatarName,
      vibe: data.vibe,
      sceneHint: data.presetHint,
      sceneName: data.presetName,
      productPrompt: data.productPrompt,
      scriptOverride: data.scriptOverride,
      captionText: data.captionText,
      aspect: data.aspect,
      duration: data.duration,
      voiceModel: data.voiceModel,
      audioUrl: data.audioUrl,
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
}

// Enqueue-only: reserves credits + creates the job/generation row atomically,
// then returns immediately. The jobs/tick worker renders runUGCAd
// independently of this request; the client polls getGenerationStatus.
export const generateUGCAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UGCAdSchema.parse(d))
  .handler(async ({ data, context }) => _enqueueUGCAd(context.userId, data));

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

/**
 * Product Demo (Task #276) — product name + ordered feature list (name,
 * description, screenshot) → a narrated HeyGen avatar walkthrough.
 *
 * Runs on the same public.jobs queue as the UGC ad pipeline (kind
 * "product_demo", see runProductDemo in jobs.server.ts), reusing credit
 * reservation + polling conventions; clients poll with getGenerationStatus.
 */
const ProductDemoFeatureSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(400).optional(),
  screenshotUrl: z.string().url().optional(),
});

const ProductDemoSchema = z.object({
  productName: z.string().min(1).max(160),
  features: z.array(ProductDemoFeatureSchema).min(1).max(8),
  durationPresetId: z.enum(["quick", "walkthrough", "deep_dive", "whats_new"]).default("walkthrough"),
  audience: z.string().max(200).optional(),
  avatarId: z.string().max(80).optional(),
  voiceId: z.string().max(80).optional(),
  backgroundId: z.string().max(80).optional(),
});

// Internal canonical dispatch — shared by the generateProductDemo handler AND
// the admin smoke step so the two can never drift on the reserve/enqueue
// contract (same convention as _enqueueUGCAd / _enqueuePerformanceShot).
export async function _enqueueProductDemo(
  userId: string,
  data: z.infer<typeof ProductDemoSchema>,
): Promise<{ jobId: string; generationId: string; status: "queued"; credits: number }> {
  const payload = {
    productName: data.productName,
    features: data.features,
    durationPresetId: data.durationPresetId,
    audience: data.audience,
    avatarId: data.avatarId,
    voiceId: data.voiceId,
    backgroundId: data.backgroundId,
  };
  const prompt = `Product demo: ${data.productName} (${data.features.length} feature${data.features.length === 1 ? "" : "s"})`;

  const { data: rows, error } = await rpcClient().rpc("create_generation_and_reserve", {
    _user: userId,
    _kind: "product_demo",
    _prompt: prompt,
    _amount: COST_PRODUCT_DEMO,
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
    credits: COST_PRODUCT_DEMO,
  };
}

export const generateProductDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProductDemoSchema.parse(d))
  .handler(async ({ data, context }) => _enqueueProductDemo(context.userId, data));
