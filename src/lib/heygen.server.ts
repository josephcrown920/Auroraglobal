import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * HeyGen video generation adapter.
 * Generates avatar-based videos from scripts or audio.
 * Docs: https://docs.heygen.com/reference/create-an-avatar-video-v2
 *
 * NOTE: this previously called fabricated endpoints (`/v1/video_requests.submit`,
 * `X-HEYGEN-API-KEY` header, made-up avatar/voice IDs like "josh_lite") that
 * don't exist on HeyGen's real API and always failed. Rewritten against the
 * actual documented v2 endpoints below.
 */

const HeyGenRequestSchema = z.object({
  avatarId: z.string().optional(), // real id from GET /v2/avatars — resolved automatically if omitted
  scriptText: z.string().optional(),
  voiceId: z.string().optional(), // real id from GET /v2/voices (or the avatar's default_voice_id)
  backgroundColor: z.string().optional(), // hex, e.g. "#FFFFFF"
  /** Product Demo mode (Task #276): screenshot URLs shown as visual context
   *  alongside the avatar's narration. HeyGen's avatar video API doesn't take
   *  extra inline images per scene, so these are currently informational only. */
  photoUrls: z.array(z.string().url()).max(12).optional(),
});

export type HeyGenRequest = z.infer<typeof HeyGenRequestSchema>;

interface HeyGenVideoResponse {
  video_id: string;
  video_url: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: number;
}

const HEYGEN_API = "https://api.heygen.com";

function heygenHeaders(): Record<string, string> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error("HeyGen API key not configured");
  return { "X-Api-Key": apiKey, "Content-Type": "application/json" };
}

interface HeygenAvatar {
  avatar_id: string;
  avatar_name: string;
  default_voice_id?: string;
  type?: string;
}

let avatarCache: HeygenAvatar[] | null = null;
let avatarCacheAt = 0;

/**
 * List real avatars available on this HeyGen account (GET /v2/avatars).
 * Cached for an hour — this is a catalog call, not per-request state.
 */
export async function listHeygenAvatars(): Promise<HeygenAvatar[]> {
  if (avatarCache && Date.now() - avatarCacheAt < 60 * 60_000) return avatarCache;
  const res = await fetch(`${HEYGEN_API}/v2/avatars`, { headers: heygenHeaders() });
  if (!res.ok) throw new Error(`HeyGen avatars ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { data?: { avatars?: HeygenAvatar[] } };
  avatarCache = j.data?.avatars ?? [];
  avatarCacheAt = Date.now();
  return avatarCache;
}

/** Resolve a usable (avatarId, voiceId) pair, defaulting to the first public avatar. */
async function resolveAvatarAndVoice(avatarId?: string, voiceId?: string): Promise<{ avatarId: string; voiceId: string }> {
  if (avatarId && voiceId) return { avatarId, voiceId };
  const avatars = await listHeygenAvatars();
  const pick = (avatarId && avatars.find((a) => a.avatar_id === avatarId)) ||
    avatars.find((a) => a.type === "public" && a.default_voice_id) ||
    avatars[0];
  if (!pick) throw new Error("HeyGen: no avatars available on this account");
  return { avatarId: pick.avatar_id, voiceId: voiceId || pick.default_voice_id || "" };
}

/**
 * Submit a video generation request to HeyGen (POST /v2/video/generate).
 * Returns a video_id for polling status.
 */
export async function submitHeyGenVideo(
  req: HeyGenRequest
): Promise<{ videoId: string; status: string }> {
  if (!req.scriptText?.trim()) throw new Error("HeyGen: scriptText is required (script-driven avatar video)");
  const { avatarId, voiceId } = await resolveAvatarAndVoice(req.avatarId, req.voiceId);
  if (!voiceId) throw new Error("HeyGen: could not resolve a voice_id for this avatar");

  const payload = {
    title: "Aurora Video",
    video_inputs: [
      {
        character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
        voice: { type: "text", input_text: req.scriptText, voice_id: voiceId },
        ...(req.backgroundColor ? { background: { type: "color", value: req.backgroundColor } } : {}),
      },
    ],
    dimension: { width: 720, height: 1280 },
  };

  const response = await fetch(`${HEYGEN_API}/v2/video/generate`, {
    method: "POST",
    headers: heygenHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HeyGen submission failed [${response.status}]: ${(await response.text()).slice(0, 300)}`);
  }

  const data = (await response.json()) as { data: { video_id: string } };
  return { videoId: data.data.video_id, status: "pending" };
}

/**
 * Poll HeyGen for video status and retrieve download URL when complete
 * (GET /v2/videos/{video_id}).
 */
export async function pollHeyGenVideo(videoId: string): Promise<HeyGenVideoResponse> {
  const response = await fetch(`${HEYGEN_API}/v2/videos/${videoId}`, {
    method: "GET",
    headers: heygenHeaders(),
  });

  if (!response.ok) {
    throw new Error(`HeyGen poll failed [${response.status}]: ${(await response.text()).slice(0, 300)}`);
  }

  const j = (await response.json()) as {
    data: { video_id: string; status: string; video_url?: string; created_at?: number; error?: { message?: string } };
  };
  const d = j.data;
  if (d.status === "failed") {
    throw new Error(`HeyGen video failed: ${d.error?.message ?? "unknown"}`);
  }
  return {
    video_id: d.video_id,
    video_url: d.video_url ?? null,
    status: (["pending", "processing", "completed", "failed"].includes(d.status) ? d.status : "pending") as HeyGenVideoResponse["status"],
    created_at: d.created_at ?? Date.now() / 1000,
  };
}

/**
 * Product Demo (Task #276) duration presets, following HeyGen's avatar-video
 * guidance: pick a target length + rough word budget so the prompt builder
 * can size the walkthrough per feature.
 */
export const PRODUCT_DEMO_DURATIONS = [
  { id: "quick", label: "Quick overview", seconds: 30 },
  { id: "walkthrough", label: "Feature walkthrough", seconds: 75 },
  { id: "deep_dive", label: "Deep dive", seconds: 150 },
  { id: "whats_new", label: "What's new", seconds: 40 },
] as const;
export type ProductDemoDurationId = (typeof PRODUCT_DEMO_DURATIONS)[number]["id"];

export type ProductDemoFeature = {
  name: string;
  description?: string;
  screenshotUrl?: string;
};

/**
 * Build a Hook → Feature walkthrough → CTA structured script from a product
 * name + ordered feature list. Deliberately server-side and structured (not
 * user-free-typed) so every demo follows the same proven pattern. This text
 * is passed directly as HeyGen's `voice.input_text` (real API has no separate
 * "video agent" auto-scripting mode — the avatar reads exactly this script).
 */
export function buildProductDemoScript(input: {
  productName: string;
  features: ProductDemoFeature[];
  durationPresetId?: ProductDemoDurationId;
  audience?: string;
}): string {
  const preset =
    PRODUCT_DEMO_DURATIONS.find((d) => d.id === input.durationPresetId) ?? PRODUCT_DEMO_DURATIONS[1];
  const who = input.audience?.trim() ? ` for ${input.audience.trim()}` : "";

  const hook = `Hey! Let me show you ${input.productName}${who} — here's what makes it worth your time.`;

  const walkthrough = input.features
    .filter((f) => f.name?.trim())
    .map((f, i) => {
      const desc = f.description?.trim();
      return `${i + 1}. ${f.name.trim()}${desc ? ` — ${desc}` : ""}.`;
    })
    .join(" ");

  const cta = `That's ${input.productName} in a nutshell. Try it today and see the difference for yourself.`;

  return [hook, walkthrough, cta].filter(Boolean).join(" ").slice(0, 1500);
  // Target length (~${preset.seconds}s) is guidance for the caller when
  // trimming features, not sent to HeyGen — the real API has no duration param.
}

/**
 * Server function: generate a video via HeyGen
 */
export const generateHeyGenVideo = createServerFn({ method: "POST" })
  .inputValidator((input: HeyGenRequest) => HeyGenRequestSchema.parse(input))
  .handler(async ({ data: validated }) => {
    try {
      const { videoId } = await submitHeyGenVideo(validated);
      const video = await pollHeyGenVideo(videoId);
      if (video.status === "pending" || video.status === "processing") {
        return { videoId, status: "pending" as const, videoUrl: null };
      }
      return { videoId, status: video.status, videoUrl: video.video_url };
    } catch (err) {
      throw new Error(`HeyGen generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
