// AutoCut — upload clips, pick a style/music preset, get a polished short-form video.
// Server-only: cost constant + style/music manifest + storage helpers.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// ─── Credit cost ──────────────────────────────────────────────────────────────
// COST_AUTOCUT is the single source in pricing.ts; re-exported here so existing
// server-side importers keep working without changes.
export { COST_AUTOCUT } from "./pricing";

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

// ─── Cut-point rules derived from style.cutRate/transition ────────────────────
// The assembler (local ffmpeg here, and workers/aurora_worker.py's run_assemble)
// uses these bounds to decide how long each scene stays on screen and whether
// scenes hard-cut or crossfade into each other. Keep the python worker's
// STYLE_CUT_RULE_BOUNDS dict in lockstep with CUT_RATE_BOUNDS below — it can't
// import this file directly.
const CUT_RATE_BOUNDS: Record<AutocutStyle["cutRate"], { minClipSec: number; maxClipSec: number }> = {
  fast: { minClipSec: 0.6, maxClipSec: 1.5 },
  medium: { minClipSec: 4, maxClipSec: 8 },
  slow: { minClipSec: 3, maxClipSec: 5 },
};
const DEFAULT_CUT_BOUNDS = { minClipSec: 0.5, maxClipSec: 8 };
const DEFAULT_CROSSFADE_SEC = 0.8;

export type StyleCutRule = {
  minClipSec: number;
  maxClipSec: number;
  transition: AutocutStyle["transition"];
  crossfadeSec: number;
};

/** Resolve the per-clip duration bounds + transition for a style id. Falls back to
 * sane hard-cut defaults for an unknown/missing style (e.g. kids_story assembly,
 * which doesn't send a `style` at all). */
export function getStyleCutRule(styleId?: string | null): StyleCutRule {
  const style = styleId ? AUTOCUT_STYLES.find((s) => s.id === styleId) : undefined;
  const bounds = style ? (CUT_RATE_BOUNDS[style.cutRate] ?? DEFAULT_CUT_BOUNDS) : DEFAULT_CUT_BOUNDS;
  return { ...bounds, transition: style?.transition ?? "cut", crossfadeSec: DEFAULT_CROSSFADE_SEC };
}

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
  { id: "hype-1",   label: "Adrenaline Rush",    storagePath: "system/music/hype-adrenaline-rush.mp3",    genre: "Hype",      bpm: 128 },
  { id: "hype-2",   label: "High Voltage",        storagePath: "system/music/hype-high-voltage.mp3",       genre: "Hype",      bpm: 140 },
  { id: "hype-3",   label: "Drop the Beat",       storagePath: "system/music/hype-drop-the-beat.mp3",      genre: "Hype",      bpm: 135 },
  { id: "hype-4",   label: "Fire Starter",        storagePath: "system/music/hype-fire-starter.mp3",       genre: "Hype",      bpm: 142 },
  { id: "hype-5",   label: "Turbo Boost",         storagePath: "system/music/hype-turbo-boost.mp3",        genre: "Hype",      bpm: 138 },
  { id: "hype-6",   label: "Maximum Overdrive",   storagePath: "system/music/hype-maximum-overdrive.mp3",  genre: "Hype",      bpm: 145 },
  // Cinematic
  { id: "cine-1",   label: "Epic Journey",        storagePath: "system/music/cine-epic-journey.mp3",       genre: "Cinematic", bpm: 80 },
  { id: "cine-2",   label: "Dreamscape",          storagePath: "system/music/cine-dreamscape.mp3",         genre: "Cinematic", bpm: 72 },
  { id: "cine-3",   label: "Golden Hour",         storagePath: "system/music/cine-golden-hour.mp3",        genre: "Cinematic", bpm: 76 },
  { id: "cine-4",   label: "Horizon",             storagePath: "system/music/cine-horizon.mp3",            genre: "Cinematic", bpm: 68 },
  { id: "cine-5",   label: "Midnight Bloom",      storagePath: "system/music/cine-midnight-bloom.mp3",     genre: "Cinematic", bpm: 74 },
  { id: "cine-6",   label: "Celestial",           storagePath: "system/music/cine-celestial.mp3",          genre: "Cinematic", bpm: 70 },
  // Talking Head
  { id: "talk-1",   label: "Upbeat Chillhop",     storagePath: "system/music/talk-upbeat-chillhop.mp3",    genre: "Lo-fi",     bpm: 88 },
  { id: "talk-2",   label: "Coffee & Ideas",      storagePath: "system/music/talk-coffee-ideas.mp3",       genre: "Lo-fi",     bpm: 84 },
  { id: "talk-3",   label: "Focused Flow",        storagePath: "system/music/talk-focused-flow.mp3",       genre: "Lo-fi",     bpm: 90 },
  { id: "talk-4",   label: "Easy Groove",         storagePath: "system/music/talk-easy-groove.mp3",        genre: "Lo-fi",     bpm: 86 },
  { id: "talk-5",   label: "Soft Bounce",         storagePath: "system/music/talk-soft-bounce.mp3",        genre: "Lo-fi",     bpm: 82 },
  { id: "talk-6",   label: "Workspace Vibes",     storagePath: "system/music/talk-workspace-vibes.mp3",    genre: "Lo-fi",     bpm: 92 },
  // TikTok Hook
  { id: "tiktok-1", label: "Trending Now",        storagePath: "system/music/tiktok-trending-now.mp3",     genre: "Pop",       bpm: 120 },
  { id: "tiktok-2", label: "Viral Energy",        storagePath: "system/music/tiktok-viral-energy.mp3",     genre: "Pop",       bpm: 118 },
  { id: "tiktok-3", label: "Hook & Loop",         storagePath: "system/music/tiktok-hook-loop.mp3",        genre: "Pop",       bpm: 122 },
  { id: "tiktok-4", label: "Dopamine Drop",       storagePath: "system/music/tiktok-dopamine-drop.mp3",    genre: "Pop",       bpm: 124 },
  { id: "tiktok-5", label: "FYP Ready",           storagePath: "system/music/tiktok-fyp-ready.mp3",        genre: "Pop",       bpm: 116 },
  { id: "tiktok-6", label: "Scroll Stopper",      storagePath: "system/music/tiktok-scroll-stopper.mp3",   genre: "Pop",       bpm: 126 },
];

// Style → recommended track IDs (shown in the music picker when a style is chosen).
export const STYLE_MUSIC: Record<string, string[]> = {
  hype:         ["hype-1",   "hype-2",   "hype-3",   "hype-4",   "hype-5",   "hype-6"],
  cinematic:    ["cine-1",   "cine-2",   "cine-3",   "cine-4",   "cine-5",   "cine-6"],
  talking_head: ["talk-1",   "talk-2",   "talk-3",   "talk-4",   "talk-5",   "talk-6"],
  tiktok_hook:  ["tiktok-1", "tiktok-2", "tiktok-3", "tiktok-4", "tiktok-5", "tiktok-6"],
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

// ─── Local ffmpeg assembler (no self-hosted GPU worker required) ───────────
//
// AutoCut's assembly (normalize → concat → optional music mix) is pure
// ffmpeg — no GPU/model weights involved (see workers/aurora_worker.py's
// `run_assemble`, which the self-hosted worker runs). Every Aurora
// environment already ships the system `ffmpeg`/`ffprobe` binaries (used by
// compress.server.ts), so rather than making AutoCut depend entirely on an
// external self-hosted worker being online — which today has zero
// registered rows in `gpu_workers` and always refunds — this runs the same
// pipeline locally as the primary path when no self-hosted worker is
// available. It never depends on GPU/model access, so it can run anywhere
// the app server runs.
//
// One deliberate improvement over the shared Python reference: that
// implementation always replaces each scene's audio with either narration
// or silence (built for kids-story picture+narration assembly). AutoCut has
// no narration track — it's editing the user's OWN footage — so silencing
// it here would drop real speech/ambience from every cut. This keeps a
// clip's original audio when it has one, falling back to silence only when
// a clip truly has no audio stream.
const ASSEMBLE_W = 720;
const ASSEMBLE_H = 1280;
const ASSEMBLE_FPS = 24;
const ASSEMBLE_MAX_SCENES = 12;
const ASSEMBLE_STEP_TIMEOUT_MS = 180_000;

function runFfmpegBinary(bin: "ffmpeg" | "ffprobe", args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`${bin} timed out`));
    }, timeoutMs);
    proc.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`${bin} exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

async function ffprobeDurationSec(path: string): Promise<number | null> {
  try {
    const out = await runFfmpegBinary(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path],
      15_000,
    );
    const n = parseFloat(out.trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function hasAudioStream(path: string): Promise<boolean> {
  try {
    const out = await runFfmpegBinary(
      "ffprobe",
      ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", path],
      15_000,
    );
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`assemble: failed to download ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
}

// ─── Aspect-ratio canvas resolution ──────────────────────────────────────────
// Supported aspect ratios and their canvas dimensions (all even-pixel, yuv420p-
// safe). Keep in lockstep with ASSEMBLE_CANVAS in aurora_worker.py.
const ASSEMBLE_CANVAS: Record<string, { w: number; h: number }> = {
  "9:16": { w: 720,  h: 1280 }, // portrait  (default)
  "16:9": { w: 1280, h: 720  }, // landscape
  "1:1":  { w: 720,  h: 720  }, // square
};

/**
 * Resolve canvas dimensions for the requested aspect ratio.
 * Throws with a clear message (matched by TERMINAL_ERROR_RE) when an
 * unsupported ratio is supplied so the job fails explicitly rather than
 * silently outputting the wrong shape.
 */
export function resolveAssembleCanvas(aspect?: string | null): { w: number; h: number } {
  const ratio = aspect ?? "9:16";
  const canvas = ASSEMBLE_CANVAS[ratio];
  if (!canvas) {
    throw new Error(
      `AutoCut: unsupported aspect ratio "${ratio}" [requires one of ${Object.keys(ASSEMBLE_CANVAS).join(", ")}]`,
    );
  }
  return canvas;
}

export type LocalAssembleParams = {
  clips: string[];
  /** AutoCut style id (hype/cinematic/talking_head/tiktok_hook) — drives per-clip
   * duration bounds and hard-cut vs crossfade transitions via getStyleCutRule().
   * Omitted for non-AutoCut callers (e.g. kids_story), which get the default
   * hard-cut bounds. */
  style?: string | null;
  musicUrl?: string | null;
  musicVolume?: number;
  maxDurationSec?: number;
  /** Output aspect ratio: "9:16" (default/portrait), "16:9" (landscape), or
   * "1:1" (square). Unsupported values throw explicitly so the job fails
   * visibly rather than silently outputting the wrong shape. */
  aspect?: string | null;
};

/** Sequentially crossfades `scenes` (each pre-normalized to the same canvas/fps)
 * into a single file using ffmpeg's xfade/acrossfade filters, honoring each
 * scene's own duration for the cumulative offset. Returns the merged file path. */
async function xfadeMergeScenes(
  dir: string,
  scenes: Array<{ path: string; dur: number }>,
  crossfadeSec: number,
): Promise<string> {
  let accPath = scenes[0].path;
  let accDur = scenes[0].dur;
  for (let i = 1; i < scenes.length; i++) {
    const next = scenes[i];
    const cf = Math.max(0.1, Math.min(crossfadeSec, accDur - 0.1, next.dur - 0.1));
    const offset = Math.max(0, accDur - cf);
    const out = join(dir, `xfade${i}_${randomUUID().slice(0, 8)}.mp4`);
    await runFfmpegBinary(
      "ffmpeg",
      [
        "-y", "-i", accPath, "-i", next.path,
        "-filter_complex",
        `[0:v][1:v]xfade=transition=fade:duration=${cf.toFixed(3)}:offset=${offset.toFixed(3)}[v];` +
          `[0:a][1:a]acrossfade=d=${cf.toFixed(3)}[a]`,
        "-map", "[v]", "-map", "[a]",
        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", "48000", "-ac", "2",
        out,
      ],
      ASSEMBLE_STEP_TIMEOUT_MS,
    );
    accPath = out;
    accDur = accDur + next.dur - cf;
  }
  return accPath;
}

/**
 * Runs the AutoCut assembly pipeline (normalize each clip per the style's
 * cut-point rule → concat/crossfade in order → optional looped/ducked music
 * mix) using the system ffmpeg locally, and returns the final MP4 bytes.
 * Throws on any failure — callers must treat that as a terminal job failure
 * (refund), same as an offline GPU worker.
 */
export async function runLocalFfmpegAssemble(params: LocalAssembleParams): Promise<Buffer> {
  const clips = params.clips;
  if (!clips?.length) throw new Error("assemble requires at least one clip");
  if (clips.length > ASSEMBLE_MAX_SCENES) {
    throw new Error(`assemble: too many scenes (${clips.length} > ${ASSEMBLE_MAX_SCENES})`);
  }
  for (const u of clips) {
    if (typeof u !== "string" || !/^https?:\/\//.test(u)) {
      throw new Error("assemble: every clip must be an http(s) url");
    }
  }

  const cutRule = getStyleCutRule(params.style);
  // Resolve output canvas — throws explicitly for unsupported ratios so the
  // job fails visibly rather than silently producing the wrong aspect ratio.
  const { w: canvasW, h: canvasH } = resolveAssembleCanvas(params.aspect);

  const dir = await mkdtemp(join(tmpdir(), "aurora-assemble-"));
  try {
    const scenes: Array<{ path: string; dur: number }> = [];
    for (let i = 0; i < clips.length; i++) {
      const clipIn = join(dir, `clip${i}.mp4`);
      await downloadToFile(clips[i], clipIn);
      const probedDur = await ffprobeDurationSec(clipIn);
      // Trim per the style's cut-point rule: longer clips are cut down to the
      // style's max, shorter clips are freeze-extended up to its min.
      const dur = Math.max(cutRule.minClipSec, Math.min(probedDur ?? cutRule.maxClipSec, cutRule.maxClipSec));
      const withAudio = await hasAudioStream(clipIn);
      const sceneOut = join(dir, `scene${i}_${randomUUID().slice(0, 8)}.mp4`);
      const vf =
        `scale=${canvasW}:${canvasH}:force_original_aspect_ratio=decrease,` +
        `pad=${canvasW}:${canvasH}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${ASSEMBLE_FPS},` +
        `tpad=stop_mode=clone:stop_duration=${dur.toFixed(3)},format=yuv420p`;

      const args = ["-y", "-i", clipIn];
      if (!withAudio) args.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
      args.push(
        "-filter_complex", `[0:v]${vf}[v]`,
        "-map", "[v]",
        "-map", withAudio ? "0:a" : "1:a",
        "-t", dur.toFixed(3),
        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", "48000", "-ac", "2",
        sceneOut,
      );
      await runFfmpegBinary("ffmpeg", args, ASSEMBLE_STEP_TIMEOUT_MS);
      scenes.push({ path: sceneOut, dur });
    }

    let concatOut: string;
    if (cutRule.transition === "crossfade" && scenes.length > 1) {
      concatOut = await xfadeMergeScenes(dir, scenes, cutRule.crossfadeSec);
    } else {
      const listPath = join(dir, "concat.txt");
      await writeFile(
        listPath,
        scenes.map((s) => `file '${s.path.replace(/'/g, "'\\''")}'`).join("\n"),
      );
      concatOut = join(dir, "concat.mp4");
      await runFfmpegBinary(
        "ffmpeg",
        [
          "-y", "-f", "concat", "-safe", "0", "-i", listPath,
          "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
          "-c:a", "aac", "-ar", "48000", "-ac", "2",
          concatOut,
        ],
        ASSEMBLE_STEP_TIMEOUT_MS,
      );
    }

    const maxDur = params.maxDurationSec ?? 60;
    let finalPath = concatOut;

    if (params.musicUrl) {
      const musicIn = join(dir, "music.mp3");
      await downloadToFile(params.musicUrl, musicIn);
      const musicOut = join(dir, "final.mp4");
      const vol = params.musicVolume ?? 0.15;
      await runFfmpegBinary(
        "ffmpeg",
        [
          "-y", "-i", concatOut, "-stream_loop", "-1", "-i", musicIn,
          "-filter_complex",
          `[1:a]volume=${vol}[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]`,
          "-map", "0:v", "-map", "[a]",
          "-t", String(maxDur),
          "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
          musicOut,
        ],
        ASSEMBLE_STEP_TIMEOUT_MS,
      );
      finalPath = musicOut;
    } else {
      const trimmed = join(dir, "trimmed.mp4");
      await runFfmpegBinary(
        "ffmpeg",
        ["-y", "-i", concatOut, "-t", String(maxDur), "-c", "copy", trimmed],
        ASSEMBLE_STEP_TIMEOUT_MS,
      );
      finalPath = trimmed;
    }

    return await readFile(finalPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Uploads assembled AutoCut bytes into the studio bucket and returns a public URL. */
export async function uploadAutocutResult(userId: string, jobId: string, bytes: Buffer): Promise<string> {
  const path = `${userId}/autocut/${jobId}.mp4`;
  const { error } = await supabaseAdmin.storage
    .from("studio")
    .upload(path, bytes, { contentType: "video/mp4", upsert: true });
  if (error) throw new Error(`autocut upload failed: ${error.message}`);
  return supabaseAdmin.storage.from("studio").getPublicUrl(path).data.publicUrl;
}
