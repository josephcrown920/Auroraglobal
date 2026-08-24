// POST /api/public/vast/expire — cron endpoint that destroys every
// Aurora-managed Vast instance past its 1-hour destroy deadline. Authed via
// the server-only CRON_SECRET.
// Retry-safe: failed destroys stay active and are retried on the next sweep.

import { authorizeCronStrict } from "@/lib/cron-auth";
import { safeErrorMessage } from "@/lib/safe-error.server";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/vast/expire")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorizeCronStrict(request)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        // No Vast key configured → nothing Aurora could be managing; report
        // cleanly instead of erroring the whole cron loop.
        if (!process.env.VASTAI_API_KEY) {
          return new Response(JSON.stringify({ ok: true, skipped: "VASTAI_API_KEY not configured" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { liveVastLifecycle } = await import("@/lib/vast-lifecycle-live.server");
          const { expired, failed } = await liveVastLifecycle().expireOverdue();
          if (expired.length > 0) console.log(`[vast/expire] auto-destroyed at deadline: ${expired.join(", ")}`);
          for (const f of failed) console.error(`[vast/expire] destroy FAILED for ${f.vastId}: ${f.error} (will retry)`);
          return new Response(JSON.stringify({ ok: true, expired: expired.length, failed: failed.length }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: safeErrorMessage("vast/expire", e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
