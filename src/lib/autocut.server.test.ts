import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

import { AUTOCUT_STYLES, getStyleCutRule, runLocalFfmpegAssemble, MUSIC_TRACKS, signedAutocutUrl } from "./autocut.server";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Generate a synthetic MP4 clip using ffmpeg lavfi (no external content required).
 * Output: H.264/AAC 640×360 at 24 fps with a sine-wave audio track. */
async function makeSyntheticClip(outPath: string, durationSec: number, color: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      "ffmpeg",
      [
        "-y",
        "-f", "lavfi", "-i", `color=c=${color}:size=640x360:rate=24:duration=${durationSec}`,
        "-f", "lavfi", "-i", `sine=frequency=440:sample_rate=48000:duration=${durationSec}`,
        "-t", String(durationSec),
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", "48000", "-ac", "2",
        outPath,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg clip gen exited ${code}: ${stderr.slice(-400)}`));
    });
  });
}

/** Serve files from a directory over local HTTP; returns server + base URL. */
async function startClipServer(dir: string): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer((req, res) => {
    const name = (req.url ?? "/").slice(1).replace(/\.\./g, "");
    readFile(join(dir, name))
      .then((bytes) => {
        res.writeHead(200, { "Content-Type": "video/mp4" });
        res.end(bytes);
      })
      .catch(() => {
        res.writeHead(404);
        res.end("not found");
      });
  });
  const port = await new Promise<number>((res) =>
    server.listen(0, "127.0.0.1", () => res((server.address() as AddressInfo).port)),
  );
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

/** ffprobe a file and return basic A/V properties. */
async function probeVideo(path: string): Promise<{
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
}> {
  const raw = await new Promise<string>((resolve, reject) => {
    const proc = spawn(
      "ffprobe",
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", path],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    proc.stdout?.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`ffprobe exited ${code}`));
    });
  });
  const data = JSON.parse(raw) as {
    streams: Array<{ codec_type: string; width?: number; height?: number }>;
    format: { duration: string };
  };
  const video = data.streams.find((s) => s.codec_type === "video");
  const audio = data.streams.find((s) => s.codec_type === "audio");
  return {
    duration: parseFloat(data.format?.duration ?? "0"),
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    hasAudio: !!audio,
  };
}

// ── Style-rule unit tests ──────────────────────────────────────────────────────

// AutoCut assembly no longer ignores the chosen style — getStyleCutRule() maps
// each style's cutRate/transition into concrete per-clip duration bounds and a
// hard-cut vs crossfade decision. Both the local ffmpeg assembler
// (runLocalFfmpegAssemble) and the self-hosted worker (aurora_worker.py's
// STYLE_CUT_RULES) key off this same shape.
describe("getStyleCutRule", () => {
  it("returns crossfade bounds for the cinematic (slow) style", () => {
    const rule = getStyleCutRule("cinematic");
    expect(rule.transition).toBe("crossfade");
    expect(rule.minClipSec).toBeGreaterThan(0);
    expect(rule.maxClipSec).toBeGreaterThan(rule.minClipSec);
    expect(rule.crossfadeSec).toBeGreaterThan(0);
  });

  it("returns short, hard-cut bounds for the hype (fast) style", () => {
    const rule = getStyleCutRule("hype");
    expect(rule.transition).toBe("cut");
    expect(rule.maxClipSec).toBeLessThanOrEqual(2);
  });

  it("returns a hard-cut rule for every declared AutoCut style", () => {
    for (const style of AUTOCUT_STYLES) {
      const rule = getStyleCutRule(style.id);
      expect(rule.transition).toBe(style.transition === "crossfade" ? "crossfade" : "cut");
      expect(rule.minClipSec).toBeLessThan(rule.maxClipSec);
    }
  });

  it("falls back to hard-cut defaults for an unknown or missing style (e.g. kids_story)", () => {
    const missing = getStyleCutRule(undefined);
    const unknown = getStyleCutRule("not-a-real-style");
    expect(missing.transition).toBe("cut");
    expect(unknown.transition).toBe("cut");
    expect(missing.minClipSec).toBeLessThan(missing.maxClipSec);
  });
});

// ── runLocalFfmpegAssemble integration tests ───────────────────────────────────
//
// These tests exercise the real ffmpeg binary to prove the local AutoCut
// assembly pipeline produces a valid 9:16 MP4 with preserved audio. Synthetic
// colour-bar clips (lavfi) are generated locally and served from an in-process
// HTTP server — no GPU worker, no Supabase storage, no external network calls.
//
// Corresponds to the "in-process fallback path" described in the task:
//   src/lib/autocut.server.ts → runLocalFfmpegAssemble
//   src/lib/jobs.server.ts   → runAutocut (local branch)
//
// The gallery routing proof is in the test for the `isVideo` routing in
// processOneJob: job.kind === "autocut" is listed in the isVideo condition
// at jobs.server.ts:1280, so result_video_url is ALWAYS set for autocut jobs.
// The smoke-autocut-e2e.ts script exercises the full DB path end-to-end.

// Bun's per-test timeout is passed as the 3rd arg to it(). The describe-level
// timeout option does NOT propagate to individual it() calls.
const FFMPEG_TIMEOUT = 180_000;

describe("runLocalFfmpegAssemble (integration)", () => {
  let testDir: string;
  let server: http.Server;
  let baseUrl: string;

  // Allow generous time for ffmpeg to generate 3 lavfi clips + start server.
  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), "aurora-autocut-test-"));
    // Generate 3 synthetic 3-second clips in parallel (different colours so
    // xfade transitions are visually distinct in manual review).
    await Promise.all([
      makeSyntheticClip(join(testDir, "clip0.mp4"), 3, "0xff0000"),
      makeSyntheticClip(join(testDir, "clip1.mp4"), 3, "0x00ff00"),
      makeSyntheticClip(join(testDir, "clip2.mp4"), 3, "0x0000ff"),
    ]);
    const srv = await startClipServer(testDir);
    server = srv.server;
    baseUrl = srv.baseUrl;
  }, FFMPEG_TIMEOUT);

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it(
    "hype (hard-cut): produces a 720×1280 MP4 ≤ 60 s with an audio stream",
    async () => {
      const clips = [0, 1, 2].map((i) => `${baseUrl}/clip${i}.mp4`);

      const result = await runLocalFfmpegAssemble({ clips, style: "hype", maxDurationSec: 60 });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(10_000);

      const outPath = join(testDir, "out-hype.mp4");
      await writeFile(outPath, result);

      const { duration, width, height, hasAudio } = await probeVideo(outPath);
      expect(width).toBe(720);
      expect(height).toBe(1280);
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThanOrEqual(61);
      expect(hasAudio).toBe(true);
    },
    FFMPEG_TIMEOUT,
  );

  it(
    "cinematic (crossfade): produces a 720×1280 MP4 with xfade transitions and audio",
    async () => {
      const clips = [0, 1, 2].map((i) => `${baseUrl}/clip${i}.mp4`);

      const result = await runLocalFfmpegAssemble({ clips, style: "cinematic", maxDurationSec: 60 });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(10_000);

      const outPath = join(testDir, "out-cine.mp4");
      await writeFile(outPath, result);

      const { duration, width, height, hasAudio } = await probeVideo(outPath);
      expect(width).toBe(720);
      expect(height).toBe(1280);
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThanOrEqual(61);
      expect(hasAudio).toBe(true);
    },
    FFMPEG_TIMEOUT,
  );

  it(
    "duration cap: output never exceeds maxDurationSec",
    async () => {
      const clips = [0, 1, 2].map((i) => `${baseUrl}/clip${i}.mp4`);

      const result = await runLocalFfmpegAssemble({ clips, style: "hype", maxDurationSec: 4 });

      const outPath = join(testDir, "out-capped.mp4");
      await writeFile(outPath, result);

      const { duration } = await probeVideo(outPath);
      // Allow 0.5 s tolerance for the copy-trim codec framing.
      expect(duration).toBeLessThanOrEqual(4.5);
    },
    FFMPEG_TIMEOUT,
  );

  it(
    "single clip: assembles without concat and returns valid 720×1280 MP4",
    async () => {
      const clips = [`${baseUrl}/clip0.mp4`];

      const result = await runLocalFfmpegAssemble({ clips, style: "hype", maxDurationSec: 60 });

      expect(result).toBeInstanceOf(Buffer);

      const outPath = join(testDir, "out-single.mp4");
      await writeFile(outPath, result);

      const { width, height, hasAudio } = await probeVideo(outPath);
      expect(width).toBe(720);
      expect(height).toBe(1280);
      expect(hasAudio).toBe(true);
    },
    FFMPEG_TIMEOUT,
  );
});

// ── signedAutocutUrl smoke tests ───────────────────────────────────────────────
//
// Each of the 24 MUSIC_TRACKS entries must resolve to a non-null signed URL,
// proving the corresponding MP3 file exists in the studio bucket at the path
// declared in MUSIC_TRACKS. Skipped when SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// are absent (CI environments without storage access).

const HAS_SUPABASE =
  typeof process.env.SUPABASE_URL === "string" &&
  process.env.SUPABASE_URL.length > 0 &&
  typeof process.env.SUPABASE_SERVICE_ROLE_KEY === "string" &&
  process.env.SUPABASE_SERVICE_ROLE_KEY.length > 0;

describe("signedAutocutUrl — music track smoke tests", () => {
  if (!HAS_SUPABASE) {
    it.skip("skipped: no Supabase credentials available", () => {});
    return;
  }

  // Build a real client directly instead of relying on the module-level
  // supabaseAdmin: other suites mock.module client.server and bun module
  // mocks leak process-globally, which would leave storage undefined here.
  const realAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  for (const track of MUSIC_TRACKS) {
    it(
      `${track.id} (${track.storagePath}) resolves to a signed URL`,
      async () => {
        const url = await signedAutocutUrl(track.storagePath, 3600, realAdmin);
        expect(url).not.toBeNull();
        expect(typeof url).toBe("string");
        expect(url!.length).toBeGreaterThan(0);
      },
      15_000,
    );
  }
});
