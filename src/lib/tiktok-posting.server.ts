/**
 * TikTok Content Posting API — server-only helpers.
 *
 * Required environment variables (set by the owner in the secrets panel):
 *   TIKTOK_CLIENT_KEY    — app client_key from TikTok Developer portal
 *   TIKTOK_CLIENT_SECRET — app client_secret
 *
 * OAuth scopes needed on the TikTok app:
 *   user.info.basic, video.upload, video.publish
 *
 * Redirect URI to register in TikTok Developer portal:
 *   https://<your-domain>/api/public/tiktok/callback
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

// tiktok_accounts has extra columns (access_token, refresh_token, oauth_state,
// oauth_state_at) that are not yet in the generated Supabase types.
// Use a loose-typed chain for writes that reference those columns.
interface LooseTiktokChain {
  select(cols: string): LooseTiktokChain;
  insert(row: Record<string, unknown>): LooseTiktokChain;
  update(patch: Record<string, unknown>): LooseTiktokChain;
  upsert(row: Record<string, unknown>, opts?: { onConflict?: string }): LooseTiktokChain;
  delete(): LooseTiktokChain;
  eq(col: string, val: unknown): LooseTiktokChain;
  neq(col: string, val: unknown): LooseTiktokChain;
  maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }>;
  then<T>(onfulfilled?: ((value: { data: unknown; error: { message: string } | null }) => T | PromiseLike<T>) | null): Promise<T>;
}
function tiktokAccounts(): LooseTiktokChain {
  return (supabaseAdmin as unknown as { from(t: string): LooseTiktokChain }).from("tiktok_accounts");
}

const TIKTOK_AUTH_BASE = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_USER_URL = "https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name,username";
const TIKTOK_POST_URL = "https://open.tiktokapis.com/v2/post/publish/video/upload/";
const TIKTOK_STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

// Posting scopes + Display API scopes for the Promotion hub stats cards.
// Accounts connected before the Display scopes were added keep posting but
// get a "reconnect for stats" flag until they re-authorize.
const SCOPES = "user.info.basic,user.info.stats,video.upload,video.publish,video.list";

export function tiktokConfigured(): boolean {
  return !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

export function buildTiktokRedirectUri(origin: string): string {
  return `${origin}/api/public/tiktok/callback`;
}

/** Generate the TikTok OAuth authorization URL and write an ephemeral state row. */
export async function initiateTiktokOAuth(
  userId: string,
  origin: string,
  returnTo?: string,
): Promise<string> {
  if (!tiktokConfigured()) throw new Error("TikTok integration is not configured on this server.");
  const state = crypto.randomUUID();
  const redirectUri = buildTiktokRedirectUri(origin);
  // Only the two in-app pages that start a connect flow; anything else (or
  // absent) lands back on Settings like before.
  const safeReturnTo = returnTo === "/promotion" ? "/promotion" : "/settings";

  // Check if there is already a connected (non-pending) account.
  // If so, only update the oauth_state fields — preserve existing tokens so a
  // cancelled reconnect doesn't disconnect the user.
  const { data: existing } = await tiktokAccounts()
    .select("open_id")
    .eq("user_id", userId)
    .maybeSingle();

  const existingConnected =
    existing && (existing as { open_id: string }).open_id !== "pending";

  if (existingConnected) {
    // Preserve the existing connected account; only write the new CSRF state.
    await tiktokAccounts()
      .update({
        oauth_state: state,
        oauth_state_at: new Date().toISOString(),
        oauth_return_to: safeReturnTo,
      })
      .eq("user_id", userId);
  } else {
    // No connected account yet — upsert a pending placeholder row.
    await tiktokAccounts()
      .upsert(
        {
          user_id: userId,
          open_id: "pending",
          access_token: "pending",
          refresh_token: "pending",
          token_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
          refresh_expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
          oauth_state: state,
          oauth_state_at: new Date().toISOString(),
          oauth_return_to: safeReturnTo,
        },
        { onConflict: "user_id" },
      );
  }

  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    scope: SCOPES,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });
  return `${TIKTOK_AUTH_BASE}?${params}`;
}

/** Exchange an authorization code for tokens and persist the account row. */
export async function exchangeTiktokCode(
  code: string,
  state: string,
  origin: string,
): Promise<{ userId: string; displayName: string | null; returnTo: string }> {
  if (!tiktokConfigured()) throw new Error("TikTok integration is not configured.");

  // Find the pending row by state.
  const { data: pending } = await tiktokAccounts()
    .select("user_id, oauth_state_at, oauth_return_to")
    .eq("oauth_state", state)
    .maybeSingle();

  if (!pending) throw new Error("Invalid or expired OAuth state.");

  // State is valid for 10 minutes.
  const p = pending as {
    user_id: string;
    oauth_state_at: string;
    oauth_return_to: string | null;
  };
  const stateAge = Date.now() - new Date(p.oauth_state_at).getTime();
  if (stateAge > 10 * 60_000) throw new Error("OAuth state has expired. Please try connecting again.");

  const userId = p.user_id;
  const redirectUri = buildTiktokRedirectUri(origin);

  // Exchange code for tokens.
  const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    const txt = await tokenRes.text();
    throw new Error(`TikTok token exchange failed (${tokenRes.status}): ${txt.slice(0, 200)}`);
  }
  const tokenJson = await tokenRes.json();
  const td = tokenJson?.data;
  if (!td?.access_token) throw new Error("TikTok token response missing access_token.");

  const accessToken: string = td.access_token;
  const refreshToken: string = td.refresh_token;
  const expiresIn: number = td.expires_in ?? 86400;
  const refreshExpiresIn: number = td.refresh_expires_in ?? 31536000;
  const openId: string = td.open_id;
  const scope: string = td.scope ?? "";

  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const refreshExpiresAt = new Date(Date.now() + refreshExpiresIn * 1000).toISOString();

  // Fetch user info (display_name, avatar).
  let displayName: string | null = null;
  let avatarUrl: string | null = null;
  let username: string | null = null;
  try {
    const userRes = await fetch(TIKTOK_USER_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (userRes.ok) {
      const uj = await userRes.json();
      const ud = uj?.data?.user;
      displayName = ud?.display_name ?? null;
      avatarUrl = ud?.avatar_url ?? null;
      username = ud?.username ?? null;
    }
  } catch {
    // Non-fatal — we still have the token.
  }

  // Persist the complete account row.
  await tiktokAccounts()
    .update({
      open_id: openId,
      username,
      display_name: displayName,
      avatar_url: avatarUrl,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: tokenExpiresAt,
      refresh_expires_at: refreshExpiresAt,
      scope,
      oauth_state: null,
      oauth_state_at: null,
      oauth_return_to: null,
    })
    .eq("user_id", userId);

  return {
    userId,
    displayName,
    returnTo: p.oauth_return_to === "/promotion" ? "/promotion" : "/settings",
  };
}

/** Refresh the access token if it expires within the next 5 minutes. */
export async function ensureFreshToken(userId: string): Promise<string> {
  const { data: acc } = await tiktokAccounts()
    .select("access_token, refresh_token, token_expires_at, refresh_expires_at")
    .eq("user_id", userId)
    .neq("open_id", "pending")
    .maybeSingle();

  if (!acc) throw new Error("TikTok account not connected.");

  const a = acc as unknown as {
    access_token: string;
    refresh_token: string;
    token_expires_at: string;
    refresh_expires_at: string;
  };

  // If token still valid for 5+ min, return it directly.
  if (new Date(a.token_expires_at).getTime() - Date.now() > 5 * 60_000) {
    return a.access_token;
  }

  // Check refresh token hasn't expired.
  if (new Date(a.refresh_expires_at).getTime() < Date.now()) {
    throw new Error("TikTok session has expired. Please reconnect your account.");
  }

  // Refresh.
  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: a.refresh_token,
    }),
  });
  if (!res.ok) throw new Error(`TikTok token refresh failed (${res.status}).`);
  const j = await res.json();
  const td = j?.data;
  if (!td?.access_token) throw new Error("TikTok refresh response missing access_token.");

  const newAccess: string = td.access_token;
  const newRefresh: string = td.refresh_token;
  const expiresIn: number = td.expires_in ?? 86400;
  const refreshExpiresIn: number = td.refresh_expires_in ?? 31536000;

  await tiktokAccounts()
    .update({
      access_token: newAccess,
      refresh_token: newRefresh,
      token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      refresh_expires_at: new Date(Date.now() + refreshExpiresIn * 1000).toISOString(),
    })
    .eq("user_id", userId);

  return newAccess;
}

export type TiktokPrivacyLevel =
  | "PUBLIC_TO_EVERYONE"
  | "MUTUAL_FOLLOW_FRIENDS"
  | "FOLLOWER_OF_CREATOR"
  | "SELF_ONLY";

export interface PostToTiktokOptions {
  videoUrl: string;
  title?: string;
  privacyLevel?: TiktokPrivacyLevel;
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
}

/**
 * Initiate a video post on TikTok via the "Pull from URL" method.
 * TikTok fetches the video from `videoUrl` asynchronously.
 * Returns the publish_id to poll for status.
 */
export async function initiatePost(
  accessToken: string,
  opts: PostToTiktokOptions,
): Promise<string> {
  const res = await fetch(TIKTOK_POST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      post_info: {
        title: opts.title ?? "Posted from Aurora",
        privacy_level: opts.privacyLevel ?? "SELF_ONLY",
        disable_comment: opts.disableComment ?? false,
        disable_duet: opts.disableDuet ?? false,
        disable_stitch: opts.disableStitch ?? false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: opts.videoUrl,
      },
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`TikTok post failed (${res.status}): ${txt.slice(0, 300)}`);
  }
  const j = await res.json();
  if (j?.error?.code && j.error.code !== "ok") {
    throw new Error(`TikTok post error: ${j.error.message ?? j.error.code}`);
  }
  const publishId = j?.data?.publish_id;
  if (!publishId) throw new Error("TikTok post response missing publish_id.");
  return publishId as string;
}

export type TiktokPublishStatus =
  | "pending"
  | "processing_upload"
  | "processing_download"
  | "processing_media_edit"
  | "processing_stabilize"
  | "publish_from_creator_fail"
  | "publish_complete"
  | "failed";

/** Poll the current status of a post by publish_id. */
export async function fetchPostStatus(
  accessToken: string,
  publishId: string,
): Promise<{ status: TiktokPublishStatus; failReason?: string }> {
  const res = await fetch(TIKTOK_STATUS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ publish_id: publishId }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`TikTok status check failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const j = await res.json();
  const raw: string = j?.data?.status ?? "failed";
  const status = raw.toLowerCase() as TiktokPublishStatus;
  const failReason: string | undefined = j?.data?.fail_reason ?? undefined;
  return { status, failReason };
}
