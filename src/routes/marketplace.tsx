import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Template Marketplace — Aurora" },
      {
        name: "description",
        content:
          "Browse creator-made AI canvas templates. One tap to load, instantly charged to your Aura balance.",
      },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/marketplace" }],
  }),
});

