import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAdmin } from "./admin.server";
import {
  tiktokConfigured,
  initiateTiktokOAuth,
  ensureFreshToken,
  initiatePost,
  fetchPostStatus,
} from "./tiktok-posting.server";
import { createTiktokSparkAuthorizationCode, tiktokSparkConfigured } from "./tiktok-spark.server";

function getOrigin(): string {
  const req = getRequest();
  const host = req?.headers.get("host") ?? "localhost:8080";
  const proto = req?.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Returns the user's connected TikTok account (or null if not connected). */
export const getMyTiktokAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data } = await supabaseAdmin
      .from("tiktok_accounts")
      .select("open_id, username, display_name, avatar_url, token_expires_at, refresh_expires_at, scope")
      .eq("user_id", userId)
      .neq("open_id", "pending")
      .maybeSingle();
    if (!data) return { connected: false as const };
    const d = data as unknown as {
      open_id: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
      token_expires_at: string;
      refresh_expires_at: string;
      scope: string | null;
    };
    const sessionExpired = new Date(d.refresh_expires_at).getTime() < Date.now();
    const granted = new Set((d.scope ?? "").split(/[,\s]+/).filter(Boolean));
    const hasStatsScopes =
      granted.has("user.info.stats") && granted.has("video.list");
    return {
      connected: true as const,
      openId: d.open_id,
      username: d.username,
      displayName: d.display_name,
      avatarUrl: d.avatar_url,
      scope: d.scope,
      sessionExpired,
      hasStatsScopes,
    };
  });

/** Returns the TikTok OAuth authorization URL to redirect the user to.
 *  `returnTo` ("/settings" | "/promotion") decides where the callback lands. */
export const initTiktokConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = (data ?? {}) as { returnTo?: unknown };
    return { returnTo: d.returnTo === "/promotion" ? "/promotion" : "/settings" };
  })
  .handler(async ({ context, data }) => {
    if (!tiktokConfigured()) {
      throw new Error(
        "TikTok integration is not enabled on this server. The owner needs to add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in the secrets panel.",
      );
    }
    const { userId } = context;
    const origin = getOrigin();
    const authUrl = await initiateTiktokOAuth(userId, origin, data.returnTo);
    return { authUrl };
  });

/** Disconnect the user's TikTok account (delete the row). */
export const disconnectTiktok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    await supabaseAdmin
      .from("tiktok_accounts")
      .delete()
      .eq("user_id", userId);
    return { ok: true };
  });

const PostToTiktokInput = z.object({
  videoUrl: z.string().url(),
  generationId: z.string().optional(),
  title: z.string().max(150).optional(),
  privacyLevel: z
    .enum(["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"])
    .optional(),
});

/** Initiate posting a video to TikTok. Returns the tiktok_posts row id for status polling. */
export const postToTiktok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PostToTiktokInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    if (!tiktokConfigured()) throw new Error("TikTok integration is not configured on this server.");

    const accessToken = await ensureFreshToken(userId);

    // Create a pending post row.
    const { data: postRow, error: insertErr } = await supabaseAdmin
      .from("tiktok_posts")
      .insert({
        user_id: userId,
        generation_id: data.generationId ?? null,
        video_url: data.videoUrl,
        title: data.title ?? null,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr || !postRow) throw new Error("Failed to create post record.");
    const postId = (postRow as unknown as { id: string }).id;

    // Kick off the TikTok post (async — TikTok pulls the video).
    let publishId: string | null = null;
    let errorMsg: string | null = null;
    try {
      publishId = await initiatePost(accessToken, {
        videoUrl: data.videoUrl,
        title: data.title,
        privacyLevel: data.privacyLevel ?? "SELF_ONLY",
      });
      await supabaseAdmin
        .from("tiktok_posts")
        .update({ publish_id: publishId, status: "processing_upload" })
        .eq("id", postId);
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("tiktok_posts")
        .update({ status: "failed", error_msg: errorMsg })
        .eq("id", postId);
      throw new Error(`TikTok post failed: ${errorMsg}`);
    }

    return { postId, publishId };
  });

const RetryInput = z.object({ postId: z.string().uuid() });

/** Retry policy: per-post cooldown and a durable cap on total retry attempts. */
const RETRY_COOLDOWN_MS = 60_000;
const MAX_RETRY_ATTEMPTS = 5;

/**
 * Retry a failed TikTok post, in place. The claim is a single atomic UPDATE
 * inside the claim_tiktok_retry RPC: it only matches a row owned by the
 * caller, currently failed, past the cooldown, and under the attempt cap —
 * and Postgres holds the row lock while evaluating it, so concurrent retries
 * of the same post see zero rows and stop. retry_count is incremented in the
 * same statement, making the attempt cap durable across sessions. Only the
 * row's stored video_url/title/generation_id are reused — nothing
 * client-supplied is trusted.
 */
export const retryTiktokPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RetryInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (!tiktokConfigured()) throw new Error("TikTok integration is not configured on this server.");

    const { data: claimedRows, error: claimErr } = await supabaseAdmin.rpc("claim_tiktok_retry", {
      p_post_id: data.postId,
      p_user_id: userId,
      p_cooldown_ms: RETRY_COOLDOWN_MS,
      p_max_attempts: MAX_RETRY_ATTEMPTS,
    });
    if (claimErr) throw new Error("Couldn't retry the post right now.");
    const claimedRow = (claimedRows ?? [])[0] as unknown as
      | { id: string; generation_id: string | null; video_url: string; title: string | null }
      | undefined;

    if (!claimedRow) {
      // Claim lost — re-read the row to give a precise reason.
      const { data: existing } = await supabaseAdmin
        .from("tiktok_posts")
        .select("status, updated_at, retry_count")
        .eq("id", data.postId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) throw new Error("Post not found.");
      const e = existing as unknown as { status: string; updated_at: string; retry_count: number };
      if (e.status !== "failed" && e.status !== "publish_from_creator_fail") {
        throw new Error("Only failed posts can be retried.");
      }
      if (e.retry_count >= MAX_RETRY_ATTEMPTS) {
        throw new Error("This post has been retried too many times. Re-share it from your gallery instead.");
      }
      throw new Error("Please wait a minute before retrying this video again.");
    }

    try {
      const accessToken = await ensureFreshToken(userId);
      const publishId = await initiatePost(accessToken, {
        videoUrl: claimedRow.video_url,
        title: claimedRow.title ?? undefined,
        privacyLevel: "SELF_ONLY",
      });
      await supabaseAdmin
        .from("tiktok_posts")
        .update({ publish_id: publishId, status: "processing_upload", updated_at: new Date().toISOString() })
        .eq("id", data.postId);
      return { postId: data.postId, publishId };
    } catch (e) {
      // Token refresh failures land here too — never strand the row as pending.
      const errorMsg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("tiktok_posts")
        .update({ status: "failed", error_msg: errorMsg, updated_at: new Date().toISOString() })
        .eq("id", data.postId);
      throw new Error(`TikTok post failed: ${errorMsg}`);
    }
  });

const PollInput = z.object({ postId: z.string().uuid() });

/** Minimum time between TikTok status API calls for the same post. */
const POLL_COOLDOWN_MS = 15_000;

/** Refresh the status of a tiktok_posts row from TikTok's API. */
export const pollTiktokPostStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PollInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: postRow } = await supabaseAdmin
      .from("tiktok_posts")
      .select("publish_id, status, error_msg, updated_at")
      .eq("id", data.postId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!postRow) throw new Error("Post not found.");
    const p = postRow as unknown as { publish_id: string | null; status: string; error_msg: string | null; updated_at: string };

    // Terminal states — no need to hit TikTok.
    const TERMINAL_STATUSES = ["publish_complete", "failed", "publish_from_creator_fail"];
    if (TERMINAL_STATUSES.includes(p.status)) {
      return { status: p.status, errorMsg: p.error_msg };
    }

    if (!p.publish_id) {
      return { status: p.status, errorMsg: p.error_msg };
    }

    // Server-side throttle: at most one TikTok status call per post per 15s.
    // The reservation is an atomic conditional UPDATE — Postgres holds the row
    // lock while evaluating it, so whoever wins may call TikTok and concurrent
    // or duplicate polls (auto refresh, manual Check, other devices) lose the
    // race and get the stored status. updated_at doubles as last-checked.
    const reservationCutoff = new Date(Date.now() - POLL_COOLDOWN_MS).toISOString();
    const { data: reservation } = await supabaseAdmin
      .from("tiktok_posts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.postId)
      .eq("user_id", userId)
      .lt("updated_at", reservationCutoff)
      .select("id");
    if (!(reservation ?? []).length) {
      return { status: p.status, errorMsg: p.error_msg };
    }

    let accessToken: string;
    try {
      accessToken = await ensureFreshToken(userId);
    } catch (e) {
      return { status: p.status, errorMsg: e instanceof Error ? e.message : "Auth error" };
    }

    const { status, failReason } = await fetchPostStatus(accessToken, p.publish_id);

    const isTerminal = status === "publish_complete" || status === "failed" || status === "publish_from_creator_fail";
    await supabaseAdmin
      .from("tiktok_posts")
      .update({
        status,
        error_msg: failReason ?? null,
        updated_at: new Date().toISOString(),
        ...(status === "publish_complete" ? { posted_at: new Date().toISOString() } : {}),
      })
      .eq("id", data.postId);

    void isTerminal;
    return { status, errorMsg: failReason ?? null };
  });

/** List the current user's TikTok post history (newest first, max 50). */
export const listMyTiktokPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin
      .from("tiktok_posts")
      .select("id, generation_id, video_url, title, status, error_msg, publish_id, posted_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Failed to load your TikTok posts.");
    const rows = (data ?? []) as unknown as Array<{
      id: string;
      generation_id: string | null;
      video_url: string;
      title: string | null;
      status: string;
      error_msg: string | null;
      publish_id: string | null;
      posted_at: string | null;
      created_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      generationId: r.generation_id,
      videoUrl: r.video_url,
      title: r.title,
      status: r.status,
      errorMsg: r.error_msg,
      publishId: r.publish_id,
      postedAt: r.posted_at,
      createdAt: r.created_at,
    }));
  });

/** Get the tiktok_posts rows for a specific generation (to show button state). */
export const getTiktokPostForGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ generationId: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: rows } = await supabaseAdmin
      .from("tiktok_posts")
      .select("id, status, error_msg, publish_id, posted_at")
      .eq("user_id", userId)
      .eq("generation_id", data.generationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!rows) return null;
    const r = rows as unknown as { id: string; status: string; error_msg: string | null; publish_id: string | null; posted_at: string | null };
    return { postId: r.id, status: r.status, errorMsg: r.error_msg, postedAt: r.posted_at };
  });

const SparkAuthorizationInput = z.object({
  postUrl: z.string().url().max(2_000),
});

type SparkAuthorizationAvailability = {
  connected: boolean;
  available: boolean;
  reason: string | null;
};

/**
 * Spark authorization currently uses one Aurora-owned Marketing API advertiser
 * credential. It may only be used by the advertiser owner until each creator
 * can connect and authorize their own advertiser account.
 */
async function getSparkAuthorizationAvailabilityForUser(userId: string): Promise<SparkAuthorizationAvailability> {
  if (!tiktokConfigured()) {
    return {
      connected: false,
      available: false,
      reason: "TikTok integration is not configured on this server.",
    };
  }
  const { data: account } = await supabaseAdmin
    .from("tiktok_accounts")
    .select("open_id")
    .eq("user_id", userId)
    .neq("open_id", "pending")
    .maybeSingle();
  if (!account) {
    return {
      connected: false,
      available: false,
      reason: "Connect your TikTok account before requesting a Spark authorization code.",
    };
  }
  if (!tiktokSparkConfigured()) {
    return {
      connected: true,
      available: false,
      reason: "TikTok Marketing API Spark authorization is not configured for this Aurora workspace.",
    };
  }
  if (!(await isAdmin(userId))) {
    return {
      connected: true,
      available: false,
      reason: "Spark authorization is available to the advertiser account owner only until creator-owned Marketing API connections are available.",
    };
  }
  return { connected: true, available: true, reason: null };
}

/** Returns an honest, non-secret readiness state for the Spark-code UI. */
export const getSparkAuthorizationAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getSparkAuthorizationAvailabilityForUser(context.userId));

/**
 * Requests a Spark authorization code for an existing public TikTok post.
 * This is a Marketing API operation only; it never creates a generation or
 * reserves Aura.
 */
export const createSparkAuthorizationCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SparkAuthorizationInput.parse(input))
  .handler(async ({ data, context }) => {
    const availability = await getSparkAuthorizationAvailabilityForUser(context.userId);
    if (!availability.available) throw new Error(availability.reason ?? "Spark authorization is unavailable.");
    return createTiktokSparkAuthorizationCode(context.userId, data.postUrl);
  });
