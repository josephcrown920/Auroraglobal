// URL / handle / search-term parsers for the Promotion Hub link form.
// Pure and CLIENT-SAFE (no server imports) so the page can pre-validate and
// the server can re-validate. Every parser returns either a concrete platform
// identity hint or { kind: "search", query } for name-based lookup.

import type { LinkPlatform } from "./types";

export type ParsedInput =
  | { kind: "id"; id: string } // platform-native id (spotify/apple/youtube)
  | { kind: "slug"; slug: string } // audiomack url slug
  | { kind: "handle"; handle: string } // youtube @handle
  | { kind: "url"; url: string } // boomplay link-only
  | { kind: "search"; query: string };

const SPOTIFY_ID = /^[0-9A-Za-z]{22}$/;
const APPLE_ID = /^\d{4,12}$/;
const YOUTUBE_CHANNEL_ID = /^UC[\w-]{22}$/;

function asUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

function hostIs(url: URL, ...hosts: string[]): boolean {
  return hosts.some(
    (h) => url.hostname === h || url.hostname.endsWith(`.${h}`),
  );
}

export function parseSpotifyInput(input: string): ParsedInput | null {
  const raw = input.trim();
  if (!raw) return null;
  if (SPOTIFY_ID.test(raw)) return { kind: "id", id: raw };
  const uri = /^spotify:artist:([0-9A-Za-z]{22})$/.exec(raw);
  if (uri) return { kind: "id", id: uri[1] };
  const url = asUrl(raw);
  if (url && hostIs(url, "open.spotify.com", "spotify.link")) {
    const m = /^\/artist\/([0-9A-Za-z]{22})/.exec(url.pathname);
    if (m) return { kind: "id", id: m[1] };
    return null; // a spotify link that isn't an artist page
  }
  if (url) return null; // some other platform's URL pasted here
  return { kind: "search", query: raw.slice(0, 120) };
}

export function parseAppleMusicInput(input: string): ParsedInput | null {
  const raw = input.trim();
  if (!raw) return null;
  if (APPLE_ID.test(raw)) return { kind: "id", id: raw };
  const url = asUrl(raw);
  if (url && hostIs(url, "music.apple.com", "itunes.apple.com")) {
    const m = /\/artist(?:\/[^/]+)?\/(\d{4,12})/.exec(url.pathname);
    if (m) return { kind: "id", id: m[1] };
    return null;
  }
  if (url) return null;
  return { kind: "search", query: raw.slice(0, 120) };
}

export function parseYoutubeInput(input: string): ParsedInput | null {
  const raw = input.trim();
  if (!raw) return null;
  if (YOUTUBE_CHANNEL_ID.test(raw)) return { kind: "id", id: raw };
  if (/^@[\w.-]{2,60}$/.test(raw)) return { kind: "handle", handle: raw.slice(1) };
  const url = asUrl(raw);
  if (url && hostIs(url, "youtube.com", "youtu.be", "m.youtube.com", "music.youtube.com")) {
    const p = url.pathname;
    let m = /^\/channel\/(UC[\w-]{22})/.exec(p);
    if (m) return { kind: "id", id: m[1] };
    m = /^\/@([\w.-]{2,60})/.exec(p);
    if (m) return { kind: "handle", handle: m[1] };
    m = /^\/(?:c|user)\/([\w.-]{2,60})/.exec(p);
    if (m) return { kind: "search", query: m[1].replace(/[._-]+/g, " ") };
    return null;
  }
  if (url) return null;
  if (/^[\w.-]{2,60}$/.test(raw) && !raw.includes(" ")) {
    // A bare handle without @ — treat as a handle first, search as fallback.
    return { kind: "handle", handle: raw };
  }
  return { kind: "search", query: raw.slice(0, 120) };
}

export function parseAudiomackInput(input: string): ParsedInput | null {
  const raw = input.trim();
  if (!raw) return null;
  const url = asUrl(raw);
  if (url && hostIs(url, "audiomack.com")) {
    const m = /^\/([\w-]{2,60})(?:\/)?$/.exec(url.pathname);
    if (m && !["search", "charts", "playlists", "songs", "albums"].includes(m[1])) {
      return { kind: "slug", slug: m[1] };
    }
    return null;
  }
  if (url) return null;
  if (/^[\w-]{2,60}$/.test(raw)) return { kind: "slug", slug: raw };
  return { kind: "search", query: raw.slice(0, 120) };
}

/** Boomplay is link-only: only a real boomplay.com artist/share URL is accepted. */
export function parseBoomplayInput(input: string): ParsedInput | null {
  const raw = input.trim();
  if (!raw) return null;
  const url = asUrl(raw);
  if (!url || !hostIs(url, "boomplay.com", "boomplaymusic.com")) return null;
  if (!/^\/(artists|share\/artist|albums|songs)\//.test(url.pathname)) return null;
  url.protocol = "https:";
  url.hash = "";
  return { kind: "url", url: url.toString() };
}

export function parsePlatformInput(
  platform: LinkPlatform,
  input: string,
): ParsedInput | null {
  switch (platform) {
    case "spotify":
      return parseSpotifyInput(input);
    case "apple_music":
      return parseAppleMusicInput(input);
    case "youtube":
      return parseYoutubeInput(input);
    case "audiomack":
      return parseAudiomackInput(input);
    case "boomplay":
      return parseBoomplayInput(input);
  }
}
