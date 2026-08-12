import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import {
  featureVisibilityLoader,
  featureVisibilityRobotsMeta,
} from "@/lib/feature-visibility-seo.functions";

export const Route = createFileRoute("/ugc")({
  loader: featureVisibilityLoader("ugc"),
  head: ({ loaderData }) => ({
    meta: [
      { title: "UGC Factory — Aurora" },
      { name: "description", content: "Pick an AI avatar and generate scroll-stopping UGC ads in seconds. iPhone realism, product in hand, native social vibe." },
      { property: "og:title", content: "UGC Factory — Aurora" },
      { property: "og:description", content: "Pick an avatar, drop your product, ship UGC ads. iPhone-real, native, scroll-stopping." },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/ugc` },
      featureVisibilityRobotsMeta(loaderData),
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/ugc` }],
  }),
});

