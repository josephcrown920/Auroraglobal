import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Dashboard — Aurora" },
      { name: "description", content: "Manage your Aura balance, billing, recent generations and account settings." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://auroraperformancestudio.com/dashboard" }],
  }),
});

