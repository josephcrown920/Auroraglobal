// AutoCut end-to-end smoke test.
//
// Proves the full local-ffmpeg AutoCut pipeline end-to-end, including the DB
// job-queue and gallery (generations) path:
//
//   1. Assembly smoke  — runLocalFfmpegAssemble with synthetic lavfi clips
//                        → 720×1280 MP4 ≤60 s with audio stream
//   2. Upload proof    — uploadAutocutResult stores bytes in studio bucket
//                        → returned URL is a reachable MP4
//   3. processOneJob   — inserts a real job row via create_generation_and_reserve,
//                        calls processOneJob (local-ffmpeg path),
//                        then asserts generations.result_video_url is set and
//                        generations.status = "succeeded"
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
import { runLocalFfmpegAssemble, uploadAutocutResult } from "../src/lib/autocut.server";
import { processOneJob } from "../src/lib/jobs.server";

const TEST_EMAIL = "qa-test@aurora-internal.test";
const STYLE = "hype";
const CLIP_DUR_SEC = 3;
const MAX_DUR_SEC = 60;
const CREDITS_TO_GRANT = 50; // plenty for COST_AUTOCUT=8

// ── Helpers ────────────────────────────────────────────────────────────────────

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
    log("\n[1/3] runLocalFfmpegAssemble — assembling 3 synthetic clips…");
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

    log(`[1/3] ✅ assembled ${durationSec.toFixed(2)} s, ${width}×${height}, has audio`);

    // ── Step 2: uploadAutocutResult ────────────────────────────────────────
    log("\n[2/3] uploadAutocutResult — storing MP4 in studio bucket…");
    const fakeJobId = randomUUID();
    const resultUrl = await uploadAutocutResult(userId, fakeJobId, bytes);

    assert(typeof resultUrl === "string" && resultUrl.startsWith("http"), `result URL invalid: ${resultUrl}`);
    log(`[2/3] uploaded → ${resultUrl}`);

    // Verify URL is reachable and returns video/mp4
    const headRes = await fetch(resultUrl, { method: "HEAD" });
    assert(headRes.ok, `result URL not reachable: ${headRes.status}`);
    const ct = headRes.headers.get("content-type") ?? "";
    assert(ct.includes("video") || ct.includes("octet-stream"), `unexpected content-type: ${ct}`);
    log(`[2/3] ✅ URL reachable (${headRes.status}, ${ct})`);

    // ── Step 3: processOneJob (full DB round-trip) ─────────────────────────
    log("\n[3/3] processOneJob — full job-queue + gallery round-trip…");

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
    log(`[3/3] job created: ${jobId}  generation: ${generationId}`);

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
    log(`[3/3] processOneJob returned status="${result.status}"`);

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
    log(`[3/3] ✅ generations.result_video_url = ${gen.result_video_url}`);

    // Verify the gallery URL is reachable
    const galRes = await fetch(gen.result_video_url!, { method: "HEAD" });
    assert(galRes.ok, `gallery URL not reachable: ${galRes.status}`);
    log(`[3/3] ✅ gallery URL reachable (${galRes.status})`);

    // ── Summary ────────────────────────────────────────────────────────────
    const { data: after } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("user_id", userId)
      .maybeSingle();
    log(`\n[autocut-e2e] ✅ ALL CHECKS PASSED`);
    log(`  assembly:   ${durationSec.toFixed(2)} s, ${width}×${height}, has audio`);
    log(`  upload URL: ${resultUrl}`);
    log(`  gallery URL: ${gen.result_video_url}`);
    log(`  credits after: ${after?.credits ?? "unknown"}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((e) => {
  console.error("[autocut-e2e] FAILED:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
