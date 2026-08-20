import { tiktokConfigured } from "./tiktok-posting.server";

const TIKTOK_MARKETING_SPARK_URL = "https://business-api.tiktok.com/open_api/v1.3/tt_video/authorize/";
const SPARK_WINDOW_MS = 60_000;
const SPARK_MAX_REQUESTS_PER_WINDOW = 4;
const sparkAttempts = new Map<string, number[]>();

function assertSparkRequestRate(userId: string) {
  const now = Date.now();
  const recent = (sparkAttempts.get(userId) ?? []).filter((at) => now - at < SPARK_WINDOW_MS);
  if (recent.length >= SPARK_MAX_REQUESTS_PER_WINDOW) {
    throw new Error("Too many Spark code requests. Wait a minute and try again.");
  }
  recent.push(now);
  sparkAttempts.set(userId, recent);
}

export function tiktokSparkConfigured() {
  return !!(
    tiktokConfigured() &&
    process.env.TIKTOK_ADVERTISER_ID &&
    process.env.TIKTOK_MARKETING_ACCESS_TOKEN
  );
}

/**
 * Only full public post URLs carry the item id needed by the Marketing API.
 * Short redirect links are deliberately rejected instead of fetching a
 * user-supplied URL server-side.
 */
export function parseTiktokPostId(postUrl: string): string {
  const url = new URL(postUrl);
  const allowedHost = /(^|\.)tiktok\.com$/i.test(url.hostname);
  if (!allowedHost) throw new Error("Use a public TikTok post URL.");

  const match = url.pathname.match(/\/video\/(\d{10,})/);
  if (!match) {
    throw new Error("Paste the full TikTok post URL (for example tiktok.com/@creator/video/123…). Short links are not supported.");
  }
  return match[1];
}

export async function createTiktokSparkAuthorizationCode(userId: string, postUrl: string) {
  if (!tiktokConfigured()) {
    throw new Error("TikTok is not configured on this server.");
  }
  if (!tiktokSparkConfigured()) {
    throw new Error("TikTok Marketing API Spark authorization is not configured. Add TIKTOK_ADVERTISER_ID and a Marketing API access token authorized for that advertiser before generating codes.");
  }

  const itemId = parseTiktokPostId(postUrl);
  // The creator connection can be used to make a bounded number of downstream
  // Marketing API calls per minute. This in-memory guard is deliberately a
  // second line of defense behind TikTok's own API limits; it fails closed
  // before we refresh a token or contact TikTok.
  assertSparkRequestRate(userId);
  const response = await fetch(TIKTOK_MARKETING_SPARK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // This is deliberately a Business/Marketing API credential rather than
      // the user's Content Posting OAuth token. Those APIs use separate scopes
      // and treating one as the other reliably fails in production.
      "Access-Token": process.env.TIKTOK_MARKETING_ACCESS_TOKEN!,
    },
    body: JSON.stringify({
      advertiser_id: process.env.TIKTOK_ADVERTISER_ID,
      tiktok_item_id: itemId,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const payload = await response.json().catch(() => null) as {
    code?: number;
    message?: string;
    data?: { authorization_code?: string; auth_code?: string; code?: string; expires_in?: number };
  } | null;
  if (!response.ok || payload?.code !== 0) {
    throw new Error(`TikTok Spark authorization failed: ${payload?.message ?? `HTTP ${response.status}`}`);
  }

  const authorizationCode =
    payload?.data?.authorization_code ?? payload?.data?.auth_code ?? payload?.data?.code;
  if (!authorizationCode) {
    throw new Error("TikTok Marketing API did not return a Spark authorization code.");
  }
  return { authorizationCode, expiresIn: payload?.data?.expires_in ?? null, postId: itemId };
}