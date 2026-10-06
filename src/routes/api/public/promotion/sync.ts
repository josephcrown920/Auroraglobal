// POST /api/public/promotion/sync — daily refresh of every linked Promotion
// platform (5 link platforms + stats-capable TikTok accounts). Idempotent:
// snapshots are one row per (user, platform, UTC day), so retries overwrite.
// Auth requires the server-only CRON_SECRET used by the managed scheduler.

import { authorizeCronStrict } from "@/lib/cron-auth";
import { createFileRoute } from "@tanstack/react-router";
import { syncAllPromotionPlatforms } from "@/lib/promotion/sync.server";
import { safeErrorMessage } from "@/lib/safe-error.server";

export const Route = createFileRoute("/api/public/promotion/sync")({
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
          const result = await syncAllPromotionPlatforms();
          console.info(
            `[promotion-sync] day=${new Date().toISOString().slice(0, 10)} done=${result.done} busy=${result.busy} synced=${result.synced} failed=${result.failed} skipped=${result.skipped} retryOverflow=${result.retryOverflow}`,
          );
          if (result.busy) {
            // Another live runner holds today's lease — retry next tick.
            return new Response(JSON.stringify({ ok: false, busy: true }), {
              status: 503,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (!result.done) {
            // Work remains — 503 tells the daemon to retry next tick; the
            // persisted checkpoint resumes exactly where this run stopped.
            return new Response(JSON.stringify({ ok: false, more: true, ...result }), {
              status: 503,
              headers: { "Content-Type": "application/json" },
            });
          }
          // Done: per-row failures already had their one same-day retry pass;
          // they stay on the rows as last_error and a fresh checkpoint
          // retries them tomorrow.
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: safeErrorMessage("promotion-sync", e instanceof Error ? e.message : "unknown") }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
