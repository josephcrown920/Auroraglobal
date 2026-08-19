import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/directors-board")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/director-room", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Director Room — Storyboard Canvas · Aurora" },
      {
        name: "description",
        content:
          "Chain shot nodes, generate AI frames, direct your music video storyboard, and export your board as a ZIP.",
      },
      { property: "og:title", content: "Director Room · Aurora" },
      {
        property: "og:description",
        content:
          "Visual storyboard canvas: chain shots, generate frames with AI, cast characters, and queue video renders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
