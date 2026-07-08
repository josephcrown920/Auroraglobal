// TikTok Remix Factory.
// Take a single source video → generate up to 10 variant short clips, each
// starting from a different highlight / angle / hook. Each variant becomes
// its own queued job so they process in parallel and credits are atomically
// reserved per child.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertTrustedUrl } from "./url-guard";
import { COST_TIKTOK_REMIX_CUT } from "./pricing";

// Cut styles bias the generated concepts toward a themed look. "auto" keeps the
// original behavior (distinct hooks pulled from the source).
export const CUT_STYLES = ["auto", "urban_cut", "grwm"] as const;
export type CutStyle = (typeof CUT_STYLES)[number];

// Exported for unit tests: the server-side cut cap (count.max(10)) is the real
// safeguard against a client bypassing the UI slider and over-reserving Aura.
export const StartInput = z.object({
  sourceVideoUrl: z.string().url(),
  sourceImageUrl: z.string().url().optional(),
  count: z.number().int().min(1).max(10).default(10),
  basePrompt: z.string().max(500).optional(),
  duration: z.number().int().min(3).max(10).default(5),
  style: z.enum(CUT_STYLES).default("auto"),
});

// Curated angle prompts — used when Gemini concept generation isn't available
// or as a deterministic fallback. Each angle is short and TikTok-native.
const ANGLES = [
  "punchy hook cold-open, fast cut, vertical 9:16, neon rim light",
  "slow motion reveal, dramatic push-in, cinematic color grade",
  "close-up face beat-drop reaction, shallow depth",
  "wide angle full-body energy shot, strobing lights",
  "POV behind-the-shoulder walk-in shot",
  "low angle hero pose, lens flare, golden hour",
  "overhead 90° flat-lay style choreography",
  "split-second freeze-frame text overlay moment",
  "VHS retro tape glitch transition",
  "anime-style motion blur whip pan",
  "subway / urban backdrop street energy",
  "studio cyc backdrop with magenta + cyan key lights",
  "rooftop sunset silhouette",
  "intimate handheld confessional",
  "extreme close-up eyes, then pull-back reveal",
  "rotating orbit camera one full lap",
  "smoke-machine fog ambient shot",
  "neon arcade backlight bath",
  "bokeh city lights night drive vibe",
  "kinetic typography sync to beat",
  "pulsing speaker bass-drop visualizer",
  "shadow-only silhouette dance",
  "rain-soaked street reflection",
  "vintage film grain warm tones",
  "high-contrast B&W noir feel",
  "underwater shimmer light caustics",
  "first-person mirror confidence check",
  "garage / loft moody warehouse",
  "lookbook outfit reveal turn",
  "trophy / award celebratory ending",
];

// Urban Cut: a beat-synced luxury fashion showcase. Runway/model energy, anywhere
// (indoor or outdoor), outfit-forward, camera angles auto-switching to the beat.
const URBAN_CUT_ANGLES = [
  "beat-drop outfit reveal, full-body runway strut toward camera, vertical 9:16, luxury energy",
  "low-angle hero walk, slow-motion on the beat, cinematic anamorphic grade",
  "360° orbit around the subject mid-pose, designer outfit razor-sharp in focus",
  "snap-zoom to the shoes then whip-pan up to the face on the beat",
  "rooftop skyline runway at golden hour, warm rim light, confident stride",
  "marble lobby luxury interior, polished floor reflection, editorial power pose",
  "macro fabric detail then quick pull-back to the full look, shallow depth",
  "neon street at night, wet asphalt reflections, slow strut with attitude",
  "leaning on a luxury car in a concrete garage, anamorphic lens flare",
  "high-fashion freeze-frame on the beat, crisp outfit silhouette, hard key light",
  "side-profile catwalk pass, motion-blur background, runway-but-everywhere",
  "overhead crane shot looking down on the strut, long dramatic shadows",
];

// Get Ready With Me: the classic getting-ready arc — mirror checks, outfit
// selection, styling, finishing touches, building to the finished-look reveal.
const GRWM_ANGLES = [
  "mirror cold-open, 'get ready with me' caption energy, vertical 9:16, soft daylight",
  "overhead 90° flat-lay of outfit options laid out on the bed",
  "holding two outfits up to the mirror, deciding which to wear",
  "close-up styling detail — accessories and jewelry finishing touches",
  "hair and styling moment at the vanity, soft warm lighting, intimate handheld",
  "slipping into the chosen outfit, mirror reflection, natural window light",
  "adjusting the fit in the mirror, confidence check, slow half-turn",
  "spritz and final finishing-touch beat before heading out",
  "full-look reveal turn in the mirror, polished and camera-ready",
  "walking out the door with the finished look, golden hour, satisfied smile",
  "vanity desk product flat-lay, cozy getting-ready ambiance",
  "before-to-after styling montage, coherent transformation arc",
];

// Pick the deterministic fallback pool for a style. Exported for unit tests so
// the style-biasing contract (distinct, count-bounded, style-specific) is pinned.
export function anglesForStyle(style: CutStyle): string[] {
  if (style === "urban_cut") return URBAN_CUT_ANGLES;
  if (style === "grwm") return GRWM_ANGLES;
  return ANGLES;
}

// Deterministic, style-specific concept prompts used whenever the AI path is
// unavailable (no API key, gateway down, non-200, or malformed JSON). Exported
// for unit tests so the "fallback honors the chosen style" contract is pinned.
export function styledFallback(basePrompt: string, count: number, style: CutStyle = "auto"): string[] {
  return anglesForStyle(style)
    .slice(0, count)
    .map((a) => `${basePrompt}. ${a}`);
}

// Extra direction appended to the AI system prompt so the model biases its cuts
// toward the chosen style. "auto" adds nothing (original behavior).
function styleDirective(style: CutStyle): string {
  if (style === "urban_cut") {
    return " STYLE — Urban Cut: every cut is a beat-synced luxury fashion showcase. Show the subject in outfits with runway/model energy, anywhere (indoor or outdoor). Switch camera angle and location between cuts and change shots on the beat. Outfit-forward, cinematic, high-fashion, varied multi-angle coverage.";
  }
  if (style === "grwm") {
    return " STYLE — Get Ready With Me: the cuts form one coherent getting-ready arc. Progress through mirror checks, outfit selection, styling, and finishing touches, building to the finished-look reveal. Keep the sequence in get-ready order.";
  }
  return "";
}

export async function generateConcepts(
  sourceVideoUrl: string,
  basePrompt: string,
  count: number,
  style: CutStyle = "auto",
): Promise<string[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return styledFallback(basePrompt, count, style);
  }
  try {
    const sys = `You are a viral short-form video editor. Given a source video and an artist brief, produce ${count} unique TikTok cuts. Each cut should start from a different beat / angle / emotional hook in the source. Return ONLY a JSON array of ${count} strings, each a single concise camera+vibe prompt (under 160 chars). No prose, no markdown.${styleDirective(style)}`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: [
              { type: "text", text: `Brief: ${basePrompt}\nReference: ${sourceVideoUrl}\nReturn ${count} distinct cuts.` },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`gemini ${res.status}`);
    const j = await res.json();
    const raw: string = j?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```json\s*|\s*```$/gi, "").trim();
    const arr = JSON.parse(cleaned);
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.slice(0, count).map((s: unknown) => String(s));
    }
  } catch {
    /* fall through to deterministic angles */
  }
  return styledFallback(basePrompt, count, style);
}

export const startTiktokRemix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StartInput.parse(d))
  .handler(async ({ data, context }) => {
    assertTrustedUrl(data.sourceVideoUrl);
    if (data.sourceImageUrl) assertTrustedUrl(data.sourceImageUrl);
    const userId = context.userId;
    const basePrompt = data.basePrompt?.trim() || "viral TikTok cut, vertical 9:16, sharp, high energy";

    // Concept generation
    const prompts = await generateConcepts(data.sourceVideoUrl, basePrompt, data.count, data.style);

    // Create parent remix row
    const { data: remixRow, error: remixErr } = await supabaseAdmin
      .from("tiktok_remixes")
      .insert({
        user_id: userId,
        source_video_url: data.sourceVideoUrl,
        target_count: data.count,
        status: "processing",
        prompt: basePrompt,
      } as never)
      .select("id")
      .single();
    if (remixErr || !remixRow) throw new Error(remixErr?.message || "Failed to create remix");
    const remixId = (remixRow as { id: string }).id;

    // Enqueue one job per concept — each atomically reserves credits.
    const client = supabaseAdmin as unknown as {
      rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const jobIds: string[] = [];
    const failed: Array<{ index: number; error: string }> = [];
    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      try {
        const { data: out, error } = await client.rpc("create_generation_and_reserve", {
          _user: userId,
          _kind: "tiktok_remix_child",
          _prompt: prompt,
          _amount: COST_TIKTOK_REMIX_CUT,
          _payload: {
            kind: "video",
            prompt,
            sourceVideoUrl: data.sourceVideoUrl,
            sourceImageUrl: data.sourceImageUrl,
            duration: data.duration,
            remixId,
            index: i,
          },
        });
        if (error) throw new Error(error.message);
        const row = Array.isArray(out) ? out[0] : out;
        jobIds.push((row as { job_id: string }).job_id);
      } catch (e) {
        failed.push({ index: i, error: e instanceof Error ? e.message : String(e) });
        // Out of credits: stop enqueuing the rest rather than spamming failures.
        if (/insufficient_credits/i.test(e instanceof Error ? e.message : "")) break;
      }
    }

    await supabaseAdmin
      .from("tiktok_remixes")
      .update({
        child_job_ids: jobIds,
        status: jobIds.length > 0 ? "processing" : "failed",
        error: failed.length ? `Could only enqueue ${jobIds.length}/${prompts.length}: ${failed[0]?.error}` : null,
      } as never)
      .eq("id", remixId);

    return { remixId, enqueued: jobIds.length, requested: prompts.length, failed };
  });

/**
 * Retries a single failed cut within a remix batch, without re-charging or
 * re-enqueuing the other cuts. Reserves credits for exactly one new job,
 * swaps its id in for the old failed job id, and leaves the rest untouched.
 */
export const retryTiktokRemixChild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ remixId: z.string().uuid(), failedJobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const { data: remix, error: remixErr } = await supabaseAdmin
      .from("tiktok_remixes")
      .select("*")
      .eq("id", data.remixId)
      .eq("user_id", userId)
      .maybeSingle();
    if (remixErr || !remix) throw new Error(remixErr?.message || "Remix not found");

    const failedJob = await supabaseAdmin
      .from("jobs")
      .select("id, payload")
      .eq("id", data.failedJobId)
      .eq("user_id", userId)
      .maybeSingle();
    if (failedJob.error || !failedJob.data) throw new Error(failedJob.error?.message || "Job not found");
    const payload = (failedJob.data as { payload: Record<string, unknown> | null }).payload ?? {};
    const prompt = typeof payload.prompt === "string" ? payload.prompt : "viral TikTok cut, vertical 9:16, sharp, high energy";

    const client = supabaseAdmin as unknown as {
      rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: out, error } = await client.rpc("create_generation_and_reserve", {
      _user: userId,
      _kind: "tiktok_remix_child",
      _prompt: prompt,
      _amount: COST_TIKTOK_REMIX_CUT,
      _payload: { ...payload, remixId: data.remixId, retryOf: data.failedJobId },
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(out) ? out[0] : out;
    const newJobId = (row as { job_id: string }).job_id;

    const jobIds = Array.isArray((remix as { child_job_ids: unknown }).child_job_ids)
      ? [...((remix as { child_job_ids: string[] }).child_job_ids)]
      : [];
    const idx = jobIds.indexOf(data.failedJobId);
    if (idx >= 0) jobIds[idx] = newJobId;
    else jobIds.push(newJobId);

    await supabaseAdmin
      .from("tiktok_remixes")
      .update({ child_job_ids: jobIds, status: "processing" } as never)
      .eq("id", data.remixId);

    return { newJobId };
  });

export const listTiktokRemixes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("tiktok_remixes")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data;
  });

export const getTiktokRemix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: remix, error } = await supabaseAdmin
      .from("tiktok_remixes")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !remix) throw new Error(error?.message || "Not found");

    const childIds = Array.isArray((remix as { child_generation_ids: unknown }).child_generation_ids)
      ? ((remix as { child_generation_ids: string[] }).child_generation_ids)
      : [];
    const jobIds = Array.isArray((remix as { child_job_ids: unknown }).child_job_ids)
      ? ((remix as { child_job_ids: string[] }).child_job_ids)
      : [];

    type GenSummary = { id: string; status: string; result_video_url: string | null; prompt: string; error: string | null };
    type JobSummary = { id: string; status: string; attempts: number; error: string | null; generation_id: string | null; result: Record<string, unknown> | null };
    const [gensRes, jobsRes] = await Promise.all([
      childIds.length
        ? supabaseAdmin.from("generations").select("id, status, result_video_url, prompt, error").in("id", childIds)
        : Promise.resolve({ data: [] as GenSummary[], error: null }),
      jobIds.length
        ? supabaseAdmin.from("jobs").select("id, status, attempts, error, generation_id, result").in("id", jobIds)
        : Promise.resolve({ data: [] as JobSummary[], error: null }),
    ]);

    // Round-trip through JSON to guarantee TanStack's serializable check passes
    // (Json columns surface as `unknown` after typegen).
    type RemixRow = {
      id: string; user_id: string; source_video_url: string; target_count: number;
      status: string; prompt: string | null; error: string | null;
      child_generation_ids: string[]; child_job_ids: string[]; created_at: string; updated_at: string;
    };
    type JobSer = { id: string; status: string; attempts: number; error: string | null; generation_id: string | null; result: Record<string, string> | null };
    const payload = JSON.parse(JSON.stringify({
      remix,
      generations: gensRes.data ?? [],
      jobs: jobsRes.data ?? [],
    })) as { remix: RemixRow; generations: GenSummary[]; jobs: JobSer[] };
    return payload;
  });