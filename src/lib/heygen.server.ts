import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * HeyGen video generation adapter.
 * Generates avatar-based videos from scripts or audio.
 * Docs: https://docs.heygen.ai/reference/video-generation
 */

const HeyGenRequestSchema = z.object({
  avatarId: z.string(), // e.g., "josh_lite", "emily_pro"
  scriptText: z.string().optional(),
  voiceId: z.string().optional(), // e.g., "en_male_1"
  backgroundId: z.string().optional(), // e.g., "virtual-office", "beach"
});

export type HeyGenRequest = z.infer<typeof HeyGenRequestSchema>;

interface HeyGenVideoResponse {
  video_id: string;
  video_url: string;
  status: "pending" | "completed" | "failed";
  created_at: string;
}

/**
 * Submit a video generation request to HeyGen.
 * Returns a video_id for polling status.
 */
export async function submitHeyGenVideo(
  req: HeyGenRequest
): Promise<{ videoId: string; status: string }> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error("HeyGen API key not configured");

  const payload = {
    video_id: `aurora_${Date.now()}`,
    avatar_id: req.avatarId,
    ...(req.scriptText && { script: { type: "text", input: req.scriptText } }),
    ...(req.voiceId && { voice: { voice_id: req.voiceId } }),
    ...(req.backgroundId && { background_id: req.backgroundId }),
  };

  const response = await fetch("https://api.heygen.com/v1/video_requests.submit", {
    method: "POST",
    headers: {
      "X-HEYGEN-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`HeyGen submission failed: ${err.message}`);
  }

  const data = (await response.json()) as { data: { video_id: string } };
  return { videoId: data.data.video_id, status: "pending" };
}

/**
 * Poll HeyGen for video status and retrieve download URL when complete.
 */
export async function pollHeyGenVideo(videoId: string): Promise<HeyGenVideoResponse> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error("HeyGen API key not configured");

  const response = await fetch(`https://api.heygen.com/v1/video_requests.get?video_id=${videoId}`, {
    method: "GET",
    headers: {
      "X-HEYGEN-API-KEY": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`HeyGen poll failed: ${response.statusText}`);
  }

  const data = (await response.json()) as { data: HeyGenVideoResponse };
  return data.data;
}

/**
 * HeyGen avatars catalog (for UI selector)
 */
export const HEYGEN_AVATARS = [
  {
    id: "josh_lite",
    name: "Josh",
    description: "Professional male avatar",
    imageUrl: "https://cdn.heygen.ai/avatars/josh_lite.png",
  },
  {
    id: "emily_lite",
    name: "Emily",
    description: "Professional female avatar",
    imageUrl: "https://cdn.heygen.ai/avatars/emily_lite.png",
  },
  {
    id: "michael_pro",
    name: "Michael",
    description: "Corporate executive avatar",
    imageUrl: "https://cdn.heygen.ai/avatars/michael_pro.png",
  },
  {
    id: "jessica_pro",
    name: "Jessica",
    description: "Casual professional avatar",
    imageUrl: "https://cdn.heygen.ai/avatars/jessica_pro.png",
  },
];

/**
 * HeyGen voice presets
 */
export const HEYGEN_VOICES = [
  { id: "en_male_1", name: "Male 1 (US)", lang: "en" },
  { id: "en_female_1", name: "Female 1 (US)", lang: "en" },
  { id: "en_male_2", name: "Male 2 (British)", lang: "en" },
  { id: "en_female_2", name: "Female 2 (British)", lang: "en" },
];

/**
 * HeyGen background presets
 */
export const HEYGEN_BACKGROUNDS = [
  { id: "office", name: "Office", description: "Modern office environment" },
  { id: "beach", name: "Beach", description: "Sandy beach backdrop" },
  { id: "conference", name: "Conference", description: "Corporate conference room" },
  { id: "studio", name: "Studio", description: "Professional studio" },
  { id: "virtual_bg", name: "Virtual Background", description: "Customizable virtual bg" },
];

/**
 * Server function: generate a video via HeyGen
 */
export const generateHeyGenVideo = createServerFn({ method: "POST" })
  .inputValidator((input: HeyGenRequest) => HeyGenRequestSchema.parse(input))
  .handler(async ({ data: validated }) => {
    try {
      const { videoId } = await submitHeyGenVideo(validated);
      const video = await pollHeyGenVideo(videoId);
      if (video.status === "pending") {
        return { videoId, status: "pending" as const, videoUrl: null };
      }
      return { videoId, status: video.status, videoUrl: video.video_url };
    } catch (err) {
      throw new Error(`HeyGen generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

