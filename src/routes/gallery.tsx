import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery — Aurora" },
      { name: "description", content: "Your permanent Aurora gallery of generated photos and videos. Favorite, download and re-run any shot." },
      { property: "og:title", content: "Aurora Gallery" },
      { property: "og:description", content: "Your library of AI-generated photos, lip-sync clips and video shots." },
      { property: "og:url", content: "https://auroraperformancestudio.com/gallery" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/gallery" }],
  }),
});

