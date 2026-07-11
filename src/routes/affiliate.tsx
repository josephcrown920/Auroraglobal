import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/affiliate")({
  head: () => ({
    meta: [
      { title: "Affiliate program — Aurora Studio" },
      { name: "description", content: "Earn 20% recurring on every Aura purchase you refer. Track clicks, conversions and payouts in one dashboard." },
      { property: "og:title", content: "Aurora Affiliate Program — 20% recurring" },
      { property: "og:description", content: "Refer creators, earn 20% recurring commission on every Aura purchase." },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/affiliate" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/affiliate" }],
  }),
});

