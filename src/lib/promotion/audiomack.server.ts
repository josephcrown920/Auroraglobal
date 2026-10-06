// Audiomack Data API adapter (https://api.audiomack.com/v1).
// Requests are OAuth 1.0a one-legged (consumer key + secret, no user token),
// which is Audiomack's server-to-server auth for the Data API. The consumer
// pair must be approved by Audiomack; without it every call 401s and the
// adapter reports not_configured cleanly.
import { createHmac, randomBytes } from "node:crypto";
import { fetchJson, num, str } from "./http.server";
import { parseAudiomackInput } from "./parsers";
import type { PlatformResult, PromotionDetailItem, PromotionMetrics } from "./types";

const API = "https://api.audiomack.com/v1";
const HOSTS = ["api.audiomack.com"] as const;

export function audiomackConfigured(): boolean {
  return !!(process.env.AUDIOMACK_CONSUMER_KEY && process.env.AUDIOMACK_CONSUMER_SECRET);
}

const pct = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** One-legged OAuth 1.0a Authorization header (HMAC-SHA1, no token). */
function oauthHeader(method: string, url: string, params: Record<string, string>): string {
  const consumerKey = process.env.AUDIOMACK_CONSUMER_KEY ?? "";
  const consumerSecret = process.env.AUDIOMACK_CONSUMER_SECRET ?? "";
  const oauth: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  };
  const all = { ...params, ...oauth };
  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${pct(k)}=${pct(all[k])}`)
    .join("&");
  const base = [method.toUpperCase(), pct(url), pct(paramString)].join("&");
  const signature = createHmac("sha1", `${pct(consumerSecret)}&`).update(base).digest("base64");
  const header = Object.entries({ ...oauth, oauth_signature: signature })
    .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
    .join(", ");
  return `OAuth ${header}`;
}

async function amGet<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const url = `${API}${path}`;
  const res = await fetchJson(
    params && Object.keys(params).length
      ? `${url}?${new URLSearchParams(params).toString()}`
      : url,
    HOSTS,
    { headers: { Authorization: oauthHeader("GET", url, params) } },
  );
  if (!res.ok) throw new Error(`Audiomack request failed (${res.status})`);
  return res.json as T;
}

interface AmArtist {
  id?: string;
  name?: string;
  url_slug?: string;
  image?: string;
  follow_count?: number | string;
  followers_count?: number | string;
  following_count?: number | string;
  upload_count?: number | string;
}

interface AmMusic {
  id?: string;
  title?: string;
  uploader?: string;
  url_slug?: string;
  image?: string;
  plays?: number | string;
  released?: string;
  created?: string;
}

export async function syncAudiomack(input: string): Promise<PlatformResult> {
  if (!audiomackConfigured()) {
    return { ok: false, reason: "not_configured", message: "AUDIOMACK_CONSUMER_KEY / AUDIOMACK_CONSUMER_SECRET" };
  }
  const parsed = parseAudiomackInput(input);
  if (!parsed) {
    return { ok: false, reason: "invalid_input", message: "Paste your Audiomack artist link or artist name." };
  }
  try {
    let slug: string | null = null;
    if (parsed.kind === "slug") {
      slug = parsed.slug;
    } else if (parsed.kind === "search") {
      const q = parsed.query;
      const search = await amGet<{ results?: { artists?: AmArtist[] } | AmArtist[] }>(
        "/search",
        { q, show: "artists", limit: "5" },
      );
      const results = search?.results;
      const artists = Array.isArray(results)
        ? results
        : (results as { artists?: AmArtist[] } | undefined)?.artists ?? [];
      slug = artists[0]?.url_slug ?? null;
      if (!slug) {
        return { ok: false, reason: "not_found", message: "No Audiomack artist matched that name." };
      }
    } else {
      return { ok: false, reason: "invalid_input", message: "Paste your Audiomack artist link or artist name." };
    }

    const info = await amGet<{ results?: AmArtist }>(`/artist/${encodeURIComponent(slug)}`);
    const artist = info?.results;
    if (!artist?.url_slug && !artist?.name) {
      return { ok: false, reason: "not_found", message: "That Audiomack artist link didn't resolve." };
    }

    const uploads = await amGet<{ results?: AmMusic[] }>(
      `/artist/${encodeURIComponent(artist.url_slug ?? slug)}/uploads`,
      { limit: "8" },
    ).catch(() => null);

    const items: PromotionDetailItem[] = (uploads?.results ?? []).slice(0, 8).map((m) => ({
      id: m.id ?? crypto.randomUUID(),
      kind: "track" as const,
      title: m.title ?? "Untitled",
      subtitle: m.uploader ?? null,
      imageUrl: m.image ?? null,
      url: m.url_slug && artist.url_slug
        ? `https://audiomack.com/${artist.url_slug}/song/${m.url_slug}`
        : null,
      plays: num(m.plays) ?? null,
      releasedAt: m.released ?? m.created ?? null,
    }));

    const metrics: PromotionMetrics = {
      followers: num(artist.followers_count) ?? num(artist.follow_count),
      following: num(artist.following_count),
      uploads: num(artist.upload_count),
    };
    const finalSlug = artist.url_slug ?? slug;
    return {
      ok: true,
      data: {
        externalId: artist.id ?? finalSlug,
        profileUrl: `https://audiomack.com/${finalSlug}`,
        displayName: str(artist.name),
        imageUrl: str(artist.image),
        metrics,
        items,
      },
    };
  } catch (e) {
    return {
      ok: false,
      reason: "provider_error",
      message: e instanceof Error ? e.message : "Audiomack request failed",
    };
  }
}
