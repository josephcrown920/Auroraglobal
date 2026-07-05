import { createHmac } from "crypto";

const TTL_SECONDS = 3600; // 1 hour

function secret(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set — watermark token signing unavailable");
  return key;
}

/**
 * Sign a short-lived HMAC token that authorises serving the watermarked image
 * for a specific (userId, generationId) pair.  Used by listGallery / listGenerations
 * (server fns) to generate the URL, and by the watermark-image handler to verify it.
 */
export function signWatermarkToken(userId: string, generationId: string): string {
  const expiry = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = `${userId}:${generationId}:${expiry}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 32);
  return `${expiry}.${sig}`;
}

/**
 * Returns true iff the token was signed by this server, has not expired,
 * and covers exactly this (userId, generationId) pair.
 */
export function verifyWatermarkToken(token: string, userId: string, generationId: string): boolean {
  const dot = token.indexOf(".");
  if (dot === -1) return false;
  const expiry = parseInt(token.slice(0, dot), 10);
  const sig = token.slice(dot + 1);
  if (!expiry || Math.floor(Date.now() / 1000) > expiry) return false;
  const payload = `${userId}:${generationId}:${expiry}`;
  let expected: string;
  try {
    expected = createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 32);
  } catch {
    return false;
  }
  // Constant-time compare to prevent timing attacks.
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
