import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import {
  featureVisibilityLoader,
  featureVisibilityRobotsMeta,
} from "@/lib/feature-visibility-seo.functions";

export const Route = createFileRoute("/soul/vibe")({
  loader: featureVisibilityLoader("soul"),
  head: ({ loaderData }) => ({
    meta: [
      { title: "Vibe Matcher — Aurora Soul" },
      { name: "description", content: "Turn any reference image into a reusable named visual vibe preset. Free — no credits charged." },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/soul/vibe` },
      featureVisibilityRobotsMeta(loaderData),
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/soul/vibe` }],
  }),
});
