import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/ugc-line")({
  head: () => ({
    meta: [
      { title: "Content Line — Aurora" },
      { name: "description", content: "Generate a coordinated UGC content line: a batch of short-form video briefs with distinct hook arcs, plus outfit and scene variations from a reference photo." },
      { property: "og:title", content: "Content Line — Aurora" },
      { property: "og:description", content: "Batch UGC brief generator with coordinated script arc + outfit/scene variation grid." },
      { property: "og:url", content: "https://auroraperformancestudio.com/ugc-line" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/ugc-line" }],
  }),
});
