// AutoCut — upload clips, pick a style/music preset, get a polished short-form video.
// Server-only: cost constant + style/music manifest + storage helpers.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── Credit cost ──────────────────────────────────────────────────────────────
// Same as UGC Ad: a multi-stage assembly job (upload → assemble → deliver).
export const COST_AUTOCUT = 8;

// ─── Style presets ────────────────────────────────────────────────────────────

export type AutocutStyle = {
  id: string;
  label: string;
  desc: string;
  cutRate: "fast" | "medium" | "slow";
  transition: "cut" | "crossfade" | "wipe";
  /** Instructional hint sent to the assembler. */
  assemblerHint: string;
};

export const AUTOCUT_STYLES: AutocutStyle[] = [
  {
    id: "hype",
    label: "Hype",
    desc: "Fast cuts · beat-synced · high energy",
    cutRate: "fast",
    transition: "cut",
    assemblerHint: "Hard cuts synced to beat, 0.5–1.5s per clip, punchy transitions",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    desc: "Slow crossfades · epic scale · wide shots first",
    cutRate: "slow",
    transition: "crossfade",
    assemblerHint: "0.8s dissolve between clips, 3–5s per clip, favour wide/establishing shots early",
  },
  {
    id: "talking_head",
    label: "Talking Head",
    desc: "Speaker-led · B-roll mix · portrait crop",
    cutRate: "medium",
    transition: "cut",
    assemblerHint: "Speaker clip primary, intercut B-roll every 6–10s, jump-cut talking-head style",
  },
  {
    id: "tiktok_hook",
    label: "TikTok Hook",
    desc: "3-sec opener · story arc · viral pacing",
    cutRate: "fast",
    transition: "cut",
    assemblerHint: "3-second attention hook at top, rising action in middle, punch-in close at end",
  },
];

// ─── Music tracks ─────────────────────────────────────────────────────────────

export type MusicTrack = {
  id: string;
  label: string;
  /** Supabase studio bucket path — signed at processing time by the job runner. */
  storagePath: string;
  genre: string;
  bpm?: number;
};

// Admin uploads matching .mp3 files under studio/system/music/ to enable playback.
// Default: no music (silent). Adding files at the paths below activates each track.
export const MUSIC_TRACKS: MusicTrack[] = [
  // Hype
  { id: "hype-1",   label: "Adrenaline Rush",  storagePath: "system/music/hype-adrenaline-rush.mp3",  genre: "Hype",    bpm: 128 },
  { id: "hype-2",   label: "High Voltage",      storagePath: "system/music/hype-high-voltage.mp3",     genre: "Hype",    bpm: 140 },
  { id: "hype-3",   label: "Drop the Beat",     storagePath: "system/music/hype-drop-the-beat.mp3",    genre: "Hype",    bpm: 135 },
  // Cinematic
  { id: "cine-1",   label: "Epic Journey",      storagePath: "system/music/cine-epic-journey.mp3",     genre: "Cinematic", bpm: 80 },
  { id: "cine-2",   label: "Dreamscape",        storagePath: "system/music/cine-dreamscape.mp3",       genre: "Cinematic", bpm: 72 },
  { id: "cine-3",   label: "Golden Hour",       storagePath: "system/music/cine-golden-hour.mp3",      genre: "Cinematic", bpm: 76 },
  // Talking Head
  { id: "talk-1",   label: "Upbeat Chillhop",  storagePath: "system/music/talk-upbeat-chillhop.mp3",  genre: "Lo-fi",   bpm: 88 },
  { id: "talk-2",   label: "Coffee & Ideas",    storagePath: "system/music/talk-coffee-ideas.mp3",     genre: "Lo-fi",   bpm: 84 },
  { id: "talk-3",   label: "Focused Flow",      storagePath: "system/music/talk-focused-flow.mp3",     genre: "Lo-fi",   bpm: 90 },
  // TikTok Hook
  { id: "tiktok-1", label: "Trending Now",      storagePath: "system/music/tiktok-trending-now.mp3",   genre: "Pop",     bpm: 120 },
  { id: "tiktok-2", label: "Viral Energy",      storagePath: "system/music/tiktok-viral-energy.mp3",   genre: "Pop",     bpm: 118 },
  { id: "tiktok-3", label: "Hook & Loop",       storagePath: "system/music/tiktok-hook-loop.mp3",      genre: "Pop",     bpm: 122 },
];

// Style → recommended track IDs (shown in the music picker when a style is chosen).
export const STYLE_MUSIC: Record<string, string[]> = {
  hype:         ["hype-1",   "hype-2",   "hype-3"],
  cinematic:    ["cine-1",   "cine-2",   "cine-3"],
  talking_head: ["talk-1",   "talk-2",   "talk-3"],
  tiktok_hook:  ["tiktok-1", "tiktok-2", "tiktok-3"],
};

export function getMusicTrack(id: string): MusicTrack | undefined {
  return MUSIC_TRACKS.find((t) => t.id === id);
}

export function getStyleTracks(styleId: string): MusicTrack[] {
  const ids = STYLE_MUSIC[styleId] ?? [];
  return ids.flatMap((id) => MUSIC_TRACKS.find((t) => t.id === id) ?? []);
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

/** Return a signed download URL for a studio-bucket path, or null if unavailable. */
export async function signedAutocutUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from("studio")
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Create a signed upload URL for a studio-bucket path. */
export async function createAutocutUploadUrl(
  path: string,
): Promise<{ signedUrl: string; token: string } | null> {
  const { data, error } = await supabaseAdmin.storage
    .from("studio")
    .createSignedUploadUrl(path);
  if (error || !data) return null;
  return { signedUrl: data.signedUrl, token: data.token };
}
