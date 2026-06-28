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

const StartInput = z.object({
  sourceVideoUrl: z.string().url(),
  sourceImageUrl: z.string().url().optional(),
  count: z.number().int().min(1).max(10).default(10),
  basePrompt: z.string().max(500).optional(),
  duration: z.number().int().min(3).max(10).default(5),
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

async function generateConcepts(sourceVideoUrl: string, basePrompt: string, count: number): Promise<string[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return ANGLES.slice(0, count).map((a) => `${basePrompt}. ${a}`);
  }
  try {
    const sys = `You are a viral short-form video editor. Given a source video and an artist brief, produce ${count} unique TikTok cuts. Each cut should start from a different beat / angle / emotional hook in the source. Return ONLY a JSON array of ${count} strings, each a single concise camera+vibe prompt (under 160 chars). No prose, no markdown.`;
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
  return ANGLES.slice(0, count).map((a) => `${basePrompt}. ${a}`);
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
    const prompts = await generateConcepts(data.sourceVideoUrl, basePrompt, data.count);

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
          _amount: 5,
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