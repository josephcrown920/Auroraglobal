import { createServerFn } from "@tanstack/react-start";

/**
 * Generate dynamic Open Graph images for social sharing.
 * Used for:
 * - /r/$token share pages (render preview)
 * - /studio, /canvas, /ugc, /lipsync, /colors routes
 */

export type OGImageInput = {
  type: "share" | "route" | "profile";
  title: string;
  description?: string;
  imageUrl?: string; // existing preview image to embed
  route?: string; // /studio, /canvas, etc.
  user?: string;
};

/**
 * Generate a dynamic OG image (PNG) for social sharing.
 * Uses a serverless image generation API (e.g., Vercel OG, Satori).
 *
 * For production: integrate with a service like:
 * - Vercel OG (https://vercel.com/docs/functions/og-image-generation)
 * - Satori (HTML → PNG via @vercel/og)
 * - Cloudinary (dynamic URL-based generation)
 */
export async function generateOGImage(input: OGImageInput): Promise<string> {
  const { type, title, description, imageUrl, route } = input;

  // For now: return a placeholder URL
  // In production, generate via Vercel OG or similar

  if (type === "share" && imageUrl) {
    // If there's an existing render image, use it directly
    return imageUrl;
  }

  // Build a descriptive OG image URL
  // e.g., https://aurorastudiostar.lovable.app/api/og?title=...&description=...&route=...
  const params = new URLSearchParams({
    title,
    ...(description && { description }),
    ...(route && { route }),
    type,
  });

  return `https://aurorastudiostar.lovable.app/api/og?${params.toString()}`;
}

/**
 * Server function to generate and cache OG image metadata.
 * Called during generation completion or share creation.
 */
export const cacheOGMetadata = createServerFn({ method: "POST" })
  .inputValidator((input: { generationId: string; kind: string; prompt: string; imageUrl?: string }) => input)
  .handler(async ({ data: input }) => {
    const ogImageUrl = await generateOGImage({
      type: "share",
      title: `Aurora ${input.kind === "video" ? "Video" : "Image"} — ${input.prompt.slice(0, 60)}`,
      description: input.prompt.slice(0, 160),
      imageUrl: input.imageUrl,
    });
    return { ogImageUrl };
  });

