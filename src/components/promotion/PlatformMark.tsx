// Self-drawn platform marks for the Promotion Hub (lucide dropped brand icons).
// Simple geometric glyphs in each platform's brand colour — inline SVG, no assets.
import type { PromotionPlatform } from "@/lib/promotion/types";

export function PlatformMark({
  platform,
  className = "size-5",
}: {
  platform: PromotionPlatform;
  className?: string;
}) {
  switch (platform) {
    case "spotify":
      return (
        <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Spotify">
          <circle cx="12" cy="12" r="10" fill="#1DB954" />
          <path
            d="M7 9.5c3.2-1 6.8-.8 9.6 1M7.5 12.5c2.7-.8 5.6-.6 8 .8M8 15.3c2.2-.6 4.4-.4 6.4.7"
            stroke="#0b1d12" strokeWidth="1.6" strokeLinecap="round" fill="none"
          />
        </svg>
      );
    case "apple_music":
      return (
        <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Apple Music">
          <rect x="3" y="3" width="18" height="18" rx="5" fill="#FA2D48" />
          <path
            d="M15.5 6.5v8.2a2.4 2.4 0 1 1-1.6-2.3V8.8l-4.5 1v6.4a2.4 2.4 0 1 1-1.6-2.3V8l7.7-1.7z"
            fill="#fff"
          />
        </svg>
      );
    case "audiomack":
      return (
        <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Audiomack">
          <rect x="3" y="3" width="18" height="18" rx="5" fill="#FFA200" />
          <rect x="7" y="12" width="2" height="6" rx="1" fill="#1a1206" />
          <rect x="11" y="7.5" width="2" height="10.5" rx="1" fill="#1a1206" />
          <rect x="15" y="10" width="2" height="8" rx="1" fill="#1a1206" />
        </svg>
      );
    case "boomplay":
      return (
        <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Boomplay">
          <rect x="3" y="3" width="18" height="18" rx="5" fill="#A3E635" />
          <path
            d="M9 6.8v7.7a2.2 2.2 0 1 1-1.5-2.1V8.4l8-1.9v6.2a2.2 2.2 0 1 1-1.5-2.1V8.9L9 10.4"
            fill="#12210a"
          />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" className={className} role="img" aria-label="YouTube">
          <rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="#FF0033" />
          <path d="M10.2 9.2v5.6l4.8-2.8z" fill="#fff" />
        </svg>
      );
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" className={className} role="img" aria-label="TikTok">
          <rect x="3" y="3" width="18" height="18" rx="5" fill="#0f0f14" />
          <path
            d="M15.7 6c.4 1.7 1.5 2.7 3.3 2.8v2.6c-1.2 0-2.3-.4-3.3-1.1v4.5a4.6 4.6 0 1 1-4.6-4.6c.3 0 .5 0 .8.1v2.7a1.9 1.9 0 1 0 1.1 1.8V6z"
            fill="#25F4EE"
          />
          <path
            d="M14.9 6.6c.4 1.5 1.4 2.4 2.9 2.5v1.6c-1.1 0-2.1-.3-2.9-.9v4.4a3.9 3.9 0 1 1-3.9-3.9v1.7a2.2 2.2 0 1 0 2.2 2.2V6.6z"
            fill="#FE2C55"
            opacity="0.85"
          />
        </svg>
      );
  }
}
