import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/director-room")({
  head: () => ({
    meta: [
      { title: "Director's Room — Storyboard and Render · Aurora" },
      {
        name: "description",
        content:
          "Aurora Director's Room: collaborate with an AI director, build a shot board, generate frames, and queue video renders.",
      },
      { property: "og:title", content: "Aurora Director's Room" },
      {
        property: "og:description",
        content: "Storyboard, cast, generate, and render your cinematic music video in one room.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
