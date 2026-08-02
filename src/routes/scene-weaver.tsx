import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";

export const Route = createFileRoute("/scene-weaver")({
  head: () => ({
    meta: [
      { title: "Scene Weaver — Aurora" },
      {
        name: "description",
        content: "Remove subjects from a frame, rebuild the clean plate, and generate alternate camera angles.",
      },
      { property: "og:title", content: "Scene Weaver — Aurora" },
      {
        property: "og:description",
        content: "Keep the scene. Change the angle.",
      },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/scene-weaver` },
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/scene-weaver` }],
  }),
});