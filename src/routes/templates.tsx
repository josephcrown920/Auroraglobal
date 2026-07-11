import { createFileRoute } from "@tanstack/react-router";
type TemplateSearch = { open?: string; category?: string };

export const Route = createFileRoute("/templates")({
  validateSearch: (search: Record<string, unknown>): TemplateSearch => ({
    open: typeof search.open === "string" ? search.open : undefined,
    category: typeof search.category === "string" ? search.category : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Templates — Aurora" },
      {
        name: "description",
        content:
          "One-tap AI templates: upload a photo, tap generate, and get a lip-sync video, cinematic reel, UGC ad, or a 30-piece spin in seconds.",
      },
      { property: "og:title", content: "Aurora Templates — one tap to a viral video" },
      {
        property: "og:description",
        content: "Pick a template, drop in a photo, and Aurora renders the rest.",
      },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/templates" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/templates" }],
  }),
});

