import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/workflows")({
  head: () => ({
    meta: [
      { title: "Workflows — Aurora Studio" },
      { name: "description", content: "Save, share, and re-run your Aurora generation graphs across image, video and lip-sync models." },
      { property: "og:title", content: "Aurora Workflows" },
      { property: "og:description", content: "Reusable multi-model AI workflows you can save, share and re-run." },
      { property: "og:url", content: "https://auroraperformancestudio.com/workflows" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/workflows" }],
  }),
});

