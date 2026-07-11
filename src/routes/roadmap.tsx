import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "Roadmap — Aurora" },
      { name: "description", content: "See what's live, what's being built, and what's planned for Aurora AI Creative Studio." },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/roadmap" }],
  }),
});

