#!/usr/bin/env bun
/**
 * upload-autocut-music.ts
 *
 * Generates 24 synthetic royalty-free background music MP3 tracks and uploads
 * them to the Supabase "studio" bucket under system/music/.
 *
 * Usage:
 *   bun run scripts/upload-autocut-music.ts
 *
 * Each track is generated via ffmpeg lavfi (no external content, no licensing
 * concerns) with genre-appropriate characteristics (frequency profile, tempo
 * modulation). Duration: 60 s each, ~120 kbps MP3 → ~900 KB per file.
 */

import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── Supabase setup ──────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Track definitions ──────────────────────────────────────────────────────────
// Each track specifies three layered sine frequencies (fundamental + harmonics),
// a tremolo rate (BPM/60 Hz — creates a rhythmic pulse) and depth, and the
// storage path used in MUSIC_TRACKS.

type TrackSpec = {
  id: string;
  storagePath: string;
  // Three sine-wave frequencies in Hz (fundamental, 5th, octave)
  freqs: [number, number, number];
  // Tremolo rate (Hz) = BPM / 60
  tremoloHz: number;
  // Tremolo depth 0..1
  depth: number;
  // Volume level
  vol: number;
  // Optional extra filter (inserted before the final volume stage)
  extraFilter?: string;
};

const TRACKS: TrackSpec[] = [
  // ── Hype (fast, energetic, BPM 128-145) ────────────────────────────────────
  {
    id: "hype-1", storagePath: "system/music/hype-adrenaline-rush.mp3",
    freqs: [440, 660, 880], tremoloHz: 2.13, depth: 0.80, vol: 0.70,
    extraFilter: "aecho=0.4:0.3:20:0.5",
  },
  {
    id: "hype-2", storagePath: "system/music/hype-high-voltage.mp3",
    freqs: [523, 784, 1046], tremoloHz: 2.33, depth: 0.85, vol: 0.68,
    extraFilter: "aecho=0.3:0.2:15:0.4",
  },
  {
    id: "hype-3", storagePath: "system/music/hype-drop-the-beat.mp3",
    freqs: [494, 740, 988], tremoloHz: 2.25, depth: 0.82, vol: 0.72,
    extraFilter: "aecho=0.5:0.4:25:0.6",
  },
  {
    id: "hype-4", storagePath: "system/music/hype-fire-starter.mp3",
    freqs: [554, 831, 1108], tremoloHz: 2.37, depth: 0.88, vol: 0.66,
    extraFilter: "aecho=0.4:0.3:18:0.45",
  },
  {
    id: "hype-5", storagePath: "system/music/hype-turbo-boost.mp3",
    freqs: [466, 699, 932], tremoloHz: 2.30, depth: 0.84, vol: 0.71,
    extraFilter: "aecho=0.35:0.25:22:0.5",
  },
  {
    id: "hype-6", storagePath: "system/music/hype-maximum-overdrive.mp3",
    freqs: [587, 880, 1174], tremoloHz: 2.42, depth: 0.90, vol: 0.65,
    extraFilter: "aecho=0.45:0.35:12:0.55",
  },

  // ── Cinematic (slow, epic, BPM 68-80) ──────────────────────────────────────
  {
    id: "cine-1", storagePath: "system/music/cine-epic-journey.mp3",
    freqs: [220, 330, 440], tremoloHz: 1.33, depth: 0.45, vol: 0.65,
    extraFilter: "aecho=0.8:0.6:80:0.7",
  },
  {
    id: "cine-2", storagePath: "system/music/cine-dreamscape.mp3",
    freqs: [196, 294, 392], tremoloHz: 1.20, depth: 0.40, vol: 0.62,
    extraFilter: "aecho=0.9:0.7:100:0.75",
  },
  {
    id: "cine-3", storagePath: "system/music/cine-golden-hour.mp3",
    freqs: [247, 370, 494], tremoloHz: 1.27, depth: 0.42, vol: 0.64,
    extraFilter: "aecho=0.85:0.65:90:0.72",
  },
  {
    id: "cine-4", storagePath: "system/music/cine-horizon.mp3",
    freqs: [185, 277, 370], tremoloHz: 1.13, depth: 0.38, vol: 0.60,
    extraFilter: "aecho=0.95:0.75:110:0.78",
  },
  {
    id: "cine-5", storagePath: "system/music/cine-midnight-bloom.mp3",
    freqs: [233, 349, 466], tremoloHz: 1.23, depth: 0.43, vol: 0.63,
    extraFilter: "aecho=0.88:0.68:95:0.74",
  },
  {
    id: "cine-6", storagePath: "system/music/cine-celestial.mp3",
    freqs: [207, 311, 415], tremoloHz: 1.17, depth: 0.41, vol: 0.61,
    extraFilter: "aecho=0.92:0.72:105:0.76",
  },

  // ── Talking Head / Lo-fi (warm, medium tempo, BPM 82-92) ───────────────────
  {
    id: "talk-1", storagePath: "system/music/talk-upbeat-chillhop.mp3",
    freqs: [330, 415, 523], tremoloHz: 1.47, depth: 0.35, vol: 0.60,
    extraFilter: "lowpass=f=2000,aecho=0.6:0.4:50:0.55",
  },
  {
    id: "talk-2", storagePath: "system/music/talk-coffee-ideas.mp3",
    freqs: [311, 392, 494], tremoloHz: 1.40, depth: 0.32, vol: 0.58,
    extraFilter: "lowpass=f=1800,aecho=0.65:0.45:55:0.58",
  },
  {
    id: "talk-3", storagePath: "system/music/talk-focused-flow.mp3",
    freqs: [349, 440, 554], tremoloHz: 1.50, depth: 0.36, vol: 0.61,
    extraFilter: "lowpass=f=2200,aecho=0.55:0.38:45:0.52",
  },
  {
    id: "talk-4", storagePath: "system/music/talk-easy-groove.mp3",
    freqs: [293, 370, 466], tremoloHz: 1.43, depth: 0.33, vol: 0.59,
    extraFilter: "lowpass=f=1900,aecho=0.62:0.42:52:0.56",
  },
  {
    id: "talk-5", storagePath: "system/music/talk-soft-bounce.mp3",
    freqs: [277, 349, 440], tremoloHz: 1.37, depth: 0.30, vol: 0.57,
    extraFilter: "lowpass=f=1700,aecho=0.7:0.5:60:0.60",
  },
  {
    id: "talk-6", storagePath: "system/music/talk-workspace-vibes.mp3",
    freqs: [370, 466, 587], tremoloHz: 1.53, depth: 0.38, vol: 0.62,
    extraFilter: "lowpass=f=2400,aecho=0.5:0.35:40:0.50",
  },

  // ── TikTok Hook / Pop (bright, upbeat, BPM 116-126) ────────────────────────
  {
    id: "tiktok-1", storagePath: "system/music/tiktok-trending-now.mp3",
    freqs: [523, 784, 1046], tremoloHz: 2.00, depth: 0.65, vol: 0.68,
    extraFilter: "aecho=0.5:0.3:30:0.5",
  },
  {
    id: "tiktok-2", storagePath: "system/music/tiktok-viral-energy.mp3",
    freqs: [494, 740, 988], tremoloHz: 1.97, depth: 0.62, vol: 0.67,
    extraFilter: "aecho=0.45:0.28:28:0.48",
  },
  {
    id: "tiktok-3", storagePath: "system/music/tiktok-hook-loop.mp3",
    freqs: [554, 831, 1108], tremoloHz: 2.03, depth: 0.68, vol: 0.69,
    extraFilter: "aecho=0.55:0.32:32:0.52",
  },
  {
    id: "tiktok-4", storagePath: "system/music/tiktok-dopamine-drop.mp3",
    freqs: [587, 880, 1174], tremoloHz: 2.07, depth: 0.70, vol: 0.70,
    extraFilter: "aecho=0.48:0.30:26:0.50",
  },
  {
    id: "tiktok-5", storagePath: "system/music/tiktok-fyp-ready.mp3",
    freqs: [466, 699, 932], tremoloHz: 1.93, depth: 0.60, vol: 0.66,
    extraFilter: "aecho=0.52:0.31:34:0.51",
  },
  {
    id: "tiktok-6", storagePath: "system/music/tiktok-scroll-stopper.mp3",
    freqs: [622, 932, 1244], tremoloHz: 2.10, depth: 0.72, vol: 0.71,
    extraFilter: "aecho=0.42:0.27:24:0.46",
  },
];

// ── Audio generation ──────────────────────────────────────────────────────────

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-600)}`));
    });
  });
}

/**
 * Generates a 60-second stereo MP3 by layering three sine waves and applying
 * genre-appropriate tremolo + echo effects.
 */
async function generateTrackMp3(spec: TrackSpec, outPath: string): Promise<void> {
  const [f1, f2, f3] = spec.freqs;
  const filterChain = [
    // Mix three layered sine waves (main instrument, 5th harmony, octave)
    // via aevalsrc — one expression per channel (L, R) for stereo
    // The three waves are at 1:0.6:0.35 relative amplitude for a natural blend
    `aevalsrc='sin(2*PI*${f1}*t) + 0.6*sin(2*PI*${f2}*t) + 0.35*sin(2*PI*${f3}*t)|sin(2*PI*${f1}*t+0.05) + 0.6*sin(2*PI*${f2}*t-0.05) + 0.35*sin(2*PI*${f3}*t)':c=stereo:s=44100`,
  ];

  // Build AF chain: tremolo → genre effect → final volume
  const afParts: string[] = [
    `tremolo=f=${spec.tremoloHz.toFixed(3)}:d=${spec.depth.toFixed(2)}`,
  ];
  if (spec.extraFilter) afParts.push(spec.extraFilter);
  afParts.push(`volume=${spec.vol.toFixed(2)}`);
  const af = afParts.join(",");

  await runFfmpeg([
    "-f", "lavfi",
    "-i", filterChain[0],
    "-af", af,
    "-t", "60",
    "-codec:a", "libmp3lame",
    "-q:a", "4",           // VBR ~128 kbps → ~960 KB per file
    "-y",
    outPath,
  ]);
}

// ── Upload ─────────────────────────────────────────────────────────────────────

async function uploadTrack(spec: TrackSpec, localPath: string): Promise<void> {
  const bytes = await readFile(localPath);
  const { error } = await supabase.storage
    .from("studio")
    .upload(spec.storagePath, bytes, {
      contentType: "audio/mpeg",
      upsert: true,
    });
  if (error) throw new Error(`Upload failed for ${spec.id}: ${error.message}`);
}

// ── Smoke-verify signed URL ───────────────────────────────────────────────────

async function verifySignedUrl(storagePath: string): Promise<void> {
  const { data, error } = await supabase.storage
    .from("studio")
    .createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) {
    throw new Error(`signedAutocutUrl returned null for ${storagePath}: ${error?.message}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const dir = await mkdtemp(join(tmpdir(), "aurora-music-gen-"));
  console.log(`Working directory: ${dir}`);

  try {
    let passed = 0;
    let failed = 0;

    for (const spec of TRACKS) {
      const outPath = join(dir, `${spec.id}.mp3`);
      process.stdout.write(`  ${spec.id.padEnd(10)} generating … `);

      try {
        await generateTrackMp3(spec, outPath);
        const bytes = await readFile(outPath);
        const kb = Math.round(bytes.length / 1024);
        process.stdout.write(`${kb} KB  uploading … `);

        if (kb > 5120) {
          throw new Error(`File too large: ${kb} KB (limit 5120 KB)`);
        }

        await uploadTrack(spec, outPath);
        process.stdout.write(`verifying … `);

        await verifySignedUrl(spec.storagePath);
        console.log("✓");
        passed++;
      } catch (err) {
        console.log(`✗  ${(err as Error).message}`);
        failed++;
      }
    }

    console.log(`\nDone: ${passed} uploaded, ${failed} failed.`);
    if (failed > 0) process.exit(1);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
