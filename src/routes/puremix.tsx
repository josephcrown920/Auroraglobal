import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/puremix")({
  head: () => ({
    meta: [
      { title: "PureMix — Open-source AI mixing for artists | Aurora" },
      {
        name: "description",
        content:
          "PureMix is an open-source AI mixing and mastering companion for artists. Bring your stems, get pro-grade mixes, integrated into Aurora's Artists toolkit.",
      },
      { property: "og:title", content: "PureMix — AI mixing for artists" },
      {
        property: "og:description",
        content:
          "Open-source AI mixing & mastering companion built for artists — now part of Aurora's Artists tools.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/puremix" }],
  }),
});
