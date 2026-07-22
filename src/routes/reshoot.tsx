import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/reshoot")({
  head: () => ({
    meta: [
      { title: "Multi-Angle Reshoot — Aurora" },
      {
        name: "description",
        content:
          "Upload one portrait and instantly reshoot it from six cinematic camera angles — fish-eye, bird's-eye, low angle, Dutch tilt, macro and worm's-eye — with identity, outfit and lighting preserved.",
      },
      { property: "og:title", content: "Multi-Angle Reshoot — Aurora" },
      {
        property: "og:description",
        content:
          "One reference photo, six fixed camera angles. Same subject, same outfit, same scene — six brand-new vertical portraits in one click.",
      },
      { property: "og:url", content: "https://auroraperformancestudio.com/reshoot" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/reshoot" }],
  }),
});

