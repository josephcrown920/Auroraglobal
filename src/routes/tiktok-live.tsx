import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tiktok-live")({
  head: () => ({
    meta: [
      { title: "TikTok LIVE Studio — Aurora" },
      { name: "description", content: "Build the ultimate TikTok LIVE experience. Generate AI backgrounds, scenes and overlays for your stream — powered by Aurora." },
      { property: "og:title", content: "TikTok LIVE Studio — Aurora" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/tiktok-live" }],
  }),
});
