// TikTok Display API stats for the Promotion Hub.
// Reuses the posting integration's token storage/refresh; the new
// user.info.stats + video.list scopes are additive — accounts connected
// before this change keep working for posting and get a "reconnect for
// stats" flag until they re-authorize.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensureFreshToken, tiktokConfigured } from "@/lib/tiktok-posting.server";
import { num, str } from "./http.server";
import type { PlatformResult, PromotionDetailItem, PromotionMetrics } from "./types";

const STATS_USER_URL =
  "https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name,username,follower_count,following_count,likes_count,video_count";
const VIDEO_LIST_URL =
  "https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,share_url,view_count,like_count,comment_count,share_count,create_time";

/** Scopes the stats sync needs beyond the original posting scopes. */
export const TIKTOK_STATS_SCOPES = ["user.info.stats", "video.list"] as const;

/** True when the stored OAuth grant already includes the stats scopes. */
export function tiktokHasStatsScopes(scope: string | null | undefined): boolean {
  const granted = new Set((scope ?? "").split(/[,\s]+/).filter(Boolean));
  return TIKTOK_STATS_SCOPES.every((s) => granted.has(s));
}

export async function syncTiktokStats(userId: string): Promise<PlatformResult> {
  if (!tiktokConfigured()) {
    return { ok: false, reason: "not_configured", message: "TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET" };
  }
  const { data: acc } = await supabaseAdmin
    .from("tiktok_accounts")
    .select("open_id, username, display_name, avatar_url, scope")
    .eq("user_id", userId)
    .neq("open_id", "pending")
    .maybeSingle();
  if (!acc) {
    return { ok: false, reason: "not_found", message: "TikTok account not connected." };
  }
  const a = acc as unknown as {
    open_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    scope: string | null;
  };
  if (!tiktokHasStatsScopes(a.scope)) {
    return {
      ok: false,
      reason: "invalid_input",
      message: "reconnect_required",
    };
  }
  try {
    const token = await ensureFreshToken(userId);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    let userJson: unknown = null;
    let videoJson: unknown = null;
    try {
      const userRes = await fetch(STATS_USER_URL, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      });
      if (!userRes.ok) throw new Error(`TikTok user stats failed (${userRes.status})`);
      userJson = await userRes.json();

      const videoRes = await fetch(VIDEO_LIST_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ max_count: 12 }),
        signal: ctrl.signal,
      });
      if (videoRes.ok) videoJson = await videoRes.json();
    } finally {
      clearTimeout(timer);
    }

    const u = (userJson as { data?: { user?: Record<string, unknown> } })?.data?.user ?? {};
    const metrics: PromotionMetrics = {
      followers: num(u.follower_count),
      following: num(u.following_count),
      likes: num(u.likes_count),
      videoCount: num(u.video_count),
    };

    const videos =
      (videoJson as { data?: { videos?: Record<string, unknown>[] } } | null)?.data?.videos ?? [];
    const items: PromotionDetailItem[] = videos.slice(0, 12).map((v) => ({
      id: str(v.id) ?? crypto.randomUUID(),
      kind: "video" as const,
      title: str(v.title) ?? "TikTok video",
      imageUrl: str(v.cover_image_url),
      url: str(v.share_url),
      views: num(v.view_count) ?? null,
      likes: num(v.like_count) ?? null,
      comments: num(v.comment_count) ?? null,
      shares: num(v.share_count) ?? null,
      releasedAt:
        num(v.create_time) != null
          ? new Date(num(v.create_time)! * 1000).toISOString()
          : null,
    }));

    // Keep identity columns fresh for the card header.
    await supabaseAdmin
      .from("tiktok_accounts")
      .update({
        display_name: str(u.display_name) ?? a.display_name,
        username: str(u.username) ?? a.username,
        avatar_url: str(u.avatar_url) ?? a.avatar_url,
      })
      .eq("user_id", userId);

    return {
      ok: true,
      data: {
        externalId: a.open_id,
        profileUrl: a.username ? `https://www.tiktok.com/@${a.username}` : "https://www.tiktok.com/",
        displayName: str(u.display_name) ?? a.display_name,
        imageUrl: str(u.avatar_url) ?? a.avatar_url,
        metrics,
        items,
      },
    };
  } catch (e) {
    return {
      ok: false,
      reason: "provider_error",
      message: e instanceof Error ? e.message : "TikTok stats request failed",
    };
  }
}
