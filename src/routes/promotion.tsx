import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/promotion")({
  validateSearch: (search: Record<string, unknown>): { tiktok?: string; msg?: string } => ({
    tiktok: typeof search.tiktok === "string" ? search.tiktok : undefined,
    msg: typeof search.msg === "string" ? search.msg : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Promotion — all your artist stats in one place — Aurora" },
      {
        name: "description",
        content:
          "Follow your Spotify, Apple Music, Audiomack, Boomplay, YouTube and TikTok numbers in one place: followers, plays, top tracks and growth over time.",
      },
      { property: "og:title", content: "Promotion — Aurora Performance Studio" },
      {
        property: "og:description",
        content: "Every platform. Every number. One hub for your artist stats.",
      },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/promotion" }],
  }),
});
