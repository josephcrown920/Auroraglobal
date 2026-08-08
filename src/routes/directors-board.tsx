import { createFileRoute } from "@tanstack/react-router";
import { StudioPage } from "@/features/storyboard/studio/StudioPage";

export const Route = createFileRoute("/directors-board")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Directors Board — Storyboard Canvas · Aurora" },
      {
        name: "description",
        content:
          "Chain shot nodes, generate AI frames, direct your music video storyboard, and export your board as a ZIP.",
      },
      { property: "og:title", content: "Directors Board · Aurora" },
      {
        property: "og:description",
        content:
          "Visual storyboard canvas: chain shots, generate frames with AI, cast characters, and queue video renders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudioPage,
});
