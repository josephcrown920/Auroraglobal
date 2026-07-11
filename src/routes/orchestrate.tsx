import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/orchestrate")({
  head: () => ({
    meta: [
      { title: "Multi-Model Orchestrator — Aurora" },
      { name: "description", content: "Generate images, video, text, and audio in one place — Aurora auto-routes each request to the best available AI model." },
      { property: "og:title", content: "Multi-Model Orchestrator — Aurora" },
      { property: "og:description", content: "One prompt box, every modality. Aurora picks the right model and falls back automatically if one is down." },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/orchestrate" }],
  }),
});

