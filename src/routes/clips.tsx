import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/clips")({
  head: () => ({
    meta: [
      { title: "Clip Preview — Generated Assets" },
      { name: "description", content: "Preview, compare, tweak, and approve generated clips." },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/clips" }],
  }),
});

