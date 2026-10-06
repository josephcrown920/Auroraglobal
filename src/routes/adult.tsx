import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import {
  featureVisibilityLoader,
  featureVisibilityRobotsMeta,
} from "@/lib/feature-visibility-seo.functions";

export const Route = createFileRoute("/adult")({
  loader: featureVisibilityLoader("adult-school"),
  head: ({ loaderData }) => ({
    meta: [
      { title: "Adult School — Aurora" },
      {
        name: "description",
        content: "A private, identity-locked editorial photoshoot studio for 18+ creators.",
      },
      { property: "og:title", content: "Adult School — Aurora" },
      {
        property: "og:description",
        content: "Create private, identity-locked editorial shots in Aurora's Adult School.",
      },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/adult` },
      featureVisibilityRobotsMeta(loaderData),
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/adult` }],
  }),
});