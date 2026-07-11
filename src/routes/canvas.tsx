import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/canvas")({
  head: () => ({
    meta: [
      { title: "Canvas — Aurora Orchestration" },
      { name: "description", content: "Node-based AI orchestration. Chain models, add lip-sync, motion and color in one trending workflow." },
      { property: "og:title", content: "Aurora Canvas — Trending AI workflows" },
      { property: "og:description", content: "Drag, chain and run multi-model AI workflows with an in-canvas agent." },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/canvas" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/canvas" }],
  }),
});

