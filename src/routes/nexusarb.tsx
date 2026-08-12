import { createFileRoute } from "@tanstack/react-router";
import {
  featureVisibilityLoader,
  featureVisibilityRobotsMeta,
} from "@/lib/feature-visibility-seo.functions";

export const Route = createFileRoute("/nexusarb")({
  loader: featureVisibilityLoader("nexusarb"),
  head: ({ loaderData }) => ({
    meta: [
      { title: "NexusARB — Trading Simulation (Educational) · Aurora" },
      {
        name: "description",
        content:
          "NexusARB is a paper-trading simulation that monitors 30+ crypto, forex and commodity pairs with live crypto prices and technical indicators. Educational use only — no real trades or withdrawals.",
      },
      featureVisibilityRobotsMeta(loaderData),
    ],
  }),
});

