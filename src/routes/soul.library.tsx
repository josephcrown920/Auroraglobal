import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import {
  featureVisibilityLoader,
  featureVisibilityRobotsMeta,
} from "@/lib/feature-visibility-seo.functions";

export const Route = createFileRoute("/soul/library")({
  loader: featureVisibilityLoader("soul"),
  head: ({ loaderData }) => ({
    meta: [
      { title: "Library — Aurora Soul" },
      { name: "description", content: "Your trained souls and generated videos." },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/soul/library` },
      featureVisibilityRobotsMeta(loaderData),
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/soul/library` }],
  }),
});
