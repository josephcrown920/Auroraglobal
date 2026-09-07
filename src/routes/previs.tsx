import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";

export const Route = createFileRoute("/previs")({
  head: () => ({
    meta: [
      { title: "Previs Workspace — Aurora" },
      {
        name: "description",
        content: "Plan shots, generate preview plates, review continuity, and export a production-ready storyboard.",
      },
      { property: "og:title", content: "Previs Workspace — Aurora" },
      {
        property: "og:description",
        content: "Turn a creative brief into an editable visual shot sequence before spending on final renders.",
      },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/previs` },
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/previs` }],
  }),
});