import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import {
  featureVisibilityLoader,
  featureVisibilityRobotsMeta,
} from "@/lib/feature-visibility-seo.functions";

export const Route = createFileRoute("/soul")({
  loader: featureVisibilityLoader("soul"),
  head: ({ loaderData }) => ({
    meta: [
      { title: "Aurora Soul — Character Consistency Studio" },
      {
        name: "description",
        content:
          "Train a face once, then generate identity-locked images and video of that character on demand.",
      },
      { property: "og:title", content: "Aurora Soul — Character Consistency Studio" },
      {
        property: "og:description",
        content: "Train a face once, then generate identity-locked images and video of that character.",
      },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/soul` },
      featureVisibilityRobotsMeta(loaderData),
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/soul` }],
  }),
});
