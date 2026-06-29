// Worker tick endpoint — the single recurring driver of the job queue.
// Invoked by an external Supabase dashboard pg_cron job (Replit autoscale is
// request-driven, so there is no durable in-process timer). See the README
// section "Scheduling the worker tick" for the dashboard SQL.
//
// Each tick: (1) records a heartbeat so a stalled scheduler is observable in
// admin, (2) recovers jobs orphaned in `processing` by a dead worker, then
// (3) processes a batch of queued jobs. Auth accepts CRON_SECRET (preferred) or
// the legacy Supabase anon key — see src/lib/cron-auth.ts.

import { createFileRoute } from "@tanstack/react-router";
import { authorizeCron } from "@/lib/cron-auth";

const HEARTBEAT_NAME = "jobs_tick";

export const Route = createFileRoute("/api/public/jobs/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorizeCron(request)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { processBatch, sweepStaleProcessingJobs, recordSchedulerHeartbeat } = await import(
          "@/lib/jobs.server"
        );

        try {
          const swept = await sweepStaleProcessingJobs();
          const workerId = `tick:${crypto.randomUUID().slice(0, 8)}`;
          const results = await processBatch(workerId, 5);
          await recordSchedulerHeartbeat(HEARTBEAT_NAME, true);
          return new Response(JSON.stringify({ ok: true, swept, results }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Record the failure so the admin staleness banner can surface it, then
          // return 5xx so external cron monitoring sees the breakage.
          await recordSchedulerHeartbeat(HEARTBEAT_NAME, false, msg);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
