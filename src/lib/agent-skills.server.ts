// Video Agent Skill System — server-side skill registry and dispatch.
// Each skill is a discrete capability the agent chat loop can invoke mid-turn.
// Skills return a { summary, data } result that is injected back into the LLM
// context so the agent can compose a final, data-enriched reply.
import { generateWithFallback } from "@/lib/llm-fallback.server";
import { z } from "zod";
import type { BrandMemory, SkillName } from "@/lib/agent.schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface SkillContext {
  userId: string;
  supabase: SupabaseClient<Database>;
}

export interface SkillResult {
  ok: boolean;
  /** Short label shown in the UI skill chip (e.g. "Searched: TikTok hooks 2026") */
  summary: string;
  /** Full structured data injected into the second LLM pass */
  data: Record<string, unknown>;
  error?: string;
}

// ─── web_search ──────────────────────────────────────────────────────────────

async function webSearch(args: unknown, _ctx: SkillContext): Promise<SkillResult> {
  const { query } = z.object({ query: z.string().min(1).max(400) }).parse(args);
  try {
    // DuckDuckGo Instant Answer API — free, no key required.
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&kl=wt-wt`;
    const res = await fetch(url, { headers: { "User-Agent": "AuroraAgent/1.0" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Search API ${res.status}`);
    const json = await res.json() as {
      AbstractText?: string;
      AbstractSource?: string;
      AbstractURL?: string;
      RelatedTopics?: { Text?: string; FirstURL?: string }[];
    };

    const bullets: string[] = [];
    if (json.AbstractText?.trim()) bullets.push(json.AbstractText.trim());
    const related = (json.RelatedTopics ?? [])
      .filter((t) => t.Text)
      .slice(0, 5)
      .map((t) => t.Text!.trim());
    bullets.push(...related);

    if (bullets.length === 0) {
      // Fallback: use LLM knowledge to synthesize an answer
      const { output } = await generateWithFallback({
        system: "You are a research assistant. Summarize what you know about the topic in 3-5 factual bullets.",
        prompt: `Topic: ${query}\n\nReturn 3-5 bullet points of relevant facts.`,
        schema: z.object({ bullets: z.array(z.string()).min(1).max(8) }),
      });
      bullets.push(...(output as { bullets: string[] }).bullets);
    }

    return {
      ok: true,
      summary: `Searched: "${query.slice(0, 50)}"`,
      data: { query, bullets, source: json.AbstractSource ?? "web" },
    };
  } catch (e) {
    return { ok: false, summary: "Search failed", data: {}, error: e instanceof Error ? e.message : "Search error" };
  }
}

// ─── scrape_url ──────────────────────────────────────────────────────────────

async function scrapeUrl(args: unknown, _ctx: SkillContext): Promise<SkillResult> {
  const { url } = z.object({ url: z.string().url() }).parse(args);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AuroraAgent/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    // Strip HTML tags and collapse whitespace for a plain-text extract.
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 3000);

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    // Use LLM to extract structured brand info from the raw text
    const { output } = await generateWithFallback({
      system: "You extract brand/product info from webpage text. Return headline, features list (max 5 bullets), and CTA copy.",
      prompt: `PAGE TITLE: ${title}\n\nPAGE TEXT:\n${text}\n\nExtract the key info now.`,
      schema: z.object({
        headline: z.string(),
        features: z.array(z.string()).max(5),
        cta: z.string(),
      }),
    });

    return {
      ok: true,
      summary: `Scraped: ${title.slice(0, 50)}`,
      data: { url, title, ...(output as { headline: string; features: string[]; cta: string }) },
    };
  } catch (e) {
    return { ok: false, summary: "Scrape failed", data: {}, error: e instanceof Error ? e.message : "Scrape error" };
  }
}

// ─── generate_hooks ──────────────────────────────────────────────────────────

const HookSchema = z.object({
  hooks: z
    .array(
      z.object({
        hook: z.string().describe("The opening hook line, 1-2 sentences max"),
        score: z.number().min(0).max(100).describe("Quality score 0-100"),
        rationale: z.string().describe("One-sentence reason for the score"),
        style: z.string().describe("e.g. Question, Bold Claim, Story Opener, Shock Stat"),
      }),
    )
    .length(3),
});

async function generateHooks(args: unknown, _ctx: SkillContext): Promise<SkillResult> {
  const { topic, platform } = z
    .object({
      topic: z.string().min(1).max(300),
      platform: z.enum(["tiktok", "instagram", "youtube_shorts"]).default("tiktok"),
    })
    .parse(args);

  const platformHints: Record<string, string> = {
    tiktok: "TikTok (fast, pattern-interrupt, 3-5 words before the hook hits, Gen Z energy)",
    instagram: "Instagram Reels (aspirational, visual-forward, slightly longer is OK)",
    youtube_shorts: "YouTube Shorts (curiosity gap, search-friendly, slightly more context OK)",
  };

  const { output } = await generateWithFallback({
    system: `You are a viral video hook specialist. Generate 3 competing opening hooks for ${platformHints[platform] ?? platform}. Each hook must stop the scroll in the first 1.5 seconds. Score each 0-100 and explain why.`,
    prompt: `TOPIC: ${topic}\n\nGenerate exactly 3 competing hooks now. Vary the style (e.g., question vs. bold claim vs. story opener). Score each and give one-line rationale.`,
    schema: HookSchema,
  });

  const hooks = (output as z.infer<typeof HookSchema>).hooks;
  const ranked = [...hooks].sort((a, b) => b.score - a.score);
  const best = ranked[0];

  return {
    ok: true,
    summary: `Generated 3 hooks for "${topic.slice(0, 35)}"`,
    data: { topic, platform, hooks: ranked, topHook: best.hook, topScore: best.score },
  };
}

// ─── generate_broll ──────────────────────────────────────────────────────────

async function generateBroll(args: unknown, ctx: SkillContext): Promise<SkillResult> {
  const { shot_description } = z.object({ shot_description: z.string().min(5).max(500) }).parse(args);

  // Enrich the shot description with cinematic vocabulary
  const { output: enriched } = await generateWithFallback({
    system: "You are a cinematographer. Expand a shot description into a full, render-ready image prompt with lens, lighting, texture, camera movement, and color science. ~80-120 words. Plain text only.",
    prompt: `Shot: ${shot_description}\n\nWrite the full cinematic image prompt now.`,
    schema: z.object({ prompt: z.string().min(20).max(600) }),
  });

  const richPrompt = (enriched as { prompt: string }).prompt;

  const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");
  const { PRICING } = await import("@/lib/pricing");
  const outcome = await reserveOrchestrateRecord({
    userId: ctx.userId,
    kind: "image",
    prompt: richPrompt,
    cost: PRICING.base.image ?? 1,
    reason: "agent_skill_broll",
  });

  if (!outcome.ok) {
    return { ok: false, summary: "B-roll generation failed", data: {}, error: outcome.error };
  }

  return {
    ok: true,
    summary: `Generated B-roll: "${shot_description.slice(0, 45)}"`,
    data: { shot_description, enrichedPrompt: richPrompt, url: outcome.url, provider: outcome.provider },
  };
}

// ─── recall_brand_memory ──────────────────────────────────────────────────────

async function recallBrandMemory(_args: unknown, ctx: SkillContext): Promise<SkillResult> {
  const { data: memRow } = await ctx.supabase
    .from("agent_user_memory")
    .select("memory, structured_memory")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  const structured = (memRow?.structured_memory as BrandMemory | null) ?? null;
  const freeText = memRow?.memory ?? "";

  if (!structured && !freeText) {
    return {
      ok: true,
      summary: "No brand memory yet",
      data: { hasMemory: false, message: "No brand profile has been saved yet for this artist." },
    };
  }

  return {
    ok: true,
    summary: "Recalled brand memory",
    data: {
      hasMemory: true,
      structured,
      freeText: freeText.trim().slice(0, 800),
    },
  };
}

// ─── update_brand_memory ──────────────────────────────────────────────────────

async function updateBrandMemory(args: unknown, ctx: SkillContext): Promise<SkillResult> {
  const patch = z
    .object({
      brand_voice: z.string().max(200).optional(),
      tone_keywords: z.array(z.string()).max(10).optional(),
      preferred_avatar_id: z.string().max(100).optional(),
      recurring_characters: z.array(z.string()).max(20).optional(),
      past_script_themes: z.array(z.string()).max(20).optional(),
    })
    .parse(args);

  // Load existing structured memory and merge
  const { data: existing } = await ctx.supabase
    .from("agent_user_memory")
    .select("structured_memory")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  const current = (existing?.structured_memory as BrandMemory | null) ?? {};
  const merged: BrandMemory = { ...current };

  if (patch.brand_voice) merged.brand_voice = patch.brand_voice;
  if (patch.tone_keywords) merged.tone_keywords = [...new Set([...(current.tone_keywords ?? []), ...patch.tone_keywords])];
  if (patch.preferred_avatar_id) merged.preferred_avatar_id = patch.preferred_avatar_id;
  if (patch.recurring_characters) merged.recurring_characters = [...new Set([...(current.recurring_characters ?? []), ...patch.recurring_characters])];
  if (patch.past_script_themes) merged.past_script_themes = [...new Set([...(current.past_script_themes ?? []), ...patch.past_script_themes])];

  await ctx.supabase.from("agent_user_memory").upsert({
    user_id: ctx.userId,
    structured_memory: merged as never,
    updated_at: new Date().toISOString(),
  });

  const fields = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined);
  return {
    ok: true,
    summary: `Updated brand profile: ${fields.join(", ")}`,
    data: { updatedFields: fields, newProfile: merged },
  };
}

// ─── add_captions ──────────────────────────────────────────────────────────────

async function addCaptions(args: unknown, ctx: SkillContext): Promise<SkillResult> {
  const { style } = z
    .object({ style: z.enum(["bold-white", "subtitle", "karaoke"]).default("bold-white") })
    .parse(args);

  // Look up the user's most recent successful video generation
  const { data: lastVideo } = await ctx.supabase
    .from("generations")
    .select("id, result_video_url, result_image_url")
    .eq("user_id", ctx.userId)
    .eq("status", "succeeded")
    .in("kind", ["video", "lipsync"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastVideo?.result_video_url) {
    return {
      ok: false,
      summary: "No video found",
      data: {},
      error: "No completed video generation found. Generate a video first, then ask to add captions.",
    };
  }

  const stylePresets: Record<string, Record<string, string>> = {
    "bold-white": { font_size: "24", font_color: "white", stroke_color: "black", stroke_width: "2", position: "bottom" },
    subtitle: { font_size: "18", font_color: "white", bg_color: "black@0.6", position: "bottom" },
    karaoke: { font_size: "22", font_color: "yellow", highlight_color: "white", position: "bottom" },
  };

  const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");
  const outcome = await reserveOrchestrateRecord({
    userId: ctx.userId,
    kind: "caption_burn",
    prompt: "Auto-captions from the video's audio track",
    videoUrl: lastVideo.result_video_url,
    params: stylePresets[style],
    cost: 2,
    reason: "agent_skill_add_captions",
  });

  if (!outcome.ok) {
    return { ok: false, summary: "Caption burn failed", data: {}, error: outcome.error };
  }

  return {
    ok: true,
    summary: `Added ${style} captions`,
    data: { style, sourceVideoId: lastVideo.id, captionedVideoUrl: outcome.url },
  };
}


// ─── heygen_avatar ───────────────────────────────────────────────────────────

async function heygenAvatar(args: unknown, ctx: SkillContext): Promise<SkillResult> {
  const parsed = z
    .object({
      avatarId: z.string().min(1).max(160).optional(),
      voiceId: z.string().min(1).max(160).optional(),
    })
    .parse(args);

  const patch: BrandMemory = {};
  if (parsed.avatarId) patch.preferred_avatar_id = parsed.avatarId;

  if (parsed.avatarId || parsed.voiceId) {
    const { data: existing } = await ctx.supabase
      .from("agent_user_memory")
      .select("structured_memory")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    const current = (existing?.structured_memory as BrandMemory | null) ?? {};
    await ctx.supabase.from("agent_user_memory").upsert({
      user_id: ctx.userId,
      structured_memory: {
        ...current,
        ...patch,
        preferred_voice_id: parsed.voiceId ?? current.preferred_voice_id,
      } as never,
      updated_at: new Date().toISOString(),
    });
  }

  return {
    ok: true,
    summary: parsed.avatarId ? "Saved HeyGen avatar" : "HeyGen avatar ready",
    data: {
      avatarId: parsed.avatarId ?? null,
      voiceId: parsed.voiceId ?? null,
      message: parsed.avatarId
        ? "Saved this HeyGen avatar as the artist's preferred Video Agent presenter."
        : "Ask the artist for a HeyGen avatar ID, or render with Aurora's default HeyGen avatar selection.",
    },
  };
}

// ─── heygen_video ────────────────────────────────────────────────────────────

async function heygenVideo(args: unknown, ctx: SkillContext): Promise<SkillResult> {
  const parsed = z
    .object({
      script: z.string().min(10).max(5000),
      orientation: z.enum(["portrait", "landscape"]).default("portrait"),
      avatarId: z.string().min(1).max(160).optional(),
      voiceId: z.string().min(1).max(160).optional(),
    })
    .parse(args);

  const { sanitizeVideoAgentScript, VIDEO_AGENT_MODEL_KEY } = await import("@/lib/video-agent-prompt");
  const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");
  const { computeCost } = await import("@/lib/pricing");
  const cleanScript = sanitizeVideoAgentScript(parsed.script);
  const quote = computeCost({ features: ["video"], model: VIDEO_AGENT_MODEL_KEY });
  const outcome = await reserveOrchestrateRecord({
    userId: ctx.userId,
    kind: "video",
    prompt: cleanScript,
    model: VIDEO_AGENT_MODEL_KEY,
    pinnedModelOnly: true,
    params: {
      orientation: parsed.orientation,
      ...(parsed.avatarId ? { avatarId: parsed.avatarId } : {}),
      ...(parsed.voiceId ? { voiceId: parsed.voiceId } : {}),
    },
    cost: quote.total,
    reason: "agent_skill_heygen_video",
  });

  if (!outcome.ok) {
    return { ok: false, summary: "HeyGen video failed", data: {}, error: outcome.error };
  }

  return {
    ok: true,
    summary: "Generated HeyGen video",
    data: {
      generationId: outcome.generationId,
      url: outcome.url,
      provider: outcome.provider,
      endpoint: outcome.endpoint,
      script: cleanScript,
      orientation: parsed.orientation,
    },
  };
}

// ─── heygen_translate ────────────────────────────────────────────────────────

async function heygenTranslate(args: unknown, ctx: SkillContext): Promise<SkillResult> {
  const parsed = z
    .object({
      videoUrl: z.string().url().optional(),
      languages: z.array(z.string().min(2).max(80)).min(1).max(8),
      mode: z.enum(["speed", "precision"]).default("speed"),
    })
    .parse(args);

  let videoUrl = parsed.videoUrl;
  if (!videoUrl) {
    const { data: lastVideo } = await ctx.supabase
      .from("generations")
      .select("result_video_url")
      .eq("user_id", ctx.userId)
      .eq("status", "succeeded")
      .in("kind", ["video", "lipsync", "caption_burn"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    videoUrl = lastVideo?.result_video_url ?? undefined;
  }

  if (!videoUrl) {
    return {
      ok: false,
      summary: "No video to translate",
      data: {},
      error: "No completed video was found. Generate a video first, or provide a videoUrl.",
    };
  }

  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      summary: "HeyGen auth missing",
      data: {},
      error: "HEYGEN_API_KEY is not configured, so HeyGen translation cannot run.",
    };
  }

  const response = await fetch("https://api.heygen.com/v3/video-translations", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({ video_url: videoUrl, output_languages: parsed.languages, mode: parsed.mode }),
  });

  if (!response.ok) {
    return {
      ok: false,
      summary: "HeyGen translation failed",
      data: {},
      error: `HeyGen translation ${response.status}: ${(await response.text()).slice(0, 250)}`,
    };
  }

  const body = (await response.json()) as { data?: { video_translation_ids?: string[]; video_translation_id?: string } };
  const ids = body.data?.video_translation_ids ?? (body.data?.video_translation_id ? [body.data.video_translation_id] : []);
  return {
    ok: true,
    summary: `Started HeyGen translations: ${parsed.languages.join(", ")}`,
    data: { sourceVideoUrl: videoUrl, languages: parsed.languages, mode: parsed.mode, translationIds: ids },
  };
}

// ─── Registry & dispatch ──────────────────────────────────────────────────────

export const SKILL_REGISTRY: Record<
  SkillName,
  { icon: string; label: string; execute: (args: unknown, ctx: SkillContext) => Promise<SkillResult> }
> = {
  web_search:           { icon: "🔍", label: "Web Search",        execute: webSearch },
  scrape_url:           { icon: "🌐", label: "Scrape URL",         execute: scrapeUrl },
  generate_hooks:       { icon: "🎣", label: "Hook Generator",     execute: generateHooks },
  generate_broll:       { icon: "🎬", label: "B-roll Generation",  execute: generateBroll },
  recall_brand_memory:  { icon: "🧠", label: "Brand Memory",       execute: recallBrandMemory },
  update_brand_memory:  { icon: "💾", label: "Save Brand Profile", execute: updateBrandMemory },
  add_captions:         { icon: "💬", label: "Add Captions",       execute: addCaptions },
  heygen_avatar:        { icon: "🧑", label: "HeyGen Avatar",      execute: heygenAvatar },
  heygen_video:         { icon: "🎥", label: "HeyGen Video",       execute: heygenVideo },
  heygen_translate:     { icon: "🌍", label: "HeyGen Translate",   execute: heygenTranslate },
};

export async function dispatchSkill(
  skillName: SkillName,
  args: unknown,
  ctx: SkillContext,
): Promise<SkillResult> {
  const skill = SKILL_REGISTRY[skillName];
  if (!skill) return { ok: false, summary: "Unknown skill", data: {}, error: `Unknown skill: ${skillName}` };
  return skill.execute(args, ctx);
}
