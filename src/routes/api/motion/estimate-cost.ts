import { createFileRoute } from "@tanstack/react-router";
import { computeCost } from "@/lib/pricing";
import { authenticatedUserId } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/motion/estimate-cost")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await authenticatedUserId(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        // Motion pricing is intentionally derived from the same canonical
        // pricing module used by Studio/MCP. The current reference is 5s/720p.
        const fullCost = computeCost({
          features: ["motion"],
          durationSeconds: 5,
          resolution: "720p",
        }).total;
        const previewCost = Math.max(1, Math.ceil(fullCost * 0.5));

        return Response.json({
          kind: "motion",
          currency: "Aura",
          reference: { durationSeconds: 5, resolution: "720p" },
          fullCost,
          previewCost,
        });
      },
    },
  },
});
