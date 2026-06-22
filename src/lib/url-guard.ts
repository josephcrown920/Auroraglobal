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