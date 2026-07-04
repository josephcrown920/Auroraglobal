/**
 * On-demand video watermark proxy.
 * Fetches the original video, pipes through FFmpeg's drawtext filter to bake
 * in the AURORA watermark, and streams the result back.  Raw provider URLs
 * are never sent to the client — only the watermarked copy.
 *
 * Authentication: HMAC signed token (same scheme as watermark-image).
 * Caching:        1-hour private cache, matching the token TTL.
 */
import { createFileRoute } from "@tanstack/react-router";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { writeFile, unlink } from "fs/promises";
import { execFileSync } from "child_process";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWatermarkToken } from "@/lib/watermark-token.server";

// Discover a usable TTF font for drawtext at module-load time (cached).
let _fontPath: string | undefined;
function getFontPath(): string {
  if (_fontPath !== undefined) return _fontPath;
  try {
    const r = execFileSync("fc-match", ["--format=%{file}", "sans-bold"], {
      encoding: "utf8",
      timeout: 2_000,
    }).trim();
    if (r && (r.endsWith(".ttf") || r.endsWith(".otf"))) {
      return (_fontPath = r);
    }
  } catch {
    // fc-match unavailable — fall through to the nix-store search below
  }
  try {
    const r = execFileSync("bash", [
      "-c",
      "find /nix/store -name '*.ttf' 2>/dev/null | grep -iE 'sans|free|deja|ubuntu|liberation' | head -1",
    ], { encoding: "utf8", timeout: 3_000 }).trim();
    if (r) return (_fontPath = r);
  } catch {
    // nix-store search unavailable — fall back to FFmpeg's built-in default
  }
  return (_fontPath = ""); // let FFmpeg try its built-in default
}

/**
 * Run FFmpeg to bake an "AURORA" drawtext watermark into the input video.
 * Reads from tmpInput, streams output to stdout, returns the Buffer.
 */
async function watermarkVideoBuffer(tmpInput: string): Promise<Buffer> {
  const fontPath = getFontPath();
  // Colons in font paths must be escaped in FFmpeg filter strings.
  const escapedFont = fontPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
  const fontPart = escapedFont ? `fontfile=${escapedFont}:` : "";

  const drawText = [
    `drawtext=${fontPart}text='AURORA'`,
    "fontcolor=white@0.4",
    "fontsize=48",
    "x=(w-text_w)/2",
    "y=(h-text_h)/2",
    "shadowcolor=black@0.3",
    "shadowx=2",
    "shadowy=2",
  ].join(":");

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const proc = spawn(
      "ffmpeg",
      [
        "-y",
        "-i", tmpInput,
        "-vf", drawText,
        "-c:a", "copy",
        "-t", "300",           // max 5 minutes — safety cap
        "-f", "mp4",
        "-movflags", "frag_keyframe+empty_moov",
        "pipe:1",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    const killTimer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("FFmpeg timed out after 2 minutes"));
    }, 120_000);

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", () => {}); // consume stderr without logging
    proc.on("close", (code) => {
      clearTimeout(killTimer);
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
    proc.on("error", (err) => {
      clearTimeout(killTimer);
      reject(err);
    });
  });
}

export const Route = createFileRoute("/api/public/watermark-video")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        const uid = url.searchParams.get("uid");
        const tok = url.searchParams.get("tok");

        if (!id || !uid || !tok) {
          return new Response("Missing parameters", { status: 400 });
        }
        if (!verifyWatermarkToken(tok, uid, id)) {
          return new Response("Unauthorized", { status: 403 });
        }

        // Fetch generation — ownership enforced by user_id filter.
        const { data: gen } = await supabaseAdmin
          .from("generations")
          .select("id, result_video_url, is_watermarked, user_id")
          .eq("id", id)
          .eq("user_id", uid)
          .maybeSingle() as {
            data: {
              id: string;
              result_video_url: string | null;
              is_watermarked: boolean;
              user_id: string;
            } | null;
          };

        if (!gen) return new Response("Not found", { status: 404 });
        if (!gen.result_video_url) return new Response("No video", { status: 404 });
        if (!gen.is_watermarked) return new Response("Forbidden", { status: 403 });

        // Download the raw video to a temp file.
        const tmpInput = join(tmpdir(), `wm-in-${id}.mp4`);
        let downloaded = false;
        try {
          const videoRes = await fetch(gen.result_video_url, {
            headers: { "User-Agent": "Aurora/1.0" },
            signal: AbortSignal.timeout(60_000),
          });
          if (!videoRes.ok) {
            return new Response("Upstream video fetch failed", { status: 502 });
          }
          const buf = Buffer.from(await videoRes.arrayBuffer());
          await writeFile(tmpInput, buf);
          downloaded = true;
        } catch {
          return new Response("Video fetch failed", { status: 502 });
        }

        // Transcode with FFmpeg drawtext watermark.
        let watermarked: Buffer;
        try {
          watermarked = await watermarkVideoBuffer(tmpInput);
        } catch (err) {
          console.error("[watermark-video] FFmpeg error:", (err as Error).message);
          return new Response("Watermark processing failed", { status: 500 });
        } finally {
          if (downloaded) unlink(tmpInput).catch(() => {}); // non-blocking cleanup
        }

        // Wrap in Blob (valid BodyInit). Cast required because Buffer<ArrayBufferLike>
        // doesn't satisfy BlobPart in stricter TS configs, but is valid at runtime.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const body = new Blob([watermarked as any], { type: "video/mp4" });
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": String(watermarked.byteLength),
            // Cache 1 hour — token TTL matches, so no stale serves.
            "Cache-Control": "private, max-age=3600",
            "X-Watermarked": "1",
          },
        });
      },
    },
  },
});
