// Apple Music adapter — no stats API exists, so this uses the free iTunes
// Lookup/Search APIs (no key): artist resolution + catalog (albums, singles,
// latest release with artwork and date).
import { fetchJson, num, str } from "./http.server";
import { parseAppleMusicInput } from "./parsers";
import type { PlatformResult, PromotionDetailItem, PromotionMetrics } from "./types";

const HOSTS = ["itunes.apple.com"] as const;

export function appleMusicConfigured(): boolean {
  return true; // iTunes Search/Lookup needs no key.
}

interface ItunesArtist {
  artistId?: number;
  artistName?: string;
  artistLinkUrl?: string;
  primaryGenreName?: string;
}

interface ItunesCollection {
  wrapperType?: string;
  collectionType?: string;
  collectionId?: number;
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  collectionViewUrl?: string;
  releaseDate?: string;
  trackCount?: number;
}

function bigArtwork(url: string | null): string | null {
  // 100x100bb.jpg → 300x300bb.jpg for crisper card artwork.
  return url ? url.replace(/100x100bb/, "300x300bb") : null;
}

export async function syncAppleMusic(input: string): Promise<PlatformResult> {
  const parsed = parseAppleMusicInput(input);
  if (!parsed) {
    return { ok: false, reason: "invalid_input", message: "Paste your Apple Music artist link or artist name." };
  }
  try {
    let artist: ItunesArtist | null = null;
    if (parsed.kind === "id") {
      const res = await fetchJson(
        `https://itunes.apple.com/lookup?id=${parsed.id}`,
        HOSTS,
      );
      const results = (res.json as { results?: ItunesArtist[] })?.results ?? [];
      artist = results.find((r) => r.artistId) ?? null;
    } else if (parsed.kind === "search") {
      const q = encodeURIComponent(parsed.query);
      const res = await fetchJson(
        `https://itunes.apple.com/search?term=${q}&entity=musicArtist&limit=1`,
        HOSTS,
      );
      artist = (res.json as { results?: ItunesArtist[] })?.results?.[0] ?? null;
    } else {
      return { ok: false, reason: "invalid_input", message: "Paste your Apple Music artist link or artist name." };
    }
    if (!artist?.artistId) {
      return { ok: false, reason: "not_found", message: "No Apple Music artist matched that." };
    }

    const catalog = await fetchJson(
      `https://itunes.apple.com/lookup?id=${artist.artistId}&entity=album&limit=200&sort=recent`,
      HOSTS,
    );
    if (!catalog.ok) throw new Error(`iTunes catalog lookup failed (${catalog.status})`);
    const collections = ((catalog.json as { results?: ItunesCollection[] })?.results ?? []).filter(
      (r) => r.wrapperType === "collection",
    );
    const latest = collections[0] ?? null;

    const items: PromotionDetailItem[] = collections.slice(0, 8).map((c) => ({
      id: String(c.collectionId ?? crypto.randomUUID()),
      kind: c.collectionType === "Single" ? "single" : "album",
      title: c.collectionName ?? "Untitled",
      subtitle: c.artistName ?? null,
      imageUrl: bigArtwork(c.artworkUrl100 ?? null),
      url: c.collectionViewUrl ?? null,
      releasedAt: c.releaseDate ?? null,
    }));

    const metrics: PromotionMetrics = {
      releases: num(collections.length) ?? 0,
    };
    return {
      ok: true,
      data: {
        externalId: String(artist.artistId),
        profileUrl: artist.artistLinkUrl ?? `https://music.apple.com/artist/${artist.artistId}`,
        displayName: artist.artistName ?? latest?.artistName ?? null,
        imageUrl: bigArtwork(latest?.artworkUrl100 ?? null),
        metrics,
        items,
      },
    };
  } catch (e) {
    return {
      ok: false,
      reason: "provider_error",
      message: e instanceof Error ? e.message : "Apple Music request failed",
    };
  }
}
