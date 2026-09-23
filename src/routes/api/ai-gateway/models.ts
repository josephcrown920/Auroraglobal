import { createFileRoute } from "@tanstack/react-router";
import { FREE_AI_MODELS } from "@/lib/ai-gateway-free-models";

export const Route = createFileRoute("/api/ai-gateway/models")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          models: FREE_AI_MODELS,
          freeVideoGeneration: false,
          note: "No $0 video-output model was verified in the current Vercel AI Gateway/OpenRouter catalogs. Free video-capable models currently provide video understanding; Aurora's Seedance/other video generators remain separate provider paths.",
        }),
    },
  },
});
