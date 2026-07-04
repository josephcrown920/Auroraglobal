import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { generateWithFallback } from "@/lib/llm-fallback.server";
import {
  COST_DAILY_POSTS,
  COST_ROLLOUT_PLAN,
  COST_SOCIAL_PACK,
} from "@/lib/pricing";

// ─── Simple credit helpers (pure LLM jobs — no orchestrator/media pipeline) ──

async function reserveCredits(
  userId: string,
  amount: number,
  reason: string,
  ref: string,
): Promise<boolean> {
  const client = supabaseAdmin as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc("reserve_credits", {
    _user: userId,
    _amount: amount,
    _reason: reason,
    _ref: ref,
  });
  if (error) throw new Error(error.message);
  return !!data;
}

async function commitReservation(ref: string): Promise<void> {
  const client = supabaseAdmin as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
  const { error } = await client.rpc("commit_reservation", { _ref: ref });
  if (error) throw new Error(error.message);
}

async function releaseReservation(ref: string, reason: string): Promise<void> {
  const client = supabaseAdmin as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
  await client.rpc("release_reservation", { _ref: ref, _reason: reason });
}

async function checkPro(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  return data?.plan === "pro" || isAdmin;
}

// ─── Growth Tool run history ────────────────────────────────────────────────
// `growth_tool_runs` is not (yet) in the generated Supabase types, so the
// insert/select go through a narrowly-typed cast, matching the pattern used
// for the credit RPCs above.

export type GrowthTool = "daily_posts" | "rollout_plan" | "social_pack";

type JsonRecord = Json;

type GrowthToolRunsTable = {
  from: (table: "growth_tool_runs") => {
    insert: (row: { user_id: string; tool: GrowthTool; input: JsonRecord; output: JsonRecord }) => Promise<{
      error: { message: string } | null;
    }>;
    select: (columns: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        eq: (
          col: string,
          val: string,
        ) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => {
            limit: (n: number) => Promise<{
              data: Array<{ id: string; tool: GrowthTool; input: JsonRecord; output: JsonRecord; created_at: string }> | null;
              error: { message: string } | null;
            }>;
          };
        };
      };
    };
  };
};

// Persisting a run is a nice-to-have alongside the already-committed
// generation — never let a save failure block returning the result the user
// already paid Aura credits for. Log loudly instead of failing silently.
async function saveGrowthToolRun(
  userId: string,
  tool: GrowthTool,
  input: JsonRecord,
  output: JsonRecord,
): Promise<void> {
  const client = supabaseAdmin as unknown as GrowthToolRunsTable;
  const { error } = await client.from("growth_tool_runs").insert({ user_id: userId, tool, input, output });
  if (error) {
    console.error(`[growth_tool_runs] failed to save ${tool} run for ${userId}:`, error.message);
  }
}

export const listGrowthToolRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      tool: z.enum(["daily_posts", "rollout_plan", "social_pack"]),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const client = supabaseAdmin as unknown as GrowthToolRunsTable;
    const { data: rows, error } = await client
      .from("growth_tool_runs")
      .select("id, tool, input, output, created_at")
      .eq("user_id", userId)
      .eq("tool", data.tool)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) {
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const, runs: rows ?? [] };
  });

// ─── Schemas ─────────────────────────────────────────────────────────────────

const DailyPostDaySchema = z.object({
  day: z.number().int().min(1).max(7).describe("Day number 1–7"),
  platform: z.string().describe("e.g. Instagram, TikTok, Twitter"),
  caption: z.string().describe("Ready-to-post caption with emojis and hashtags"),
  imagePrompt: z.string().describe("Detailed AI image generation prompt for the visual"),
  tone: z.string().describe("Post tone e.g. hype, behind-the-scenes, fan engagement"),
});

const DailyPostsOutputSchema = z.object({
  days: z.array(DailyPostDaySchema).min(7).max(7),
});

const RolloutWeekSchema = z.object({
  week: z.number().int().min(1).describe("Week number"),
  label: z.string().describe("e.g. Pre-release teaser, Release week, Momentum push"),
  goal: z.string().describe("Marketing goal for the week"),
  posts: z.array(z.object({
    platform: z.string(),
    type: z.string().describe("e.g. Teaser clip, Behind-the-scenes, Fan repost, Lyric quote"),
    copy: z.string().describe("Caption copy or post idea"),
    hashtags: z.array(z.string()).describe("3-5 recommended hashtags"),
    tip: z.string().describe("Platform-specific tip for maximum reach"),
  })).min(2).max(4),
});

const RolloutPlanOutputSchema = z.object({
  title: z.string().describe("Song/release title"),
  summary: z.string().describe("2-sentence strategic overview of the rollout"),
  weeks: z.array(RolloutWeekSchema).min(4).max(8),
});

const SocialPackOutputSchema = z.object({
  squareCaption: z.string().describe("Caption optimized for square (1:1) Instagram post"),
  portraitCaption: z.string().describe("Caption optimized for vertical (9:16) Reels/TikTok"),
  landscapeCaption: z.string().describe("Caption optimized for horizontal YouTube/Twitter"),
  captionVariants: z.array(z.string()).min(5).max(5).describe("5 caption variants with different tones"),
  hashtags: z.object({
    core: z.array(z.string()).describe("5-8 core evergreen hashtags"),
    trending: z.array(z.string()).describe("3-5 trending/niche hashtags for the genre"),
    branded: z.array(z.string()).describe("2-3 artist/song-specific hashtags"),
  }),
  imagePromptSquare: z.string().describe("AI image prompt for a 1:1 cover art visual"),
  imagePromptPortrait: z.string().describe("AI image prompt for a 9:16 vertical visual"),
});

// ─── Server Functions ─────────────────────────────────────────────────────────

export const generateDailyPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      songTitle: z.string().min(1).max(200),
      artistName: z.string().min(1).max(200),
      genre: z.string().min(1).max(100),
      releaseStatus: z.enum(["upcoming", "out_now", "classic"]),
      platforms: z.array(z.enum(["Instagram", "TikTok", "Twitter", "YouTube", "Facebook"])).min(1).max(5),
      tone: z.enum(["hype", "authentic", "storytelling", "fan_engagement", "mixed"]),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const isPro = await checkPro(userId);
    if (!isPro) {
      return { ok: false as const, error: "Pro subscription required", proRequired: true };
    }

    const ref = crypto.randomUUID();
    const reserved = await reserveCredits(userId, COST_DAILY_POSTS, "growth:daily_posts", ref);
    if (!reserved) {
      return { ok: false as const, error: "Insufficient Aura credits", insufficient: true };
    }

    try {
      const statusLabel = {
        upcoming: `releasing soon (not yet released)`,
        out_now: `freshly released (out now)`,
        classic: `an established track`,
      }[data.releaseStatus];

      const toneLabel = {
        hype: "high-energy hype and excitement",
        authentic: "authentic and personal storytelling",
        storytelling: "narrative and behind-the-scenes",
        fan_engagement: "fan interaction and community",
        mixed: "a natural mix of tones across the week",
      }[data.tone];

      const { output } = await generateWithFallback({
        system:
          "You are an expert music marketing strategist and social media manager for independent artists. Write engaging, platform-native social posts that drive real engagement.",
        prompt: `Create a 7-day social media content calendar for the following:
Artist: ${data.artistName}
Song: "${data.songTitle}"
Genre: ${data.genre}
Release status: ${statusLabel}
Target platforms: ${data.platforms.join(", ")}
Tone: ${toneLabel}

Rules:
- Each day must target one of the specified platforms (rotate through them)
- Captions must include emojis and 3-6 hashtags natural to the platform
- Image prompts should be vivid, specific, and music-video-quality
- Make the 7 days feel like a coherent campaign arc (build excitement → release → sustain)
- Keep captions under 300 characters for Twitter/X, up to 2200 for Instagram
- Vary the content types: teaser, lyric reveal, behind-the-scenes, fan shoutout, etc.

Return exactly 7 day entries.`,
        schema: DailyPostsOutputSchema,
      });

      await commitReservation(ref);
      await saveGrowthToolRun(userId, "daily_posts", data, { days: output.days, cost: COST_DAILY_POSTS });
      return { ok: true as const, days: output.days, cost: COST_DAILY_POSTS };
    } catch (err) {
      await releaseReservation(ref, "growth:daily_posts:failed");
      const msg = err instanceof Error ? err.message : "Content generation failed";
      return { ok: false as const, error: msg };
    }
  });

export const generateRolloutPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      songTitle: z.string().min(1).max(200),
      artistName: z.string().min(1).max(200),
      genre: z.string().min(1).max(100),
      releaseDate: z.string().min(1).max(50),
      targetPlatforms: z.array(z.enum(["Instagram", "TikTok", "Twitter", "YouTube", "Spotify", "Apple Music"])).min(1).max(6),
      budget: z.enum(["zero", "low", "medium"]),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const isPro = await checkPro(userId);
    if (!isPro) {
      return { ok: false as const, error: "Pro subscription required", proRequired: true };
    }

    const ref = crypto.randomUUID();
    const reserved = await reserveCredits(userId, COST_ROLLOUT_PLAN, "growth:rollout_plan", ref);
    if (!reserved) {
      return { ok: false as const, error: "Insufficient Aura credits", insufficient: true };
    }

    try {
      const budgetLabel = { zero: "zero budget (organic only)", low: "low budget ($0–$200 ads)", medium: "medium budget ($200–$1000 ads)" }[data.budget];

      const { output } = await generateWithFallback({
        system:
          "You are a senior music marketing strategist who has launched thousands of independent artist releases. You specialize in data-driven, platform-native release campaigns.",
        prompt: `Create a detailed week-by-week music release promotion calendar for:
Artist: ${data.artistName}
Song: "${data.songTitle}"
Genre: ${data.genre}
Release date: ${data.releaseDate}
Target platforms: ${data.targetPlatforms.join(", ")}
Budget: ${budgetLabel}

Structure the plan covering:
- 2 weeks of pre-release (build anticipation)
- Release week (maximum push)
- 2-4 weeks post-release (sustain momentum)

For each week, provide 2-4 specific actionable posts with platform-native tips.
Focus on tactics that actually work for independent artists in ${data.genre}.
Include specific hashtags that are active in this genre community.`,
        schema: RolloutPlanOutputSchema,
      });

      await commitReservation(ref);
      await saveGrowthToolRun(userId, "rollout_plan", data, { plan: output, cost: COST_ROLLOUT_PLAN });
      return { ok: true as const, plan: output, cost: COST_ROLLOUT_PLAN };
    } catch (err) {
      await releaseReservation(ref, "growth:rollout_plan:failed");
      const msg = err instanceof Error ? err.message : "Plan generation failed";
      return { ok: false as const, error: msg };
    }
  });

export const generateSocialPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      songTitle: z.string().min(1).max(200),
      artistName: z.string().min(1).max(200),
      genre: z.string().min(1).max(100),
      mood: z.string().min(1).max(200),
      visualStyle: z.string().min(1).max(200),
      keyMessage: z.string().min(1).max(500),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const isPro = await checkPro(userId);
    if (!isPro) {
      return { ok: false as const, error: "Pro subscription required", proRequired: true };
    }

    const ref = crypto.randomUUID();
    const reserved = await reserveCredits(userId, COST_SOCIAL_PACK, "growth:social_pack", ref);
    if (!reserved) {
      return { ok: false as const, error: "Insufficient Aura credits", insufficient: true };
    }

    try {
      const { output } = await generateWithFallback({
        system:
          "You are a creative director and social media strategist for music artists. You create cohesive, visually striking social media packs that drive streams and follows.",
        prompt: `Create a complete social media content pack for:
Artist: ${data.artistName}
Song: "${data.songTitle}"
Genre: ${data.genre}
Song mood/vibe: ${data.mood}
Visual style reference: ${data.visualStyle}
Key message: ${data.keyMessage}

Generate:
1. Platform-specific captions (square 1:1 for Instagram feed, vertical 9:16 for Reels/TikTok, horizontal for YouTube/Twitter)
2. Exactly 5 caption variants with different tones (hype, heartfelt, curious, bold, conversational)
3. A strategic hashtag strategy split into core evergreen, trending/niche, and branded hashtags
4. Detailed AI image generation prompts for both square and portrait orientations that match the visual style

Make every piece feel cohesive with the song's mood and the artist's brand.`,
        schema: SocialPackOutputSchema,
      });

      await commitReservation(ref);
      await saveGrowthToolRun(userId, "social_pack", data, { pack: output, cost: COST_SOCIAL_PACK });
      return { ok: true as const, pack: output, cost: COST_SOCIAL_PACK };
    } catch (err) {
      await releaseReservation(ref, "growth:social_pack:failed");
      const msg = err instanceof Error ? err.message : "Pack generation failed";
      return { ok: false as const, error: msg };
    }
  });
