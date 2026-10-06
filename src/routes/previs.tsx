import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";

export const Route = createFileRoute("/previs")({
  head: () => ({
    meta: [
      { title: "Multishot Studio & Previs — Aurora" },
      {
        name: "description",
        content: "Coordinate 2–8 shots with explicit Google, ModelArk, and supported GPU engines, then approve exact previews before promotion.",
      },
      { property: "og:title", content: "Multishot Studio & Previs — Aurora" },
      {
        property: "og:description",
        content: "Turn a creative brief into an editable visual shot sequence before spending on final renders.",
      },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/previs` },
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/previs` }],
  }),
});