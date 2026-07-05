// Shared SSRF guard used by every server-side fetch that touches a
// user-supplied URL (reference images, audio, video, end-frame, etc.).
// Keep this list narrow — additions widen our SSRF surface.

const ALLOWED_HOST_SUFFIXES = [
  ".supabase.co",
  ".supabase.in",
  ".lovable.app",
  ".lovable.dev",
  ".replicate.delivery",
  ".replicate.com",
  "api.sync.so",
  ".sync.so",
  "storage.googleapis.com",
  ".googleusercontent.com",
  ".r2.cloudflarestorage.com",
  ".amazonaws.com",
  ".fal.media",
  ".fal.ai",
  // Self-hosted GPU workers upload results to these public CDNs by default
  // (see `AURORA_UPLOAD=catbox` in the worker notebook).
  "files.catbox.moe",
  "0x0.st",
];

export function assertTrustedUrl(raw: string): void {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("URL scheme not allowed");
  }
  const host = u.hostname.toLowerCase();
  // Block private IPv4 ranges, loopback, link-local, IPv6 loopback, and cloud metadata endpoints.
  if (
    /^(?:127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0|::1|localhost)/i.test(host) ||
    /^172\.(?:1[6-9]|2\d|3[0-1])\./.test(host) ||
    host === "metadata.google.internal"
  ) {
    throw new Error("URL host not allowed");
  }
  const ok = ALLOWED_HOST_SUFFIXES.some((s) =>
    s.startsWith(".") ? host.endsWith(s) || host === s.slice(1) : host === s,
  );
  if (!ok) throw new Error("URL host not allowed");
}

export function isTrustedUrl(raw: string): boolean {
  try {
    assertTrustedUrl(raw);
    return true;
  } catch {
    return false;
  }
}
/**
 * Photo-editor input guard: the URL must be a Supabase storage object in the
 * `studio` bucket whose top-level folder is the caller's own user id — prevents
 * editing (and re-hosting) other users' assets by URL. Runs the SSRF guard
 * first so only trusted hosts ever reach the path check.
 */
export function assertOwnStudioUpload(raw: string, userId: string): void {
  assertTrustedUrl(raw);
  const u = new URL(raw);
  const m = u.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/studio\/(.+)$/);
  if (!m) throw new Error("Upload the photo to Aurora first, then edit it.");
  // Reject traversal / re-encoding tricks outright — a `..` or a still-encoded
  // slash/dot in the object path can only be an attempt to escape the folder.
  if (/(?:^|\/)\.\.(?:\/|$)|%2f|%2e/i.test(m[1])) throw new Error("Invalid photo URL");
  const owner = decodeURIComponent(m[1]).split("/")[0];
  if (owner !== userId) throw new Error("Not your photo");
}
