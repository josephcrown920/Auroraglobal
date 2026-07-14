import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Prime Director page video server functions.
 * Provides HeyGen avatar video generation and a free Pollinations keyframe
 * preview — mirroring the Prime Video Agent's video.functions.ts but wired
 * to Aurora's existing HEYGEN_API_KEY env var.
 */

const HEYGEN_API = "https://api.heygen.com";

function heygenHeaders(): Record<string, string> {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new Error("HEYGEN_API_KEY not configured");
  return { "X-Api-Key": key, "Content-Type": "application/json" };
}

// ── Generate a HeyGen talking-avatar video ────────────────────────────────

const GenerateHeygenInput = z.object({
  prompt: z.string().min(1).max(1500),
  aspect: z.string().default("9:16"),
  avatarId: z.string().optional(),
  voiceId: z.string().optional(),
});

export const generatePrimeHeygenVideo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => GenerateHeygenInput.parse(i))
  .handler(async ({ data }) => {
    const [w, h] =
      data.aspect === "16:9" ? [1280, 720] :
      data.aspect === "1:1"  ? [720, 720]  :
      data.aspect === "4:5"  ? [720, 900]  :
      [720, 1280];

    const avatar_id = data.avatarId ?? "Angela-inTshirt-20220820";
    const voice_id  = data.voiceId  ?? "1bd001e7e50f421d891986aad5158bc8";

    const res = await fetch(`${HEYGEN_API}/v2/video/generate`, {
      method: "POST",
      headers: heygenHeaders(),
      body: JSON.stringify({
        video_inputs: [{
          character: { type: "avatar", avatar_id, avatar_style: "normal" },
          voice: { type: "text", input_text: data.prompt.slice(0, 1500), voice_id },
        }],
        dimension: { width: w, height: h },
      }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`HeyGen ${res.status}: ${raw.slice(0, 300)}`);
    const json = JSON.parse(raw) as { data?: { video_id?: string } };
    const videoId = json.data?.video_id;
    if (!videoId) throw new Error("HeyGen: no video_id in response");
    return { videoId };
  });

// ── Poll HeyGen video status ──────────────────────────────────────────────

export const pollPrimeHeygenVideo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ videoId: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const res = await fetch(
      `${HEYGEN_API}/v1/video_status.get?video_id=${encodeURIComponent(data.videoId)}`,
      { headers: heygenHeaders() },
    );
    const raw = await res.text();
    if (!res.ok) throw new Error(`HeyGen status ${res.status}: ${raw.slice(0, 300)}`);
    const json = JSON.parse(raw) as {
      data?: { status?: string; video_url?: string; error?: unknown };
    };
    return {
      status: json.data?.status ?? "unknown",
      videoUrl: json.data?.video_url ?? null,
      error: json.data?.error
        ? String(JSON.stringify(json.data.error)).slice(0, 300)
        : null,
    };
  });

// ── Free preview via Pollinations (no key required) ───────────────────────

const FreePreviewInput = z.object({
  prompt: z.string().min(1),
  aspect: z.string().default("9:16"),
});

export const generatePrimeFreePreview = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => FreePreviewInput.parse(i))
  .handler(async ({ data }) => {
    const [w, h] =
      data.aspect === "16:9" ? [1280, 720] :
      data.aspect === "1:1"  ? [720, 720]  :
      data.aspect === "4:5"  ? [720, 900]  :
      [720, 1280];
    const seed = Math.floor(Math.random() * 1_000_000);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      data.prompt.slice(0, 400),
    )}?width=${w}&height=${h}&seed=${seed}&nologo=true`;
    return {
      previewUrl: url,
      note: "Free tier: keyframe via Pollinations. Configure HeyGen for full video.",
    };
  });
