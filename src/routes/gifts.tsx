import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/gifts")({
  head: () => ({
    meta: [
      { title: "Gift Cards — Aurora" },
      { name: "description", content: "Gift Aura to another creator, or redeem a gift card to top up your own balance." },
      { property: "og:title", content: "Aurora Gift Cards" },
      { property: "og:description", content: "Gift Aura to a creator, or redeem a card on your account." },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/gifts" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/gifts" }],
  }),
});

