import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/directors-board")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Director's Board — Aurora" },
      {
        name: "description",
        content:
          "Aurora Director's Board for visual music-video storyboarding and creative direction.",
      },
      { property: "og:title", content: "Aurora Director's Board" },
      {
        property: "og:description",
        content: "Visual music-video storyboard and director workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
