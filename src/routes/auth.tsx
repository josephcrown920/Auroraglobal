import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Aurora Studio" },
      { name: "description", content: "Sign in or create an Aurora Studio account. 5 free Aura on signup." },
      { property: "og:title", content: "Sign in to Aurora Studio" },
      { property: "og:description", content: "Sign in or create an Aurora account. New creators get 5 free Aura." },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/auth" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/auth" }],
  }),
});
