// Output compression before storage — task #153 cost guardrail.
//
// No raw provider output is stored unprocessed: every stored result is run
// through a compression pass first (images → lossy WebP, videos → H.264 CRF
// re-encode), both via the system ffmpeg binary (works identically under the
// node dev server and the bun test runner — no native npm modules). We keep
// whichever output is smaller.
//
// Failure policy: a delivered render the user was already charged for must
// NEVER be lost, so on any compression failure we store the ORIGINAL bytes and
// log the failure loudly. That is an explicit, observable fallback — not a
// silent one.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type CompressedOutput = {
  bytes: Buffer;
  mime: string;
  ext: string;
  /** True when the stored bytes are the re-encoded (smaller) version. */
  compressed: boolean;
};

/** Image quality for the WebP pass — visually lossless for photo content. */
export const IMAGE_WEBP_QUALITY = "80";
const IMAGE_TIMEOUT_MS = 30_000;
/** ffmpeg re-encode settings: CRF 28 keeps social-media-grade quality. */
export const VIDEO_CRF = "28";
const VIDEO_TIMEOUT_MS = 120_000;

export function extFromMime(mime: string, fallback: string): string {
  return mime.split("/")[1]?.split("+")[0] || fallback;
}

export async function compressImageBytes(
  bytes: Buffer,
  mime: string,
): Promise<CompressedOutput> {
  const original: CompressedOutput = {
    bytes,
    mime: mime || "image/png",
    ext: extFromMime(mime || "image/png", "png"),
    compressed: false,
  };
  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "aurora-compress-"));
    const inPath = join(dir, `in.${original.ext}`);
    const outPath = join(dir, "out.webp");
    await writeFile(inPath, bytes);
    await runFfmpeg(
      ["-y", "-i", inPath, "-frames:v", "1", "-c:v", "libwebp", "-quality", IMAGE_WEBP_QUALITY, outPath],
      IMAGE_TIMEOUT_MS,
    );
    const out = await readFile(outPath);
    if (out.length > 0 && out.length < bytes.length) {
      return { bytes: out, mime: "image/webp", ext: "webp", compressed: true };
    }
    return original;
  } catch (e) {
    console.error("[compress] image compression failed — storing original bytes", e);
    return original;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function compressVideoBytes(
  bytes: Buffer,
  mime: string,
): Promise<CompressedOutput> {
  const original: CompressedOutput = {
    bytes,
    mime: mime || "video/mp4",
    ext: "mp4",
    compressed: false,
  };
  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "aurora-compress-"));
    const inPath = join(dir, "in.mp4");
    const outPath = join(dir, "out.mp4");
    await writeFile(inPath, bytes);
    await runFfmpeg(
      [
        "-y",
        "-i",
        inPath,
        "-c:v",
        "libx264",
        "-crf",
        VIDEO_CRF,
        "-preset",
        "veryfast",
        "-movflags",
        "+faststart",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        outPath,
      ],
      VIDEO_TIMEOUT_MS,
    );
    const out = await readFile(outPath);
    if (out.length > 0 && out.length < bytes.length) {
      return { bytes: out, mime: "video/mp4", ext: "mp4", compressed: true };
    }
    return original;
  } catch (e) {
    console.error("[compress] video compression failed — storing original bytes", e);
    return original;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

function runFfmpeg(args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("ffmpeg timed out"));
    }, timeoutMs);
    proc.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}
