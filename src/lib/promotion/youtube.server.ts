// YouTube Data API v3 adapter (API key, public data only: subscribers,
// total views, video count, recent uploads with views/likes/comments).
// Uses the channel's uploads playlist to stay within quota.
import { fetchJson, num, str } from "./http.server";
import { parseYoutubeInput } from "./parsers";
import type { PlatformResult, PromotionDetailItem, PromotionMetrics } from "./types";

const API = "https://www.googleapis.com/youtube/v3";
const HOSTS = ["www.googleapis.com"] as const;

export function youtubeConfigured(): boolean {
  return !!process.env.YOUTUBE_API_KEY;
}

function key(): string {
  return process.env.YOUTUBE_API_KEY ?? "";
}

interface YtChannel {
  id?: string;
  snippet?: {
    title?: string;
    customUrl?: string;
    thumbnails?: { default?: { url?: string }; medium?: { url?: string }; high?: { url?: string } };
  };
  statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
}

async function ytGet<T>(path: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetchJson(`${API}${path}${path.includes("?") ? "&" : "?"}key=${key()}`, HOSTS);
  return { ok: res.ok, status: res.status, data: res.ok ? (res.json as T) : null };
}

export async function syncYoutube(input: string): Promise<PlatformResult> {
  if (!youtubeConfigured()) {
    return { ok: false, reason: "not_configured", message: "YOUTUBE_API_KEY" };
  }
  const parsed = parseYoutubeInput(input);
  if (!parsed) {
    return { ok: false, reason: "invalid_input", message: "Paste your YouTube channel link, @handle or channel name." };
  }
  try {
    let channel: YtChannel | null = null;
    if (parsed.kind === "id") {
      const r = await ytGet<{ items?: YtChannel[] }>(
        `/channels?part=snippet,statistics,contentDetails&id=${parsed.id}`,
      );
      channel = r.data?.items?.[0] ?? null;
    } else if (parsed.kind === "handle") {
      const r = await ytGet<{ items?: YtChannel[] }>(
        `/channels?part=snippet,statistics,contentDetails&forHandle=${encodeURIComponent(`@${parsed.handle}`)}`,
      );
      channel = r.data?.items?.[0] ?? null;
    } else if (parsed.kind === "search") {
      const q = encodeURIComponent(parsed.query);
      const s = await ytGet<{ items?: { id?: { channelId?: string } }[] }>(
        `/search?part=snippet&type=channel&q=${q}&maxResults=1`,
      );
      const id = s.data?.items?.[0]?.id?.channelId;
      if (id) {
        const r = await ytGet<{ items?: YtChannel[] }>(
          `/channels?part=snippet,statistics,contentDetails&id=${id}`,
        );
        channel = r.data?.items?.[0] ?? null;
      }
    } else {
      return { ok: false, reason: "invalid_input", message: "Paste your YouTube channel link, @handle or channel name." };
    }
    if (!channel?.id) {
      return { ok: false, reason: "not_found", message: "No YouTube channel matched that." };
    }

    const metrics: PromotionMetrics = {
      subscribers: num(channel.statistics?.subscriberCount),
      totalViews: num(channel.statistics?.viewCount),
      videoCount: num(channel.statistics?.videoCount),
    };

    // Recent uploads via the uploads playlist (cheap), then per-video stats.
    const items: PromotionDetailItem[] = [];
    const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
    if (uploads) {
      const pl = await ytGet<{
        items?: { snippet?: { resourceId?: { videoId?: string }; title?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string } } } }[];
      }>(`/playlistItems?part=snippet&playlistId=${uploads}&maxResults=6`);
      const ids = (pl.data?.items ?? [])
        .map((it) => it.snippet?.resourceId?.videoId)
        .filter((v): v is string => !!v);
      if (ids.length) {
        const vids = await ytGet<{
          items?: {
            id?: string;
            snippet?: { title?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string } } };
            statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
          }[];
        }>(`/videos?part=snippet,statistics&id=${ids.join(",")}`);
        for (const v of vids.data?.items ?? []) {
          items.push({
            id: v.id ?? crypto.randomUUID(),
            kind: "video",
            title: v.snippet?.title ?? "Untitled",
            imageUrl: v.snippet?.thumbnails?.medium?.url ?? null,
            url: v.id ? `https://www.youtube.com/watch?v=${v.id}` : null,
            views: num(v.statistics?.viewCount) ?? null,
            likes: num(v.statistics?.likeCount) ?? null,
            comments: num(v.statistics?.commentCount) ?? null,
            releasedAt: v.snippet?.publishedAt ?? null,
          });
        }
      }
    }

    return {
      ok: true,
      data: {
        externalId: channel.id,
        profileUrl: channel.snippet?.customUrl
          ? `https://www.youtube.com/${channel.snippet.customUrl}`
          : `https://www.youtube.com/channel/${channel.id}`,
        displayName: str(channel.snippet?.title),
        imageUrl:
          channel.snippet?.thumbnails?.high?.url ??
          channel.snippet?.thumbnails?.medium?.url ??
          channel.snippet?.thumbnails?.default?.url ??
          null,
        metrics,
        items,
      },
    };
  } catch (e) {
    return {
      ok: false,
      reason: "provider_error",
      message: e instanceof Error ? e.message : "YouTube request failed",
    };
  }
}
