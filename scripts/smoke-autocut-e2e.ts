// AutoCut end-to-end smoke test.
//
// Proves the full local-ffmpeg AutoCut pipeline end-to-end, including the DB
// job-queue and gallery (generations) path:
//
//   1. Assembly smoke  — runLocalFfmpegAssemble with synthetic lavfi clips
//                        → 720×1280 MP4 ≤60 s with audio stream
//   2. Music-mix smoke — runLocalFfmpegAssemble with SILENT clips + a real
//                        stored music track → output must be audibly non-silent
//                        (any audio can only come from the looped/ducked music)
//   3. Upload proof    — uploadAutocutResult stores bytes in studio bucket
//                        → returned URL is a reachable MP4
//   4. processOneJob   — inserts a real job row via create_generation_and_reserve,
//                        calls processOneJob (local-ffmpeg path),
//                        then asserts generations.result_video_url is set and
//                        generations.status = "succeeded"
//   5. processOneJob   — second job WITH musicTrackId set to a real stored
//      (music)           track and SILENT source clips; downloads the gallery
//                        MP4 and verifies it is audible (music survived the
//                        full queue path) and respects the 60 s cap
//
// Run:
//   bun run scripts/smoke-autocut-e2e.ts
//
// The script creates and cleans up all test data in the qa-test Supabase user's
// namespace.  It does NOT require CONFIRM_SPEND because AutoCut uses the local
// ffmpeg assembler (no paid provider / GPU worker involved); credits are
// reserved and immediately committed by finalize_job.

import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import {
  runLocalFfmpegAssemble,
  uploadAutocutResult,
  getMusicTrack,
  signedAutocutUrl,
} from "../src/lib/autocut.server";
import { processOneJob } from "../src/lib/jobs.server";

const TEST_EMAIL = "qa-test@aurora-internal.test";
const STYLE = "hype";
// Real catalog track whose MP3 must exist in the studio bucket (see
// MUSIC_TRACKS in autocut.server.ts). The same id is used by the job-queue
// round-trip in step 5, mirroring what the AutoCut UI sends.
const MUSIC_SMOKE_TRACK_ID = "hype-1";
const CLIP_DUR_SEC = 3;
const MAX_DUR_SEC = 60;
const CREDITS_TO_GRANT = 50; // plenty for COST_AUTOCUT=8

// ── Helpers ────────────────────────────────────────────────────────────────────

async function makeSyntheticClip(
  outPath: string,
  durationSec: number,
  color: string,
  opts?: { silent?: boolean },
): Promise<void> {
  const args = [
    "-y",
    "-f", "lavfi", "-i", `color=c=${color}:size=640x360:rate=24:duration=${durationSec}`,
  ];
  // Silent clips carry NO audio stream at all — used by the music-mix smoke so
  // any audio in the assembled output can only have come from the music track.
  if (!opts?.silent) {
    args.push("-f", "lavfi", "-i", `sine=frequency=440:sample_rate=48000:duration=${durationSec}`);
  }
  args.push("-t", String(durationSec), "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p");
  if (!opts?.silent) args.push("-c:a", "aac", "-ar", "48000", "-ac", "2");
  args.push(outPath);
  await new Promise<void>((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
  });
}

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

async function ffprobeProps(path: string): Promise<{
  durationSec: number;
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
    proc.on("close", (code) => (code === 0 ? resolve(stdout) : reject(new Error(`ffprobe ${code}`))));
  });
  const data = JSON.parse(raw) as {
    streams: Array<{ codec_type: string; width?: number; height?: number }>;
    format: { duration?: string };
  };
  const video = data.streams.find((s) => s.codec_type === "video");
  const audio = data.streams.find((s) => s.codec_type === "audio");
  return {
    durationSec: parseFloat(data.format?.duration ?? "0"),
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    hasAudio: !!audio,
  };
}

/** Mean loudness of a file's audio via ffmpeg volumedetect. Pure digital
 * silence reports ≈ -91 dB (or -inf); anything with real music content sits
 * far above that. */
async function meanVolumeDb(path: string): Promise<number> {
  const stderr = await new Promise<string>((resolve, reject) => {
    const proc = spawn(
      "ffmpeg",
      ["-i", path, "-af", "volumedetect", "-f", "null", "-"],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let err = "";
    proc.stderr?.on("data", (d: Buffer) => (err += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0 ? resolve(err) : reject(new Error(`volumedetect exited ${code}: ${err.slice(-300)}`)),
    );
  });
  const m = stderr.match(/mean_volume:\s*(-?[\d.]+|-inf)\s*dB/);
  if (!m) throw new Error("volumedetect: mean_volume not found in ffmpeg output");
  return m[1] === "-inf" ? -99 : parseFloat(m[1]);
}

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(`[FAIL] ${msg}`);
}

function log(msg: string) {
  console.log(msg);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  log("[autocut-e2e] starting");

  // ── Preflight: resolve test user ───────────────────────────────────────────
  const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);
  const user = listData.users.find((u) => u.email === TEST_EMAIL);
  if (!user) {
    throw new Error(
      `test user ${TEST_EMAIL} not found — create it in Supabase Auth first`,
    );
  }
  const userId = user.id;
  log(`[autocut-e2e] test user: ${userId}`);

  // Ensure enough credits for the test
  const { error: creditErr } = await supabaseAdmin
    .from("profiles")
    .upsert({ user_id: userId, credits: CREDITS_TO_GRANT }, { onConflict: "user_id" });
  if (creditErr) throw new Error(`credit top-up: ${creditErr.message}`);
  log(`[autocut-e2e] credits set to ${CREDITS_TO_GRANT}`);

  // ── Temp dir + synthetic clips ─────────────────────────────────────────────
  const testDir = await mkdtemp(join(tmpdir(), "aurora-autocut-e2e-"));
  const { server, baseUrl } = await startClipServer(testDir);

  try {
    log("[autocut-e2e] generating synthetic clips…");
    await Promise.all([
      makeSyntheticClip(join(testDir, "clip0.mp4"), CLIP_DUR_SEC, "0xff0000"),
      makeSyntheticClip(join(testDir, "clip1.mp4"), CLIP_DUR_SEC, "0x00ff00"),
      makeSyntheticClip(join(testDir, "clip2.mp4"), CLIP_DUR_SEC, "0x0000ff"),
    ]);
    const clipUrls = [0, 1, 2].map((i) => `${baseUrl}/clip${i}.mp4`);
    log(`[autocut-e2e] serving clips at ${baseUrl}`);

    // ── Step 1: runLocalFfmpegAssemble ─────────────────────────────────────
    log("\n[1/5] runLocalFfmpegAssemble — assembling 3 synthetic clips…");
    const bytes = await runLocalFfmpegAssemble({
      clips: clipUrls,
      style: STYLE,
      maxDurationSec: MAX_DUR_SEC,
    });

    assert(bytes instanceof Buffer, "result must be a Buffer");
    assert(bytes.length > 10_000, "result must be non-trivial (>10 KB)");

    const tmpMp4 = join(testDir, "assembled.mp4");
    await writeFile(tmpMp4, bytes);
    const { durationSec, width, height, hasAudio } = await ffprobeProps(tmpMp4);

    assert(width === 720, `width must be 720 (got ${width})`);
    assert(height === 1280, `height must be 1280 (got ${height})`);
    assert(durationSec > 0, `duration must be > 0 (got ${durationSec})`);
    assert(durationSec <= MAX_DUR_SEC + 1, `duration must be ≤ ${MAX_DUR_SEC}s (got ${durationSec.toFixed(2)}s)`);
    assert(hasAudio, "output must have an audio stream (original clip audio preserved)");

    log(`[1/5] ✅ assembled ${durationSec.toFixed(2)} s, ${width}×${height}, has audio`);

    // ── Step 2: runLocalFfmpegAssemble WITH music (mix proof) ──────────────
    log("\n[2/5] runLocalFfmpegAssemble + music — mixing a real stored track…");
    const track = getMusicTrack(MUSIC_SMOKE_TRACK_ID);
    assert(track !== undefined, `music track ${MUSIC_SMOKE_TRACK_ID} must exist in MUSIC_TRACKS`);
    const musicUrl = await signedAutocutUrl(track.storagePath, 3600);
    assert(
      typeof musicUrl === "string" && musicUrl.startsWith("http"),
      `music MP3 must exist in storage at ${track.storagePath} (signedAutocutUrl returned null — upload the real tracks first)`,
    );
    log(`[2/5] track "${track.label}" signed OK`);

    // Source clips are SILENT (no audio stream at all): any audible output can
    // only come from the looped/ducked music — proving the amix actually ran.
    await Promise.all([
      makeSyntheticClip(join(testDir, "silent0.mp4"), CLIP_DUR_SEC, "0xffff00", { silent: true }),
      makeSyntheticClip(join(testDir, "silent1.mp4"), CLIP_DUR_SEC, "0x00ffff", { silent: true }),
    ]);
    const silentClipUrls = [`${baseUrl}/silent0.mp4`, `${baseUrl}/silent1.mp4`];
    const musicBytes = await runLocalFfmpegAssemble({
      clips: silentClipUrls,
      style: STYLE,
      musicUrl,
      maxDurationSec: MAX_DUR_SEC,
    });
    const musicMp4 = join(testDir, "assembled-music.mp4");
    await writeFile(musicMp4, musicBytes);
    const musicProps = await ffprobeProps(musicMp4);
    assert(musicProps.hasAudio, "music-mix output must have an audio stream");
    assert(
      musicProps.durationSec > 0 && musicProps.durationSec <= MAX_DUR_SEC + 1,
      `music-mix duration must be ≤ ${MAX_DUR_SEC}s (got ${musicProps.durationSec.toFixed(2)}s)`,
    );
    const meanDb = await meanVolumeDb(musicMp4);
    assert(
      meanDb > -60,
      `music must be audible in the mix (mean_volume ${meanDb.toFixed(1)} dB from silent source clips — music was NOT mixed)`,
    );
    log(
      `[2/5] ✅ music mixed: ${musicProps.durationSec.toFixed(2)} s, mean_volume ${meanDb.toFixed(1)} dB (source clips silent)`,
    );

    // ── Step 3: uploadAutocutResult ────────────────────────────────────────
    log("\n[3/5] uploadAutocutResult — storing MP4 in studio bucket…");
    const fakeJobId = randomUUID();
    const resultUrl = await uploadAutocutResult(userId, fakeJobId, bytes);

    assert(typeof resultUrl === "string" && resultUrl.startsWith("http"), `result URL invalid: ${resultUrl}`);
    log(`[3/5] uploaded → ${resultUrl}`);

    // Verify URL is reachable and returns video/mp4
    const headRes = await fetch(resultUrl, { method: "HEAD" });
    assert(headRes.ok, `result URL not reachable: ${headRes.status}`);
    const ct = headRes.headers.get("content-type") ?? "";
    assert(ct.includes("video") || ct.includes("octet-stream"), `unexpected content-type: ${ct}`);
    log(`[3/5] ✅ URL reachable (${headRes.status}, ${ct})`);

    // ── Step 3: processOneJob (full DB round-trip) ─────────────────────────
    log("\n[4/5] processOneJob — full job-queue + gallery round-trip…");

    // Create job+generation via the canonical RPC so finalize_job works
    const client = supabaseAdmin as unknown as {
      rpc: (
        n: string,
        a: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: rpcOut, error: rpcErr } = await client.rpc("create_generation_and_reserve", {
      _user: userId,
      _kind: "autocut",
      _prompt: `autocut:${STYLE}`,
      _amount: 8, // COST_AUTOCUT
      _payload: {
        clipUrls,
        clipPaths: [],
        style: STYLE,
        musicTrackId: null,
        aspect: "9:16",
      },
    });
    if (rpcErr) throw new Error(`create_generation_and_reserve: ${rpcErr.message}`);

    const row = Array.isArray(rpcOut) ? (rpcOut[0] as Record<string, string>) : (rpcOut as Record<string, string>);
    const jobId = row.job_id;
    const generationId = row.generation_id;
    assert(typeof jobId === "string", `job_id must be a string (got ${JSON.stringify(jobId)})`);
    assert(typeof generationId === "string", `generation_id must be a string`);
    log(`[4/5] job created: ${jobId}  generation: ${generationId}`);

    // Run the job — local ffmpeg path (no active GPU workers in dev environment)
    const workerId = `e2e-test-${randomUUID().slice(0, 8)}`;
    const result = await processOneJob(workerId);

    assert(result.processed, `processOneJob must process a job (got processed=false)`);
    assert(
      result.jobId === jobId,
      `processOneJob must have claimed our job (claimed ${result.jobId ?? "none"}, expected ${jobId})`,
    );
    const succeeded = result.status === "succeeded";
    if (!succeeded) {
      throw new Error(
        `processOneJob returned status="${result.status}" (error: ${result.error ?? "none"})`,
      );
    }
    log(`[4/5] processOneJob returned status="${result.status}"`);

    // Verify the generations row has result_video_url set
    const { data: gen, error: genErr } = await supabaseAdmin
      .from("generations")
      .select("status, result_video_url, result_image_url")
      .eq("id", generationId)
      .maybeSingle();
    if (genErr) throw new Error(`generations select: ${genErr.message}`);

    assert(gen !== null, "generations row must exist after processOneJob");
    assert(gen.status === "succeeded", `generations.status must be "succeeded" (got "${gen.status}")`);
    assert(
      typeof gen.result_video_url === "string" && gen.result_video_url.startsWith("http"),
      `generations.result_video_url must be set (got ${JSON.stringify(gen.result_video_url)})`,
    );
    assert(
      gen.result_image_url === null,
      `generations.result_image_url must be null for autocut — URL goes in result_video_url`,
    );
    log(`[4/5] ✅ generations.result_video_url = ${gen.result_video_url}`);

    // Verify the gallery URL is reachable
    const galRes = await fetch(gen.result_video_url!, { method: "HEAD" });
    assert(galRes.ok, `gallery URL not reachable: ${galRes.status}`);
    log(`[4/5] ✅ gallery URL reachable (${galRes.status})`);

    // ── Step 5: processOneJob WITH musicTrackId (music-mix round-trip) ─────
    // Uses the SILENT clips: the gallery MP4 can only be audible if the
    // selected musicTrackId survived the whole queue path (payload →
    // runAutocut → getMusicTrack → signedAutocutUrl → amix). With sine-audio
    // clips, a regression that silently drops musicTrackId would still pass.
    log("\n[5/5] processOneJob + musicTrackId — music-mix job through the queue…");
    const { data: rpcOut2, error: rpcErr2 } = await client.rpc("create_generation_and_reserve", {
      _user: userId,
      _kind: "autocut",
      _prompt: `autocut:${STYLE}:music:${MUSIC_SMOKE_TRACK_ID}`,
      _amount: 8, // COST_AUTOCUT
      _payload: {
        clipUrls: silentClipUrls,
        clipPaths: [],
        style: STYLE,
        musicTrackId: MUSIC_SMOKE_TRACK_ID,
        aspect: "9:16",
      },
    });
    if (rpcErr2) throw new Error(`create_generation_and_reserve (music): ${rpcErr2.message}`);
    const row2 = Array.isArray(rpcOut2) ? (rpcOut2[0] as Record<string, string>) : (rpcOut2 as Record<string, string>);
    const jobId2 = row2.job_id;
    const generationId2 = row2.generation_id;
    assert(typeof jobId2 === "string", `music job_id must be a string (got ${JSON.stringify(jobId2)})`);
    assert(typeof generationId2 === "string", `music generation_id must be a string`);
    log(`[5/5] music job created: ${jobId2}  generation: ${generationId2}`);

    const result2 = await processOneJob(`e2e-test-${randomUUID().slice(0, 8)}`);
    assert(result2.processed, `processOneJob must process the music job (got processed=false)`);
    assert(
      result2.jobId === jobId2,
      `processOneJob must have claimed the music job (claimed ${result2.jobId ?? "none"}, expected ${jobId2})`,
    );
    if (result2.status !== "succeeded") {
      throw new Error(
        `music job: processOneJob returned status="${result2.status}" (error: ${result2.error ?? "none"})`,
      );
    }
    log(`[5/5] processOneJob returned status="${result2.status}"`);

    const { data: gen2, error: genErr2 } = await supabaseAdmin
      .from("generations")
      .select("status, result_video_url")
      .eq("id", generationId2)
      .maybeSingle();
    if (genErr2) throw new Error(`generations select (music): ${genErr2.message}`);
    assert(gen2 !== null, "music generations row must exist after processOneJob");
    assert(gen2.status === "succeeded", `music generations.status must be "succeeded" (got "${gen2.status}")`);
    assert(
      typeof gen2.result_video_url === "string" && gen2.result_video_url.startsWith("http"),
      `music generations.result_video_url must be set (got ${JSON.stringify(gen2.result_video_url)})`,
    );

    // Download the actual gallery MP4 and verify audio + the 60 s cap on it.
    const galleryRes = await fetch(gen2.result_video_url);
    assert(galleryRes.ok, `music gallery URL not reachable: ${galleryRes.status}`);
    const galleryMp4 = join(testDir, "gallery-music.mp4");
    await writeFile(galleryMp4, Buffer.from(await galleryRes.arrayBuffer()));
    const galleryProps = await ffprobeProps(galleryMp4);
    assert(galleryProps.hasAudio, "gallery music-mix MP4 must have an audio stream");
    assert(
      galleryProps.durationSec > 0 && galleryProps.durationSec <= MAX_DUR_SEC + 1,
      `gallery music-mix duration must be ≤ ${MAX_DUR_SEC}s (got ${galleryProps.durationSec.toFixed(2)}s)`,
    );
    // Source clips were silent → audible gallery output proves the SELECTED
    // track was actually mixed by the job runner, not just any audio present.
    const galleryDb = await meanVolumeDb(galleryMp4);
    assert(
      galleryDb > -60,
      `gallery music-mix MP4 must be audible (mean_volume ${galleryDb.toFixed(1)} dB from silent source clips — musicTrackId was dropped in the queue path)`,
    );
    log(
      `[5/5] ✅ gallery music MP4: ${galleryProps.durationSec.toFixed(2)} s, mean_volume ${galleryDb.toFixed(1)} dB → ${gen2.result_video_url}`,
    );

    // ── Summary ────────────────────────────────────────────────────────────
    const { data: after } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("user_id", userId)
      .maybeSingle();
    log(`\n[autocut-e2e] ✅ ALL CHECKS PASSED`);
    log(`  assembly:          ${durationSec.toFixed(2)} s, ${width}×${height}, has audio`);
    log(`  music mix:         ${musicProps.durationSec.toFixed(2)} s, mean_volume ${meanDb.toFixed(1)} dB (silent sources)`);
    log(`  upload URL:        ${resultUrl}`);
    log(`  gallery URL:       ${gen.result_video_url}`);
    log(`  music gallery URL: ${gen2.result_video_url}`);
    log(`  credits after:     ${after?.credits ?? "unknown"}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((e) => {
  console.error("[autocut-e2e] FAILED:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
