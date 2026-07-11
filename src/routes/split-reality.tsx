import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/split-reality")({
  head: () => ({
    meta: [
      { title: "Split Reality — Aurora" },
      {
        name: "description",
        content:
          "One subject, two realities. Generate an ultra-realistic mirror-selfie AND a cinematic close-up side-by-side from the same references.",
      },
      { property: "og:title", content: "Split Reality — Aurora" },
      {
        property: "og:description",
        content:
          "Run two parallel realities of the same subject — documentary realism on one side, cinematic anamorphic close-up on the other.",
      },
      {
        property: "og:url",
        content: "https://aurorastudiostar.lovable.app/split-reality",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://aurorastudiostar.lovable.app/split-reality",
      },
    ],
  }),
});

