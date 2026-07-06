import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { listAvatars } from "@/lib/mcp/avatars.server";
import { assertOwnedReferenceImage } from "@/lib/url-guard";
import {
  generateKidsStoryScript,
  computeKidsStoryCost,
  KIDS_CONTENT_TYPES,
  KIDS_AGE_RANGES,
  KIDS_LENGTHS,
  KIDS_CHARACTERS,
  KIDS_MUSIC,
  KIDS_MAX_SCENES,
  DEFAULT_KIDS_CHARACTER,
  type KidsLengthId,
} from "@/lib/kids-story.server";

/**
 * Faceless Kids Story Studio (/kids) — server functions.
 *
 * Flow: getKidsOptions (catalogs + saved avatars) → generateKidsScript (preview
 * the LLM-written script for review/edit, no charge) → enqueueKidsStory (reserve
 * credits + queue ONE `kids_story` job; see runKidsStory in jobs.server.ts) →
 * getKidsStoryStatus (poll the kids_stories row for step-by-step progress and the
 * final MP4). All multi-stage rendering — illustration, image-to-video, narration
 * and the self-hosted ffmpeg assembly — happens asynchronously on the jobs queue.
 *
 * kids_stories is not in the generated Supabase types until codegen re-runs, so a
 * loosely-typed admin handle is used and access is scoped to the authed user_id
 * (the same approach avatars.server.ts uses).
 */

const ContentTypes = ["bedtime", "nursery_rhyme", "educational", "adventure"] as const;
const AgeRanges = ["0-3", "3-5", "5-8"] as const;
const Lengths = ["short", "medium", "long"] as const;

const SceneSchema = z.object({
  narration: z.string().max(600),
  illustration: z.string().max(800),
});

const BriefSchema = z.object({
  contentType: z.enum(ContentTypes),
  ageRange: z.enum(AgeRanges),
  topic: z.string().min(2).max(300),
  lengthId: z.enum(Lengths).default("short"),
  characterName: z.string().min(1).max(120),
  characterDescription: z.string().max(800).optional(),
});

const EnqueueSchema = BriefSchema.extend({
  characterImageUrl: z.string().url().optional(),
  musicId: z.string().max(80).optional(),
  aspect: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  script: z.object({
    title: z.string().max(160).optional(),
    scenes: z.array(SceneSchema).min(1).max(KIDS_MAX_SCENES),
  }),
});

function rpcClient() {
  return supabaseAdmin as unknown as {
    rpc: (
      n: string,
      a: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
}

type LooseTable = {
  insert: (row: Record<string, unknown>) => {
    select: (cols: string) => { single: () => Promise<{ data: any; error: { message: string } | null }> };
  };
  update: (patch: Record<string, unknown>) => {
    eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
  };
  select: (cols: string) => any;
  delete: () => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
};
function kidsTable(): LooseTable {
  return (supabaseAdmin as unknown as { from: (t: string) => LooseTable }).from("kids_stories");
}

// ─── Catalogs + saved avatars for the brief form ──────────────────────────────

export const getKidsOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    let avatars: { id: string; name: string; previewUrl: string | null }[] = [];
    try {
      const rows = await listAvatars(userId, 50);
      avatars = rows
        .filter((a) => a.preview_url)
        .map((a) => ({ id: a.id, name: a.name, previewUrl: a.preview_url ?? null }));
    } catch {
      avatars = [];
    }
    return {
      contentTypes: KIDS_CONTENT_TYPES.map((c) => ({ id: c.id, label: c.label, blurb: c.blurb })),
      ageRanges: KIDS_AGE_RANGES.map((a) => ({ id: a.id, label: a.label })),
      lengths: (Object.keys(KIDS_LENGTHS) as KidsLengthId[]).map((id) => ({
        id,
        label: KIDS_LENGTHS[id].label,
        scenes: KIDS_LENGTHS[id].scenes,
        cost: computeKidsStoryCost(KIDS_LENGTHS[id].scenes, KIDS_LENGTHS[id].secondsPerScene),
      })),
      characters: KIDS_CHARACTERS.map((c) => ({ id: c.id, name: c.name, description: c.description })),
      defaultCharacterId: DEFAULT_KIDS_CHARACTER.id,
      music: KIDS_MUSIC.map((m) => ({ id: m.id, label: m.label, mood: m.mood })),
      avatars,
    };
  });

// ─── Script preview (no charge) ───────────────────────────────────────────────

export const generateKidsScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BriefSchema.parse(d))
  .handler(async ({ data }) => {
    const len = KIDS_LENGTHS[data.lengthId] ?? KIDS_LENGTHS.short;
    const { script, source, provider } = await generateKidsStoryScript({
      contentType: data.contentType,
      ageRange: data.ageRange,
      topic: data.topic,
      characterName: data.characterName,
      characterDescription: data.characterDescription,
      sceneCount: len.scenes,
    });
    return {
      title: script.title,
      scenes: script.scenes,
      source,
      provider: provider ?? null,
      sceneCount: script.scenes.length,
      cost: computeKidsStoryCost(script.scenes.length, len.secondsPerScene),
    };
  });

// ─── Enqueue render ───────────────────────────────────────────────────────────

export const enqueueKidsStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EnqueueSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.characterImageUrl) {
      await assertOwnedReferenceImage(data.characterImageUrl, userId);
    }
    const len = KIDS_LENGTHS[data.lengthId] ?? KIDS_LENGTHS.short;
    const sceneCount = Math.max(1, Math.min(data.script.scenes.length, KIDS_MAX_SCENES));
    const secondsPerScene = len.secondsPerScene;
    const cost = computeKidsStoryCost(sceneCount, secondsPerScene);
    const title = (data.script.title ?? "").trim() || `${data.characterName} story`;

    const brief = {
      contentType: data.contentType,
      ageRange: data.ageRange,
      topic: data.topic,
      lengthId: data.lengthId,
      characterName: data.characterName,
      characterDescription: data.characterDescription ?? null,
      characterImageUrl: data.characterImageUrl ?? null,
      musicId: data.musicId ?? null,
      aspect: data.aspect,
      sceneCount,
      secondsPerScene,
    };

    // 1. Create the story row first so the job payload can carry its id.
    const { data: storyRow, error: insErr } = await kidsTable()
      .insert({ user_id: userId, title, brief, scenes: data.script.scenes, status: "pending" })
      .select("id")
      .single();
    if (insErr || !storyRow?.id) throw new Error(insErr?.message ?? "Could not create story");
    const storyId = storyRow.id as string;

    // 2. Reserve credits + enqueue the job. On failure, drop the orphan row.
    const payload = {
      storyId,
      contentType: data.contentType,
      ageRange: data.ageRange,
      topic: data.topic,
      lengthId: data.lengthId,
      characterName: data.characterName,
      characterDescription: data.characterDescription,
      characterImageUrl: data.characterImageUrl ?? null,
      musicId: data.musicId ?? null,
      aspect: data.aspect,
      sceneCount,
      secondsPerScene,
      script: { title, scenes: data.script.scenes },
    };
    const prompt = `Kids story: ${title} — ${data.topic}`;
    const { data: rows, error } = await rpcClient().rpc("create_generation_and_reserve", {
      _user: userId,
      _kind: "kids_story",
      _prompt: prompt,
      _amount: cost,
      _payload: payload,
    });
    if (error) {
      await kidsTable().delete().eq("id", storyId);
      throw new Error(/insufficient_credits/i.test(error.message) ? "Not enough Aura" : error.message);
    }
    const row = (Array.isArray(rows) ? rows[0] : rows) as { job_id: string; generation_id: string };

    // 3. Link the job + generation back onto the story row.
    await kidsTable()
      .update({ job_id: row.job_id, generation_id: row.generation_id })
      .eq("id", storyId);

    return {
      storyId,
      jobId: row.job_id,
      generationId: row.generation_id,
      status: "queued" as const,
      credits: cost,
    };
  });

// ─── Status + history ─────────────────────────────────────────────────────────

export type KidsSceneState = {
  index: number;
  narration: string;
  illustration: string;
  status: string;
  imageUrl: string | null;
  clipUrl: string | null;
  error: string | null;
};

const StatusSchema = z.object({ storyId: z.string().uuid() });

export const getKidsStoryStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => StatusSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: story, error } = await kidsTable()
      .select("id, title, status, scenes, poster_url, final_video_url, error, generation_id")
      .eq("id", data.storyId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!story) throw new Error("Story not found");
    return {
      id: story.id as string,
      title: (story.title as string | null) ?? null,
      status: story.status as string,
      scenes: ((story.scenes as KidsSceneState[] | null) ?? []) as KidsSceneState[],
      posterUrl: (story.poster_url as string | null) ?? null,
      videoUrl: (story.final_video_url as string | null) ?? null,
      error: (story.error as string | null) ?? null,
      generationId: (story.generation_id as string | null) ?? null,
    };
  });

export const listKidsStories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await kidsTable()
      .select("id, title, status, poster_url, final_video_url, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(24);
    if (error) throw new Error(error.message);
    return ((data as any[]) ?? []).map((s) => ({
      id: s.id as string,
      title: (s.title as string | null) ?? null,
      status: s.status as string,
      posterUrl: (s.poster_url as string | null) ?? null,
      videoUrl: (s.final_video_url as string | null) ?? null,
      createdAt: (s.created_at as string | null) ?? null,
    }));
  });
