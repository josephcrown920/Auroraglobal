import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import {
  featureVisibilityLoader,
  featureVisibilityRobotsMeta,
} from "@/lib/feature-visibility-seo.functions";

export const Route = createFileRoute("/ugc-line")({
  loader: featureVisibilityLoader("content-line"),
  head: ({ loaderData }) => ({
    meta: [
      { title: "Content Line — Aurora" },
      { name: "description", content: "Generate a coordinated UGC content line: a batch of short-form video briefs with distinct hook arcs, plus outfit and scene variations from a reference photo." },
      { property: "og:title", content: "Content Line — Aurora" },
      { property: "og:description", content: "Batch UGC brief generator with coordinated script arc + outfit/scene variation grid." },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/ugc-line` },
      featureVisibilityRobotsMeta(loaderData),
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/ugc-line` }],
  }),
});
