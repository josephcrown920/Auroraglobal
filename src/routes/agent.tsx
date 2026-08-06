import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import { OrchestrateStudio } from "@/components/orchestrate/OrchestrateStudio";

export const Route = createFileRoute("/agent")({
  component: HeyGenVideoAgent,
  head: () => ({
    meta: [
      { title: "HeyGen Video Agent — Aurora" },
      {
        name: "description",
        content:
          "Create an AI presenter video with HeyGen from inside Aurora. Write or enhance a script, choose the format, and render a finished video.",
      },
      { property: "og:title", content: "HeyGen Video Agent — Aurora" },
      {
        property: "og:description",
        content: "AI presenter videos with HeyGen, powered through Aurora.",
      },
      { property: "og:url", content: `${CANONICAL_ORIGIN}/agent` },
    ],
    links: [{ rel: "canonical", href: `${CANONICAL_ORIGIN}/agent` }],
  }),
});

function HeyGenVideoAgent() {
  return <OrchestrateStudio initialModel="heygen/video-agent" lockedModel />;
};
