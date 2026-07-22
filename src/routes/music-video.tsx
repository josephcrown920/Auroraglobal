import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/music-video")({
  head: () => ({
    meta: [
      { title: "Music Video Studio — Aurora" },
      {
        name: "description",
        content:
          "Build cinematic music videos with AI — beat-sync, lyric video, AI performance, cover art animation, and style transfer.",
      },
      { property: "og:title", content: "Music Video Studio — Aurora" },
      {
        property: "og:description",
        content: "Six AI video tools built for artists and directors.",
      },
      { property: "og:url", content: "https://auroraperformancestudio.com/music-video" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/music-video" }],
  }),
});

