import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/live-studio")({
  head: () => ({
    meta: [
      { title: "Live Performance Studios — Aurora" },
      { name: "description", content: "Place yourself into KEXP-style live session spaces and music video production sets. Upload your photo, pick a scene, generate in seconds." },
      { property: "og:title", content: "Live Performance Studios — Aurora" },
      { property: "og:description", content: "KEXP sessions, colored backdrops, arena stages — AI performance photography powered by Aurora." },
      { property: "og:url", content: "https://auroraperformancestudio.com/live-studio" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/live-studio" }],
  }),
});
