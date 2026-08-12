/**
 * Faststart video proxy for mobile playback.
 *
 * iOS AVPlayer needs the MP4 moov atom BEFORE mdat (+faststart) to play a
 * progressive stream — provider-generated MP4s often put it last, which shows
 * up as a black frame / silent failure in the mobile gallery viewer.
 *
 * GET /api/public/faststart-video?id=<generationId>
 *   - Bearer auth (Supabase access token) — the generation must belong to the
 *     caller, so there is no raw-URL SSRF surface at all.
 *   - Downloads the stored output, checks top-level box order, and remuxes
 *     with `ffmpeg -c copy -movflags +faststart` ONLY when moov trails mdat.
 *   - Serves with single-range 206 support (AVPlayer probes with Range).
 *   - Caches the faststart copy under /tmp keyed by generation id.
 */
import { createFileRoute } from "@tanstack/react-router";
import { execFile } from "child_process";
import { createHash } from "crypto";
import { readFile, writeFile, unlink, stat, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isTrustedUrl } from "@/lib/url-guard";

const execFileAsync = promisify(execFile);

const CACHE_DIR = join(tmpdir(), "faststart-cache");
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — matches signed-URL lifetimes
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB safety cap

/**
 * Scan top-level MP4 boxes and report whether moov appears before mdat.
 * Returns null when the buffer doesn't parse as an ISO-BMFF file (e.g. webm)
 * — callers should pass such payloads through untouched.
 */
export function moovBeforeMdat(buf: Buffer): boolean | null {
  let off = 0;
  let sawFtyp = false;
  while (off + 8 <= buf.length) {
    let size = buf.readUInt32BE(off);
    const type = buf.toString("latin1", off + 4, off + 8);
    if (!/^[\x20-\x7e]{4}$/.test(type)) return null; // not a box header
    if (size === 1) {
      // 64-bit largesize
      if (off + 16 > buf.length) return null;
      const big = buf.readBigUInt64BE(off + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(big);
    } else if (size === 0) {
      // box extends to EOF
      size = buf.length - off;
    }
    if (size < 8) return null;
    if (type === "ftyp") sawFtyp = true;
    if (type === "moov") return true;
    if (type === "mdat") return sawFtyp ? false : null;
    off += size;
  }
  return null;
}

async function remuxFaststart(input: Buffer, cacheKey: string): Promise<Buffer> {
  const inPath = join(tmpdir(), `fs-in-${cacheKey}.mp4`);
  const outPath = join(tmpdir(), `fs-out-${cacheKey}.mp4`);
  try {
    await writeFile(inPath, input);
    // -c copy: pure remux, no re-encode. +faststart relocates moov in a
    // second pass, so the output MUST be a seekable file (never a pipe).
    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", inPath, "-c", "copy", "-movflags", "+faststart", "-f", "mp4", outPath],
      { timeout: 120_000, maxBuffer: 4 * 1024 * 1024 },
    );
    return await readFile(outPath);
  } finally {
    unlink(inPath).catch(() => {});
    unlink(outPath).catch(() => {});
  }
}

function respondWithRange(request: Request, body: Buffer, extra: Record<string, string>) {
  const base = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    ...extra,
  };
  const range = request.headers.get("range");
  const m = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] !== "" || m[2] !== "")) {
    let start: number;
    let end: number;
    if (m[1] === "") {
      // suffix range: last N bytes
      const n = Number(m[2]);
      if (n === 0) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${body.byteLength}` } });
      start = Math.max(0, body.byteLength - n);
      end = body.byteLength - 1;
    } else {
      start = Number(m[1]);
      end = m[2] === "" ? body.byteLength - 1 : Math.min(Number(m[2]), body.byteLength - 1);
    }
    if (start > end || start >= body.byteLength) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${body.byteLength}` } });
    }
    const slice = body.subarray(start, end + 1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Buffer is a valid BlobPart at runtime
    return new Response(new Blob([slice as any], { type: "video/mp4" }), {
      status: 206,
      headers: {
        ...base,
        "Content-Range": `bytes ${start}-${end}/${body.byteLength}`,
        "Content-Length": String(slice.byteLength),
      },
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Buffer is a valid BlobPart at runtime
  return new Response(new Blob([body as any], { type: "video/mp4" }), {
    status: 200,
    headers: { ...base, "Content-Length": String(body.byteLength) },
  });
}

export const Route = createFileRoute("/api/public/faststart-video")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return new Response("Missing id", { status: 400 });

        const h = request.headers.get("authorization") || request.headers.get("Authorization");
        if (!h?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const { data: auth, error: authErr } = await supabaseAdmin.auth.getUser(h.slice(7));
        if (authErr || !auth.user) return new Response("Unauthorized", { status: 401 });

        // Ownership enforced by the user_id filter — no cross-user playback.
        // Prefer the primary video result; fall back to the motion pass so
        // motion-only generations (image + added camera movement) also play.
        const { data: gen } = await supabaseAdmin
          .from("generations")
          .select("id, result_video_url, motion_video_url, user_id")
          .eq("id", id)
          .eq("user_id", auth.user.id)
          .maybeSingle();
        const videoUrl = gen?.result_video_url ?? gen?.motion_video_url;
        if (!gen || !videoUrl) return new Response("Not found", { status: 404 });
        if (!isTrustedUrl(videoUrl)) return new Response("Untrusted source", { status: 502 });

        // Serve from the /tmp cache when fresh.
        const cacheKey = createHash("sha256").update(`${gen.id}:${videoUrl}`).digest("hex").slice(0, 24);
        const cachePath = join(CACHE_DIR, `${cacheKey}.mp4`);
        try {
          const st = await stat(cachePath);
          if (Date.now() - st.mtimeMs < CACHE_TTL_MS) {
            return respondWithRange(request, await readFile(cachePath), { "X-Faststart": "cache" });
          }
        } catch {
          // cache miss — fall through
        }

        let raw: Buffer;
        try {
          const res = await fetch(videoUrl, {
            headers: { "User-Agent": "Aurora/1.0" },
            signal: AbortSignal.timeout(60_000),
          });
          if (!res.ok) return new Response("Upstream fetch failed", { status: 502 });
          const len = Number(res.headers.get("content-length") || 0);
          if (len > MAX_VIDEO_BYTES) return new Response("Video too large", { status: 413 });
          raw = Buffer.from(await res.arrayBuffer());
          if (raw.byteLength > MAX_VIDEO_BYTES) return new Response("Video too large", { status: 413 });
        } catch {
          return new Response("Upstream fetch failed", { status: 502 });
        }

        const order = moovBeforeMdat(raw);
        let body = raw;
        let mode = "passthrough";
        if (order === false) {
          try {
            body = await remuxFaststart(raw, cacheKey);
            mode = "remuxed";
          } catch (err) {
            console.error("[faststart-video] remux failed:", (err as Error).message);
            // Explicit failure beats silently serving a file iOS can't play.
            return new Response("Remux failed", { status: 500 });
          }
        }

        // Best-effort cache write; playback must not depend on it.
        mkdir(CACHE_DIR, { recursive: true })
          .then(() => writeFile(cachePath, body))
          .catch(() => {});

        return respondWithRange(request, body, { "X-Faststart": mode });
      },
    },
  },
});
