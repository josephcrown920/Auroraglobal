import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";

export const Route = createFileRoute("/perform-anywhere")({
  head: () => ({
    meta: [
      { title: "Perform Anywhere — Aurora" },
      {
        name: "description",
        content: "Film yourself on your phone and let Aurora build the cinematic world around your performance.",
      },
      { property: "og:title", content: "Perform Anywhere — Aurora" },
      { property: "og:description", content: "Real movement in. Cinematic performance video out." },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/perform-anywhere` },
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/perform-anywhere` }],
  }),
});