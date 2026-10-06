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
import {
  parseTiktokPublishStatus,
  TIKTOK_NON_TERMINAL_POST_STATUSES,
  type TiktokPublishStatus,
} from "@/lib/tiktok-post-status";

export type { TiktokPublishStatus } from "@/lib/tiktok-post-status";

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
    signal: AbortSignal.timeout(8_000),
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
    signal: AbortSignal.timeout(15_000),
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

/** Poll the current status of a post by publish_id. */
export async function fetchPostStatus(
  accessToken: string,
  publishId: string,
): Promise<{ status: TiktokPublishStatus; failReason?: string }> {
  const res = await fetch(TIKTOK_STATUS_URL, {
    method: "POST",
    signal: AbortSignal.timeout(8_000),
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
  const status = parseTiktokPublishStatus(j?.data?.status);
  const failReason: string | undefined = j?.data?.fail_reason ?? undefined;
  return { status, failReason };
}

const STALE_POST_AGE_MS = 15 * 60_000;
const FAILED_POST_TIMEOUT_MS = 24 * 60 * 60_000;
const FAILED_POST_TIMEOUT_MESSAGE = "Timed out — check TikTok for status";
const INITIATION_TIMEOUT_MESSAGE = "TikTok post initiation timed out — retry";
// The cron caller has a 55-second deadline. Five serial checks with an
// eight-second request timeout leave headroom for token refreshes and DB work.
const TIKTOK_SWEEP_BATCH_SIZE = 5;

export interface TiktokPostSweepResult {
  checked: number;
  updated: number;
  initiationFailed: number;
  timedOut: number;
  errors: number;
}

export interface TiktokPostSweepDependencies {
  admin: typeof supabaseAdmin;
  getAccessToken: typeof ensureFreshToken;
  getPostStatus: typeof fetchPostStatus;
}

/**
 * Refresh TikTok posts that no longer have a browser polling them.
 *
 * The conditional UPDATE is the claim: only one cron/browser caller can move
 * updated_at past the stale cutoff and make the external API call.
 */
export async function sweepStaleTiktokPosts(
  now = new Date(),
  dependencies: TiktokPostSweepDependencies = {
    admin: supabaseAdmin,
    getAccessToken: ensureFreshToken,
    getPostStatus: fetchPostStatus,
  },
): Promise<TiktokPostSweepResult> {
  const { admin, getAccessToken, getPostStatus } = dependencies;
  const staleCutoff = new Date(now.getTime() - STALE_POST_AGE_MS).toISOString();
  const failedCutoff = new Date(now.getTime() - FAILED_POST_TIMEOUT_MS).toISOString();
  const result: TiktokPostSweepResult = {
    checked: 0,
    updated: 0,
    initiationFailed: 0,
    timedOut: 0,
    errors: 0,
  };

  // If execution stopped after inserting the row but before persisting a
  // publish_id, there is no TikTok status endpoint we can call. Fail the stale
  // row atomically so the existing controlled retry flow becomes available.
  const { data: initiationRows, error: initiationError } = await admin
    .from("tiktok_posts")
    .update({
      status: "failed",
      error_msg: INITIATION_TIMEOUT_MESSAGE,
      updated_at: now.toISOString(),
    })
    .in("status", [...TIKTOK_NON_TERMINAL_POST_STATUSES])
    .is("publish_id", null)
    .lt("updated_at", staleCutoff)
    .select("id");
  if (initiationError) {
    throw new Error(`Failed to recover stale TikTok post initiations: ${initiationError.message}`);
  }
  result.initiationFailed = initiationRows?.length ?? 0;

  const { data: timedOutRows, error: timeoutError } = await admin
    .from("tiktok_posts")
    .update({ error_msg: FAILED_POST_TIMEOUT_MESSAGE, updated_at: now.toISOString() })
    .eq("status", "failed")
    .lt("updated_at", failedCutoff)
    // Preserve TikTok's real fail_reason. A missing reason is the ambiguous
    // failed state that needs the operator-facing timeout explanation.
    .is("error_msg", null)
    .select("id");
  if (timeoutError) throw new Error(`Failed to time out stale TikTok posts: ${timeoutError.message}`);
  result.timedOut = timedOutRows?.length ?? 0;

  const { data: staleRows, error: staleError } = await admin
    .from("tiktok_posts")
    .select("id")
    .in("status", [...TIKTOK_NON_TERMINAL_POST_STATUSES])
    .not("publish_id", "is", null)
    .lt("updated_at", staleCutoff)
    .order("updated_at", { ascending: true })
    .limit(TIKTOK_SWEEP_BATCH_SIZE);
  if (staleError) throw new Error(`Failed to load stale TikTok posts: ${staleError.message}`);

  await Promise.all((staleRows ?? []).map(async (staleRow) => {
    const { data: claimedRows, error: claimError } = await admin
      .from("tiktok_posts")
      .update({ updated_at: now.toISOString() })
      .eq("id", staleRow.id)
      .in("status", [...TIKTOK_NON_TERMINAL_POST_STATUSES])
      .lt("updated_at", staleCutoff)
      .select("id, user_id, publish_id");

    if (claimError) {
      result.errors += 1;
      return;
    }
    const claimed = claimedRows?.[0];
    if (!claimed?.publish_id) return;

    result.checked += 1;
    try {
      const accessToken = await getAccessToken(claimed.user_id);
      const { status, failReason } = await getPostStatus(accessToken, claimed.publish_id);
      const completedAt = status === "publish_complete" ? now.toISOString() : undefined;
      const { error: updateError } = await admin
        .from("tiktok_posts")
        .update({
          status,
          error_msg: failReason ?? null,
          ...(completedAt ? { posted_at: completedAt } : {}),
          updated_at: now.toISOString(),
        })
        .eq("id", claimed.id);
      if (updateError) throw new Error(updateError.message);
      result.updated += 1;
    } catch {
      // Leave the post non-terminal. The claim timestamp provides backoff and
      // the next cron tick after the stale window will retry it.
      result.errors += 1;
    }
  }));

  return result;
}
