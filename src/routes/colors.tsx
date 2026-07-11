import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/colors")({
  head: () => ({
    meta: [
      { title: "Colors Studio — Aurora" },
      { name: "description", content: "Studio-grade color portrait shoots: pick a color, pick a scene (studio, indoor, rooftop, street), generate in seconds." },
      { property: "og:title", content: "Colors Studio — Aurora" },
      { property: "og:description", content: "Pick a color and a scene — get a finished cinematic portrait." },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/colors" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/colors" }],
  }),
});

