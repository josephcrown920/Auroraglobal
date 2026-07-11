import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "Plan & Billing — Aurora" },
      { name: "description", content: "Manage your Aurora subscription, view your Aura balance, and purchase credit packs." },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/billing" }],
  }),
});

