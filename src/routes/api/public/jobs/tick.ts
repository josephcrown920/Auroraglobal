// Worker tick endpoint — the single recurring driver of the job queue.
// Invoked by the managed Replit cron workflow. See
// scripts/aurora-cron-daemon.sh for the scheduling contract.
//
// Each tick: (1) records a heartbeat so a stalled scheduler is observable in
// admin, (2) recovers jobs orphaned in `processing` by a dead worker, (3) re-
// enqueues orphaned `failed` jobs/generations that should still be retried, then
// (4) processes a batch of queued jobs. Auth requires the server-only
// CRON_SECRET — see src/lib/cron-auth.ts.

import { createFileRoute } from "@tanstack/react-router";
import { authorizeCronStrict } from "@/lib/cron-auth";
import { safeErrorMessage } from "@/lib/safe-error.server";

const HEARTBEAT_NAME = "jobs_tick";

export const Route = createFileRoute("/api/public/jobs/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorizeCronStrict(request)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const {
          processBatch,
          sweepStaleProcessingJobs,
          sweepHighValueStaleProcessingJobs,
          sweepFailedJobs,
          sweepStuckReservations,
          recordSchedulerHeartbeat,
        } = await import("@/lib/jobs.server");
        const { advanceSpinQueueAdmin } = await import("@/lib/spin.functions");

        try {
          // High-value kinds (motion/performance_reskin) get a tighter reclaim
          // window first so their bigger reservation isn't stuck for the full
          // global window if the job never reached a worker.
          const sweptHighValue = await sweepHighValueStaleProcessingJobs();
          const swept = await sweepStaleProcessingJobs();
          const recovered = await sweepFailedJobs();
          const reconciled = await sweepStuckReservations();
          const workerId = `tick:${crypto.randomUUID().slice(0, 8)}`;
          const results = await processBatch(workerId, 5);
          // Spin (`/spin`) batches otherwise only advance while a browser tab is
          // open polling tickSpinJob — this piggybacks on the same per-minute
          // cron so a closed tab / lost connection never leaves a batch stuck
          // mid-way. Best-effort: a spin render failure must never fail the tick.
          let spin: { jobsAdvanced: number; variantsProcessed: number } | { error: string };
          try {
            spin = await advanceSpinQueueAdmin();
          } catch (e) {
            spin = { error: safeErrorMessage("jobs/tick:spin", e) };
          }
          // TikTok publishing is asynchronous. Continue status checks after the
          // initiating browser closes so posts cannot remain processing forever.
          let tiktok: import("@/lib/tiktok-posting.server").TiktokPostSweepResult | { error: string };
          try {
            const { sweepStaleTiktokPosts } = await import("@/lib/tiktok-posting.server");
            tiktok = await sweepStaleTiktokPosts();
          } catch (e) {
            // Best-effort: a TikTok outage must not stop render queue processing.
            tiktok = { error: safeErrorMessage("jobs/tick:tiktok", e) };
          }
          await recordSchedulerHeartbeat(HEARTBEAT_NAME, true);
          return new Response(JSON.stringify({ ok: true, sweptHighValue, swept, recovered, reconciled, results, spin, tiktok }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Record the failure so the admin staleness banner can surface it, then
          // return 5xx so external cron monitoring sees the breakage.
          await recordSchedulerHeartbeat(HEARTBEAT_NAME, false, msg);
          return new Response(JSON.stringify({ ok: false, error: safeErrorMessage("jobs/tick", e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
