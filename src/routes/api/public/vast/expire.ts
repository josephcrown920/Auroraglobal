// POST /api/public/vast/expire — cron endpoint that destroys every
// Aurora-managed Vast instance past its 1-hour destroy deadline. Authed via
// the Supabase anon `apikey` header, same pattern as /api/public/workers/health.
// Retry-safe: failed destroys stay active and are retried on the next sweep.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/vast/expire")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ||
          request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!expected || apikey !== expected) {
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
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
