import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";

export const Route = createFileRoute("/agent")({
  head: () => ({
    meta: [
      { title: "AI Creative Agent — Aurora" },
      {
        name: "description",
        content:
          "Describe the shot you want in plain language — Aurora's agent plans it and renders it for you.",
      },
      { property: "og:title", content: "AI Creative Agent — Aurora" },
      {
        property: "og:description",
        content: "Chat with Aurora's planning agent to iterate on and render creative shots.",
      },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/agent` },
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/agent` }],
  }),
});
