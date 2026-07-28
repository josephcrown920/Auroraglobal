/**
 * Converts an internal storage object path to an absolute public URL so that
 * external AI providers (Fal, Kling, Sync, HeyGen, etc.) can fetch the asset.
 *
 * Paths that already look like absolute URLs are returned unchanged.
 *
 * Examples:
 *   "/api/storage/objects/uploads/abc-123"
 *   → "https://my-app.replit.dev/api/storage/objects/uploads/abc-123"
 *
 *   "https://example.com/video.mp4" → unchanged
 *   null / undefined → returned as-is
 */
export function toAbsoluteMediaUrl(
  url: string | null | undefined,
): string | null | undefined {
  if (!url) return url;

  // Already absolute — nothing to do
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  // Convert relative internal storage path to absolute URL
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (!domain) {
    console.warn(
      "[mediaUrl] REPLIT_DOMAINS not set; cannot absolutize storage path:",
      url,
    );
    return url;
  }

  // Ensure the path starts with a slash
  const path = url.startsWith("/") ? url : `/${url}`;
  return `https://${domain}${path}`;
}
