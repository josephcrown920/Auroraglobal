import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Studio — Aurora" },
      { name: "description", content: "The full Aurora studio: upload references, pick a model, run generations and iterate on cinematic shots." },
      { property: "og:title", content: "Aurora Studio" },
      { property: "og:description", content: "Run image and video generations across every top model from one canvas." },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/studio" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/studio" }],
  }),
});

