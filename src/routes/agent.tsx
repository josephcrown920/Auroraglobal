import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/agent")({
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Video Studio & AI Agent — Aurora" },
      { name: "description", content: "Generate video, images, and audio in one studio — or describe the shot in plain language and let Aurora's agent plan and render it for you." },
      { property: "og:title", content: "Video Studio & AI Agent — Aurora" },
      { property: "og:description", content: "One video hub: quick multi-model generation plus a planning agent that iterates on and renders creative shots." },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/agent" }],
  }),
});

