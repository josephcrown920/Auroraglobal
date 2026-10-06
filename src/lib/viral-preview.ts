import { z } from "zod";

export const ViralPreviewInputSchema = z.object({
  topic: z.string().trim().min(1).max(120),
});

function stableSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildViralPreviewUrl(topic: string): string {
  const normalized = ViralPreviewInputSchema.parse({ topic }).topic;
  const prompt = [
    `A scroll-stopping TikTok campaign still about ${normalized}`,
    "vertical 9:16 creator content",
    "one confident creator in a candid moment",
    "premium social media photography",
    "cinematic natural light",
    "photorealistic",
    "no text",
    "no logos",
    "no watermark",
  ].join(", ");

  const params = new URLSearchParams({
    width: "720",
    height: "1280",
    seed: String(stableSeed(normalized.toLowerCase())),
    nologo: "true",
    enhance: "false",
  });

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
}