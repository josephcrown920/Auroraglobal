import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/nexusarb")({
  head: () => ({
    meta: [
      { title: "NexusARB — Trading Simulation (Educational) · Aurora" },
      {
        name: "description",
        content:
          "NexusARB is a paper-trading simulation that monitors 30+ crypto, forex and commodity pairs with live crypto prices and technical indicators. Educational use only — no real trades or withdrawals.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

