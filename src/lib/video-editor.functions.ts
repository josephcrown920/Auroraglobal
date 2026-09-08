// AI Video Editor — session CRUD, Studio clip tray, AI chat, and export.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { routedGenerate } from "@/lib/ai-router";
import { runLocalFfmpegAssemble, signedAutocutUrl, getMusicTrack } from "@/lib/autocut.server";
import { assertRateLimit } from "@/lib/rate-limit.server";
import {
  assertOwnedSoundtrackPath,
  muxOwnedSoundtrack,
  persistPrivateEditorExport,
  signPrivateEditorExport,
  type SoundtrackSettings,
} from "@/lib/soundtrack-export.server";

// edit_sessions is a new table not yet in generated types — use any cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any;

// ─── Shared types ─────────────────────────────────────────────────────────────

export type TimelineClip = {
  /** Client-side UUID — stable across mutations. */
  id: string;
  /** Source generation row id (if from Studio library). */
  generationId?: string;
  /** Studio bucket storage path (if uploaded via AutoCut / device). */
  storagePath?: string;
  /** Display video URL — provider URL or proxy URL shown in the browser. */
  videoUrl: string;
  /** Poster image URL (result_image_url from generation, if available). */
  thumbnailUrl?: string;
  label: string;
  /** Probed duration in seconds (0 = not yet known). */
  durationSec: number;
  /** User-set trim from the start, in seconds. Default 0. */
  trimStartSec: number;
  /** User-set trim from the end, in seconds. Default 0. */
  trimEndSec: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export type EditorMutation = {
  op: string;
  /** clip UUID (trim / remove / move) */
  clipId?: string;
  trimStartSec?: number;
  trimEndSec?: number;
  /** 0-based destination index (move) */
  toIndex?: number;
  styleId?: string;
  trackId?: string | null;
};

export type { SoundtrackSettings };

const SoundtrackSettingsSchema = z.object({
  offsetSec: z.number().min(0).max(120),
  trimStartSec: z.number().min(0).max(3600),
  trimEndSec: z.number().min(0).max(3600),
  volume: z.number().min(0).max(2),
  mode: z.enum(["mix", "replace"]),
});

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const TimelineClipSchema = z.object({
  id: z.string(),
  generationId: z.string().optional(),
  storagePath: z.string().optional(),
  videoUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  label: z.string().max(200),
  durationSec: z.number().min(0),
  trimStartSec: z.number().min(0).default(0),
  trimEndSec: z.number().min(0).default(0),
});

const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.string(),
});

// ─── Session CRUD ─────────────────────────────────────────────────────────────

export const createEditSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await db
      .from("edit_sessions")
      .insert({ user_id: context.userId })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create edit session");
    return { sessionId: data.id as string };
  });

export const listEditSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await db
      .from("edit_sessions")
      .select("id, title, status, style, result_url, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string; title: string; status: string; style: string;
      result_url: string | null; created_at: string; updated_at: string;
    }>;
  });

export const loadEditSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ sessionId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await db
      .from("edit_sessions")
      .select("id, user_id, title, clip_list, chat_history, style, music_track_id, source_audio_path, soundtrack_offset_sec, soundtrack_trim_start_sec, soundtrack_trim_end_sec, soundtrack_volume, soundtrack_mode, status, result_url, result_path")
      .eq("id", data.sessionId)
      .single();
    if (error || !row) throw new Error("Edit session not found");
    if (row.user_id !== context.userId) throw new Error("Forbidden");
    let sourceAudioUrl: string | null = null;
    if (row.source_audio_path) {
      assertOwnedSoundtrackPath(row.source_audio_path as string, context.userId);
      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from("studio")
        .createSignedUrl(row.source_audio_path as string, 60 * 60);
      if (signError || !signed?.signedUrl) throw new Error("Could not load performance reference audio");
      sourceAudioUrl = signed.signedUrl;
    }
    let resultUrl: string | null = null;
    if (row.result_path) resultUrl = await signPrivateEditorExport(row.result_path as string, context.userId);
    return {
      id:           row.id          as string,
      title:        row.title       as string,
      clipList:     (row.clip_list  ?? []) as TimelineClip[],
      chatHistory:  (row.chat_history ?? []) as ChatMessage[],
      style:        row.style       as string,
      musicTrackId: row.music_track_id as string | null,
      status:       row.status      as string,
       resultUrl:    resultUrl ?? row.result_url as string | null,
      sourceAudioUrl,
       hasSourceAudio: Boolean(row.source_audio_path),
       soundtrack: {
         offsetSec: row.soundtrack_offset_sec ?? 0,
         trimStartSec: row.soundtrack_trim_start_sec ?? 0,
         trimEndSec: row.soundtrack_trim_end_sec ?? 0,
         volume: row.soundtrack_volume ?? 1,
         mode: row.soundtrack_mode ?? "mix",
       } as SoundtrackSettings,
    };
  });

export const saveEditSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    sessionId:    z.string().uuid(),
    title:        z.string().max(200).optional(),
    clipList:     z.array(TimelineClipSchema),
    chatHistory:  z.array(ChatMessageSchema),
    style:        z.string(),
    musicTrackId: z.string().nullable().optional(),
    soundtrack: SoundtrackSettingsSchema,
  }))
  .handler(async ({ data, context }) => {
    // Ownership check
    const { data: row } = await db
      .from("edit_sessions")
      .select("user_id")
      .eq("id", data.sessionId)
      .single();
    if (!row || row.user_id !== context.userId) throw new Error("Forbidden");

    const { error } = await db
      .from("edit_sessions")
      .update({
        ...(data.title !== undefined && { title: data.title }),
        clip_list:      data.clipList,
        chat_history:   data.chatHistory,
        style:          data.style,
        music_track_id: data.musicTrackId ?? null,
        soundtrack_offset_sec: data.soundtrack.offsetSec,
        soundtrack_trim_start_sec: data.soundtrack.trimStartSec,
        soundtrack_trim_end_sec: data.soundtrack.trimEndSec,
        soundtrack_volume: data.soundtrack.volume,
        soundtrack_mode: data.soundtrack.mode,
      })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Studio clip tray ─────────────────────────────────────────────────────────

export type StudioClip = {
  generationId: string;
  label: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  kind: string;
  createdAt: string;
};

export const listStudioVideoClips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Use supabaseAdmin directly — generations IS in generated types.
    const { data, error } = await supabaseAdmin
      .from("generations")
      .select("id, prompt, kind, result_image_url, result_video_url, created_at")
      .eq("user_id", context.userId)
      .eq("status", "succeeded")
      .not("result_video_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      generationId: row.id,
      label:        ((row.prompt as string | null) ?? "").slice(0, 60) || "Video",
      videoUrl:     row.result_video_url as string,
      thumbnailUrl: row.result_image_url ?? null,
      kind:         row.kind ?? "video",
      createdAt:    row.created_at ?? "",
    })) as StudioClip[];
  });

// ─── AI Chat ──────────────────────────────────────────────────────────────────

const EDITOR_SYSTEM_PROMPT = `You are an AI video editor assistant. The user has a timeline of video clips.

Respond ONLY with a JSON object in this exact shape:
{
  "summary": "Plain-English explanation of what you changed (1-2 sentences).",
  "mutations": [array of mutation objects, may be empty]
}

Mutation objects:
- { "op": "trim",     "clipId": "<uuid>", "trimStartSec": 0, "trimEndSec": 0 }
- { "op": "remove",   "clipId": "<uuid>" }
- { "op": "move",     "clipId": "<uuid>", "toIndex": 2 }          (0-based)
- { "op": "setStyle", "styleId": "hype|cinematic|talking_head|tiktok_hook" }
- { "op": "setMusic", "trackId": "hype-1|cine-1|..." }
- { "op": "setMusic", "trackId": null }                            (remove music)

Rules:
- Clip IDs are the "id" UUIDs in the timeline JSON. Never invent IDs.
- "clip 1" = index 0, "clip 2" = index 1, etc.
- "first N seconds" → trimStartSec: N
- "last N seconds"  → trimEndSec: N
- Vibe/mood keywords (cinematic, energetic, fast) → setStyle mutation.
- Return empty mutations if the request is unclear or impossible.
- Be concise in summary — users read it on mobile.`;

const ChatResponseSchema = z.object({
  summary: z.string(),
  mutations: z.array(z.object({
    op:           z.string(),
    clipId:       z.string().optional(),
    trimStartSec: z.number().optional(),
    trimEndSec:   z.number().optional(),
    toIndex:      z.number().int().optional(),
    styleId:      z.string().optional(),
    trackId:      z.string().nullable().optional(),
  })),
});

export const editorChatFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    sessionId:   z.string().uuid(),
    clipList:    z.array(TimelineClipSchema),
    userMessage: z.string().max(1000).trim().min(1),
  }))
  .handler(async ({ data, context }) => {
    // Ownership check
    const { data: row } = await db
      .from("edit_sessions")
      .select("user_id")
      .eq("id", data.sessionId)
      .single();
    if (!row || row.user_id !== context.userId) throw new Error("Forbidden");

    const timelineSummary = data.clipList.map((c, i) => ({
      index: i + 1,
      id: c.id,
      label: c.label,
      durationSec: c.durationSec,
      trimStartSec: c.trimStartSec,
      trimEndSec: c.trimEndSec,
    }));

    const prompt = `Current timeline (${data.clipList.length} clips):
${JSON.stringify(timelineSummary, null, 2)}

User command: ${data.userMessage}`;

    const { output } = await routedGenerate({
      system: EDITOR_SYSTEM_PROMPT,
      prompt,
      schema: ChatResponseSchema,
      category: "VIDEO_DIRECTION",
    });
    return { summary: output.summary, mutations: output.mutations as EditorMutation[] };
  });

// ─── Export ───────────────────────────────────────────────────────────────────

export const exportEditSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({
    sessionId:    z.string().uuid(),
    clipList:     z.array(TimelineClipSchema),
    style:        z.string(),
    musicTrackId: z.string().nullable().optional(),
    soundtrack: SoundtrackSettingsSchema,
  }))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    assertRateLimit(`video-editor-export:${userId}`, 3, 10 * 60_000);

    // Ownership check
    const { data: row } = await db
      .from("edit_sessions")
      .select("user_id, source_audio_path")
      .eq("id", data.sessionId)
      .single();
    if (!row || row.user_id !== userId) throw new Error("Forbidden");
    if (!data.clipList.length) throw new Error("Add at least one clip before exporting");

    // Mark session as exporting
    await db.from("edit_sessions").update({ status: "exporting" }).eq("id", data.sessionId);

    try {
      // Resolve a playable HTTP URL for each clip
      const videoUrls: string[] = [];
      for (const clip of data.clipList) {
        let url: string | null = null;
        if (clip.generationId) {
          // Fetch the raw provider URL directly from DB (not the watermark proxy)
          const { data: gen } = await supabaseAdmin
            .from("generations")
            .select("result_video_url")
            .eq("id", clip.generationId)
            .eq("user_id", userId)
            .single();
          url = (gen as { result_video_url: string | null } | null)?.result_video_url ?? null;
        } else if (clip.storagePath) {
          assertOwnedSoundtrackPath(clip.storagePath, userId);
          url = await signedAutocutUrl(clip.storagePath, 3600);
        } else {
          throw new Error(`Clip "${clip.label}" is not backed by owned storage or a generation`);
        }
        if (!url) throw new Error(`Could not resolve video URL for clip "${clip.label}"`);
        videoUrls.push(url);
      }

      // Resolve music URL if selected
      let musicUrl: string | null = null;
      if (data.musicTrackId) {
        const track = getMusicTrack(data.musicTrackId);
        if (track) musicUrl = await signedAutocutUrl(track.storagePath, 3600);
      }

      // Assemble via local ffmpeg
      let bytes = await runLocalFfmpegAssemble({
        clips: videoUrls,
        style: data.style,
        musicUrl,
        maxDurationSec: 120,
      });

      if (row.source_audio_path) {
        bytes = await muxOwnedSoundtrack({
          video: bytes,
          soundtrackPath: row.source_audio_path as string,
          userId,
          settings: data.soundtrack,
        });
      }

      // Keep editor exports private and issue a short-lived retrieval URL.
      const { resultPath, resultUrl } = await persistPrivateEditorExport(userId, data.sessionId, bytes);

      // Mark done and store result
      await db
        .from("edit_sessions")
        .update({
          status: "done",
          result_url: null,
          result_path: resultPath,
          soundtrack_offset_sec: data.soundtrack.offsetSec,
          soundtrack_trim_start_sec: data.soundtrack.trimStartSec,
          soundtrack_trim_end_sec: data.soundtrack.trimEndSec,
          soundtrack_volume: data.soundtrack.volume,
          soundtrack_mode: data.soundtrack.mode,
        })
        .eq("id", data.sessionId);

      return { resultUrl };
    } catch (error) {
      await db.from("edit_sessions").update({ status: "draft" }).eq("id", data.sessionId);
      throw error;
    }
  });
