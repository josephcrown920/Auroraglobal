import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/director-room")({
  head: () => ({
    meta: [
      { title: "Director's Chair — Shoot a $20,000 Music Video for a Fraction" },
      {
        name: "description",
        content:
          "Aurora Director's Chair: plan, cast, storyboard, and shoot cinematic music videos with AI. Get a $20,000-look shoot for a fraction of the cost.",
      },
      { property: "og:title", content: "Aurora Director's Chair" },
      {
        property: "og:description",
        content:
          "Cinematic music-video pipeline: casting, storyboarding, camera moves, and finishing — all AI-assisted.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
