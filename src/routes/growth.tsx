import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/growth")({
  head: () => ({
    meta: [
      { title: "Artist Growth Tools — Aurora" },
      {
        name: "description",
        content:
          "AI-powered growth tools for music artists: daily post generator, release rollout plan, and social media pack.",
      },
      { property: "og:title", content: "Artist Growth Tools — Aurora" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/growth" }],
  }),
});

