// Cron-only motion capacity reconciler. It cannot receive provider IDs, offers,
// URLs, or any user-controlled spend instruction.

import { authorizeCronStrict } from "@/lib/cron-auth";
import { safeErrorMessage } from "@/lib/safe-error.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/vast/autoscale")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorizeCronStrict(request)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const { liveMotionAutoscaler } = await import("@/lib/motion-autoscaler-live.server");
          const status = await liveMotionAutoscaler().reconcile();
          return new Response(JSON.stringify({ ok: true, status }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          return new Response(JSON.stringify({ ok: false, error: safeErrorMessage("vast/autoscale", error) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});