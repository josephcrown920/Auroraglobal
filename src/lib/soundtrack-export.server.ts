import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FFMPEG_TIMEOUT_MS = 180_000;
const MAX_SOUNDTRACK_BYTES = 80 * 1024 * 1024;

export type SoundtrackSettings = {
  offsetSec: number;
  trimStartSec: number;
  trimEndSec: number;
  volume: number;
  mode: "mix" | "replace";
};

function runBinary(bin: "ffmpeg" | "ffprobe", args: string[], timeoutMs = FFMPEG_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    const process = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    process.stdout.on("data", (data: Buffer) => (stdout += data.toString()));
    process.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
      if (stderr.length > 4_000) stderr = stderr.slice(-4_000);
    });
    const timer = setTimeout(() => {
      process.kill("SIGKILL");
      reject(new Error(`${bin} timed out`));
    }, timeoutMs);
    process.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    process.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`${bin} exited ${code}: ${stderr.slice(-600)}`));
    });
  });
}

async function durationSec(path: string): Promise<number> {
  const output = await runBinary("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", path,
  ], 15_000);
  const duration = Number.parseFloat(output.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Could not read media duration");
  return duration;
}

async function assertAudioStream(path: string): Promise<void> {
  const output = await runBinary("ffprobe", [
    "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type",
    "-of", "csv=p=0", path,
  ], 15_000);
  if (output.trim() !== "audio") throw new Error("The selected soundtrack is not a valid audio file");
}

export function assertOwnedSoundtrackPath(path: string, userId: string): void {
  if (
    !path.startsWith(`${userId}/`) ||
    path.includes("..") ||
    path.startsWith("/") ||
    path.length > 500
  ) {
    throw new Error("Soundtrack does not belong to this account");
  }
}

async function downloadOwnedSoundtrack(path: string, userId: string): Promise<Buffer> {
  assertOwnedSoundtrackPath(path, userId);
  const { data, error } = await supabaseAdmin.storage.from("studio").download(path);
  if (error || !data) throw new Error("Could not load soundtrack from private storage");
  if (data.size > MAX_SOUNDTRACK_BYTES) throw new Error("Soundtrack is too large (80 MB maximum)");
  return Buffer.from(await data.arrayBuffer());
}

/** Muxes a durable, user-owned soundtrack into an already assembled MP4. */
export async function muxOwnedSoundtrack(params: {
  video: Buffer;
  soundtrackPath: string;
  userId: string;
  settings: SoundtrackSettings;
}): Promise<Buffer> {
  const audio = await downloadOwnedSoundtrack(params.soundtrackPath, params.userId);
  const dir = await mkdtemp(join(tmpdir(), "aurora-soundtrack-"));
  try {
    const videoPath = join(dir, "assembled.mp4");
    const audioPath = join(dir, "soundtrack");
    const outputPath = join(dir, "muxed.mp4");
    await Promise.all([writeFile(videoPath, params.video), writeFile(audioPath, audio)]);
    await assertAudioStream(audioPath);
    const [videoDuration, audioDuration] = await Promise.all([
      durationSec(videoPath),
      durationSec(audioPath),
    ]);
    const trimEndAt = audioDuration - params.settings.trimEndSec;
    if (trimEndAt <= params.settings.trimStartSec) {
      throw new Error("Soundtrack trims remove the entire track");
    }
    const delayMs = Math.round(params.settings.offsetSec * 1_000);
    const trackFilter =
      `[1:a]atrim=start=${params.settings.trimStartSec}:end=${trimEndAt},` +
      `asetpts=PTS-STARTPTS,volume=${params.settings.volume},` +
      `adelay=${delayMs}:all=1,apad,atrim=duration=${videoDuration}[track]`;
    const filter = params.settings.mode === "mix"
      ? `${trackFilter};[0:a][track]amix=inputs=2:duration=first:dropout_transition=0[a]`
      : `${trackFilter}`;
    await runBinary("ffmpeg", [
      "-y", "-i", videoPath, "-i", audioPath,
      "-filter_complex", filter,
      "-map", "0:v:0", "-map", params.settings.mode === "mix" ? "[a]" : "[track]",
      "-c:v", "copy", "-c:a", "aac", "-ar", "48000", "-ac", "2",
      "-t", String(videoDuration), "-movflags", "+faststart", outputPath,
    ]);
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Persists an export privately and returns a short-lived retrieval URL. */
export async function persistPrivateEditorExport(
  userId: string,
  sessionId: string,
  bytes: Buffer,
): Promise<{ resultPath: string; resultUrl: string }> {
  const resultPath = `${userId}/${sessionId}.mp4`;
  const { error } = await supabaseAdmin.storage
    .from("editor-exports")
    .upload(resultPath, bytes, { contentType: "video/mp4", upsert: true });
  if (error) throw new Error(`Editor export upload failed: ${error.message}`);
  const { data, error: signError } = await supabaseAdmin.storage
    .from("editor-exports")
    .createSignedUrl(resultPath, 60 * 60);
  if (signError || !data?.signedUrl) throw new Error("Could not create export download URL");
  return { resultPath, resultUrl: data.signedUrl };
}

export async function signPrivateEditorExport(path: string, userId: string): Promise<string> {
  assertOwnedSoundtrackPath(path, userId);
  const { data, error } = await supabaseAdmin.storage.from("editor-exports").createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) throw new Error("Could not retrieve export");
  return data.signedUrl;
}