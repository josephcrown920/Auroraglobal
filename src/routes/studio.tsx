import { createFileRoute } from "@tanstack/react-router";

type StudioSearch = { q?: string };

export const Route = createFileRoute("/studio")({
  // Optional idea handed over from the home composer / preset cards.
  validateSearch: (search: Record<string, unknown>): StudioSearch => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q.trim() : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Studio — Aurora" },
      { name: "description", content: "The full Aurora studio: upload references, pick a model, run generations and iterate on cinematic shots." },
      { property: "og:title", content: "Aurora Studio" },
      { property: "og:description", content: "Run image and video generations across every top model from one canvas." },
      { property: "og:url", content: "https://auroraperformancestudio.com/studio" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/studio" }],
  }),
});

