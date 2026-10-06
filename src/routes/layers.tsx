import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";

export const Route = createFileRoute("/layers")({
  head: () => ({
    meta: [
      { title: "Aurora Layers — Aurora" },
      {
        name: "description",
        content: "Aurora's non-destructive layer editor for images, video, compositing and creative projects.",
      },
      { property: "og:title", content: "Aurora Layers — Aurora" },
      {
        property: "og:description",
        content: "Edit, stack and composite creative layers inside Aurora.",
      },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/layers` },
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/layers` }],
  }),
});
