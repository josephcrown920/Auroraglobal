import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Aurora Studio" },
      { name: "description", content: "Sign in or create an Aurora Studio account. The studio built by pro artists, for artists who need to scale massively." },
      { property: "og:title", content: "Sign in to Aurora Studio" },
      { property: "og:description", content: "Sign in or create an Aurora account. Built by pro artists, for artists who need to scale massively." },
      { property: "og:url", content: "https://auroraperformancestudio.com/auth" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/auth" }],
  }),
});
