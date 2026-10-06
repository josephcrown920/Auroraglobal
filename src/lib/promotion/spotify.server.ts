// Spotify public Web API adapter (client-credentials — public data only;
// Spotify for Artists exposes no API, so streams/monthly-listeners stay out).
import { fetchJson, num, str } from "./http.server";
import {
  parseSpotifyInput,
} from "./parsers";
import type { PlatformResult, PromotionDetailItem, PromotionMetrics } from "./types";

const API = "https://api.spotify.com";
const HOSTS = ["api.spotify.com", "accounts.spotify.com"] as const;

export function spotifyConfigured(): boolean {
  return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function spotifyToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) {
    return cachedToken.token;
  }
  const basic = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
  ).toString("base64");
  const res = await fetchJson(
    "https://accounts.spotify.com/api/token",
    HOSTS,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    },
  );
  const token = (res.json as { access_token?: string; expires_in?: number })?.access_token;
  if (!res.ok || !token) {
    throw new Error(`Spotify auth failed (${res.status})`);
  }
  const expiresIn = (res.json as { expires_in?: number }).expires_in ?? 3600;
  cachedToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

async function spotifyGet<T>(path: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  const token = await spotifyToken();
  const res = await fetchJson(`${API}${path}`, HOSTS, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { ok: res.ok, status: res.status, data: res.ok ? (res.json as T) : null };
}

interface SpotifyArtist {
  id: string;
  name?: string;
  followers?: { total?: number };
  popularity?: number;
  genres?: string[];
  images?: { url: string }[];
  external_urls?: { spotify?: string };
}

export async function syncSpotify(input: string): Promise<PlatformResult> {
  if (!spotifyConfigured()) {
    return { ok: false, reason: "not_configured", message: "SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET" };
  }
  const parsed = parseSpotifyInput(input);
  if (!parsed) {
    return { ok: false, reason: "invalid_input", message: "Paste your Spotify artist link or artist name." };
  }
  try {
    let artistId: string;
    if (parsed.kind === "id") {
      artistId = parsed.id;
    } else if (parsed.kind === "search") {
      const q = encodeURIComponent(parsed.query);
      const search = await spotifyGet<{ artists?: { items?: SpotifyArtist[] } }>(
        `/v1/search?q=${q}&type=artist&limit=1`,
      );
      const first = search.data?.artists?.items?.[0];
      if (!search.ok || !first) {
        return { ok: false, reason: "not_found", message: "No Spotify artist matched that name." };
      }
      artistId = first.id;
    } else {
      return { ok: false, reason: "invalid_input", message: "Paste your Spotify artist link or artist name." };
    }

    const artist = await spotifyGet<SpotifyArtist>(`/v1/artists/${artistId}`);
    if (artist.status === 404 || !artist.data) {
      return { ok: false, reason: "not_found", message: "That Spotify artist link didn't resolve." };
    }
    if (!artist.ok) throw new Error(`Spotify artist fetch failed (${artist.status})`);
    const a = artist.data;

    const top = await spotifyGet<{ tracks?: Record<string, unknown>[] }>(
      `/v1/artists/${artistId}/top-tracks?market=US`,
    );
    const albums = await spotifyGet<{ items?: Record<string, unknown>[] }>(
      `/v1/artists/${artistId}/albums?include_groups=album,single&limit=6&market=US`,
    );

    const items: PromotionDetailItem[] = [];
    for (const t of (top.data?.tracks ?? []).slice(0, 6)) {
      const album = t.album as { name?: string; images?: { url: string }[] } | undefined;
      items.push({
        id: str(t.id) ?? crypto.randomUUID(),
        kind: "track",
        title: str(t.name) ?? "Untitled",
        subtitle: album?.name ?? null,
        imageUrl: album?.images?.[album.images.length - 1]?.url ?? null,
        url: str((t.external_urls as { spotify?: string } | undefined)?.spotify),
      });
    }
    for (const al of (albums.data?.items ?? []).slice(0, 6)) {
      items.push({
        id: str(al.id) ?? crypto.randomUUID(),
        kind: str(al.album_type) === "single" ? "single" : "album",
        title: str(al.name) ?? "Untitled",
        imageUrl: (al.images as { url: string }[] | undefined)?.[1]?.url
          ?? (al.images as { url: string }[] | undefined)?.[0]?.url
          ?? null,
        url: str((al.external_urls as { spotify?: string } | undefined)?.spotify),
        releasedAt: str(al.release_date),
      });
    }

    const metrics: PromotionMetrics = {
      followers: num(a.followers?.total),
      popularity: num(a.popularity),
    };
    return {
      ok: true,
      data: {
        externalId: a.id,
        profileUrl: a.external_urls?.spotify ?? `https://open.spotify.com/artist/${a.id}`,
        displayName: a.name ?? null,
        imageUrl: a.images?.[a.images.length - 1]?.url ?? a.images?.[0]?.url ?? null,
        metrics,
        items,
      },
    };
  } catch (e) {
    return {
      ok: false,
      reason: "provider_error",
      message: e instanceof Error ? e.message : "Spotify request failed",
    };
  }
}
