import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/content-machine")({
  head: () => ({
    meta: [
      { title: "Content Machine — Aurora" },
      {
        name: "description",
        content:
          "Save your products, pick reusable content templates and batch-generate faceless TikTok-style videos in one click. A node-graph pipeline and live analytics track every render.",
      },
      { property: "og:title", content: "Content Machine — Aurora" },
      {
        property: "og:description",
        content:
          "Turn one product into a wall of faceless short-form videos. Reusable templates, batch generation and real per-batch analytics.",
      },
      { property: "og:url", content: "https://auroraperformancestudio.com/content-machine" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/content-machine" }],
  }),
});

