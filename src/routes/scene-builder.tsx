import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";

export const Route = createFileRoute("/scene-builder")({
  head: () => ({
    meta: [
      { title: "Directors ROOM — Aurora" },
      {
        name: "description",
        content:
          "Build your scene from references — selfie, outfit, location, prop. Generate a fully composited cinematic still, then animate it with Phone Performance motion control.",
      },
      { property: "og:title", content: "Directors ROOM — Aurora" },
      {
        property: "og:description",
        content:
          "Drop your references, build your scene, add angles. Your shoot. Your direction. Every frame.",
      },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/scene-builder` },
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/scene-builder` }],
  }),
});
