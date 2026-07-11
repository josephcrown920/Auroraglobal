import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/motion")({
  // Deep-link prefill used by Guided Workflows (/guides/$slug): hand off a
  // generated image + context prompt straight into Motion Transfer.
  validateSearch: (
    search: Record<string, unknown>,
  ): { prompt?: string; image?: string } => ({
    prompt:
      typeof search.prompt === "string" && search.prompt.trim()
        ? search.prompt.slice(0, 2000)
        : undefined,
    image:
      typeof search.image === "string" && /^https:\/\//.test(search.image)
        ? search.image
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Perform Anywhere — Aurora" },
      { name: "description", content: "Record yourself performing on your phone. Aurora transfers your motion into your AI-generated scene — no studio, no crew." },
      { property: "og:title", content: "Perform Anywhere — Aurora" },
      { property: "og:description", content: "Generate your AI scene in Colors Studio, film yourself performing, animate with motion transfer." },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/motion" }],
  }),
});

