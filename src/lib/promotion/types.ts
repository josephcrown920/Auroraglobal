// Shared Promotion Hub types + platform metadata.
// CLIENT-SAFE: no imports from *.server.ts — the page imports this directly.

export const PROMOTION_PLATFORMS = [
  "spotify",
  "apple_music",
  "audiomack",
  "boomplay",
  "youtube",
  "tiktok",
] as const;
export type PromotionPlatform = (typeof PROMOTION_PLATFORMS)[number];

/** Platforms linked by pasting a profile URL / searching (TikTok links via OAuth). */
export const LINK_PLATFORMS = [
  "spotify",
  "apple_music",
  "audiomack",
  "boomplay",
  "youtube",
] as const;
export type LinkPlatform = (typeof LINK_PLATFORMS)[number];

/** Headline numbers recorded once per UTC day in artist_platform_snapshots. */
export interface PromotionMetrics {
  followers?: number; // spotify, audiomack, tiktok
  subscribers?: number; // youtube
  popularity?: number; // spotify 0-100
  totalViews?: number; // youtube channel lifetime views
  videoCount?: number; // youtube, tiktok
  likes?: number; // tiktok profile likes
  following?: number; // tiktok, audiomack
  releases?: number; // apple music catalog size
  uploads?: number; // audiomack
}

export type PromotionDetailKind = "track" | "album" | "single" | "video";

export interface PromotionDetailItem {
  id: string;
  kind: PromotionDetailKind;
  title: string;
  imageUrl: string | null;
  url: string | null;
  subtitle?: string | null;
  plays?: number | null;
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  releasedAt?: string | null;
}

/** Normalized identity + fresh stats returned by every platform adapter. */
export interface PlatformSyncData {
  externalId: string | null;
  profileUrl: string;
  displayName: string | null;
  imageUrl: string | null;
  metrics: PromotionMetrics;
  items: PromotionDetailItem[];
}

export type PlatformFailureReason =
  | "not_configured" // server API key missing
  | "invalid_input" // pasted link / search term unusable
  | "not_found" // platform resolved nothing
  | "provider_error"; // platform API failed / rate-limited

export type PlatformResult =
  | { ok: true; data: PlatformSyncData }
  | { ok: false; reason: PlatformFailureReason; message: string };

export interface PlatformMeta {
  label: string;
  shortLabel: string;
  /** Brand accent for card headers + marks. */
  color: string;
  /** Secondary brand color (TikTok gradient). */
  color2?: string;
  dashboardLabel: string;
  /** Metric the growth chart tracks; null = link-only platform. */
  growthMetric: keyof PromotionMetrics | null;
  growthMetricLabel: string | null;
  placeholderUrl: string;
}

export const PLATFORM_META: Record<PromotionPlatform, PlatformMeta> = {
  spotify: {
    label: "Spotify",
    shortLabel: "Spotify",
    color: "#1DB954",
    dashboardLabel: "Open Spotify for Artists",
    growthMetric: "followers",
    growthMetricLabel: "Followers",
    placeholderUrl: "https://open.spotify.com/artist/…",
  },
  apple_music: {
    label: "Apple Music",
    shortLabel: "Apple",
    color: "#FA2D48",
    dashboardLabel: "Open Apple Music for Artists",
    growthMetric: "releases",
    growthMetricLabel: "Catalog releases",
    placeholderUrl: "https://music.apple.com/artist/…",
  },
  audiomack: {
    label: "Audiomack",
    shortLabel: "Audiomack",
    color: "#FFA200",
    dashboardLabel: "Open Audiomack Creators",
    growthMetric: "followers",
    growthMetricLabel: "Followers",
    placeholderUrl: "https://audiomack.com/your-name",
  },
  boomplay: {
    label: "Boomplay",
    shortLabel: "Boomplay",
    color: "#A3E635",
    dashboardLabel: "Open Boomplay for Artists",
    growthMetric: null,
    growthMetricLabel: null,
    placeholderUrl: "https://www.boomplay.com/artists/…",
  },
  youtube: {
    label: "YouTube",
    shortLabel: "YouTube",
    color: "#FF0033",
    dashboardLabel: "Open YouTube Studio",
    growthMetric: "subscribers",
    growthMetricLabel: "Subscribers",
    placeholderUrl: "https://www.youtube.com/@yourchannel",
  },
  tiktok: {
    label: "TikTok",
    shortLabel: "TikTok",
    color: "#25F4EE",
    color2: "#FE2C55",
    dashboardLabel: "Open TikTok Studio",
    growthMetric: "followers",
    growthMetricLabel: "Followers",
    placeholderUrl: "",
  },
};

/** One-tap artist dashboard on the platform itself (public URLs only). */
export function platformDashboardUrl(
  platform: PromotionPlatform,
  externalId: string | null,
): string {
  switch (platform) {
    case "spotify":
      return "https://artists.spotify.com/";
    case "apple_music":
      return "https://artists.apple.com/";
    case "audiomack":
      return "https://audiomack.com/creator";
    case "boomplay":
      return "https://artist.boomplaymusic.com/";
    case "youtube":
      return externalId
        ? `https://studio.youtube.com/channel/${externalId}`
        : "https://studio.youtube.com/";
    case "tiktok":
      return "https://www.tiktok.com/tiktokstudio";
  }
}

/** Manual refresh cooldown per user × platform. */
export const PROMOTION_SYNC_COOLDOWN_MS = 15 * 60_000;

/** Remaining cooldown in ms (0 when a manual sync is allowed). Pure + testable. */
export function syncCooldownRemainingMs(
  lastSyncedAt: string | null | undefined,
  now: number = Date.now(),
): number {
  if (!lastSyncedAt) return 0;
  const elapsed = now - new Date(lastSyncedAt).getTime();
  return Math.max(0, PROMOTION_SYNC_COOLDOWN_MS - elapsed);
}

/** Compact display of big counts: 1.2K / 3.4M. */
export function formatCompactCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1000) return String(n);
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}
