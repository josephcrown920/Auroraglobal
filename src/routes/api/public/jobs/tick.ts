// Worker tick endpoint — the single recurring driver of the job queue.
// Invoked by the production cron scheduler. The same tick also reconciles
// demand-driven motion GPU capacity so idle Vast rentals are destroyed and
// queued motion work can trigger a bounded fallback rental.
//
// Each tick: (1) records a heartbeat so a stalled scheduler is observable in
// admin, (2) recovers orphaned jobs/reservations, (3) reconciles motion
// autoscaling, then (4) processes queued work. Auth requires the server-only
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
          const sweptHighValue = await sweepHighValueStaleProcessingJobs();
          const swept = await sweepStaleProcessingJobs();
          const recovered = await sweepFailedJobs();
          const reconciled = await sweepStuckReservations();

          // Demand-driven motion capacity. Best-effort so a temporary
          // autoscaler/provider outage never prevents the normal queue from
          // draining. The controller is fail-closed and only provisions
          // when its explicit policy is enabled.
          let motionAutoscale: unknown;
          try {
            const { liveMotionAutoscaler } = await import("@/lib/motion-autoscaler-live.server");
            motionAutoscale = await liveMotionAutoscaler().reconcile();
          } catch (e) {
            motionAutoscale = { error: safeErrorMessage("jobs/tick:motion-autoscale", e) };
          }

          const workerId = `tick:${crypto.randomUUID().slice(0, 8)}`;
          const results = await processBatch(workerId, 5);

          let spin: { jobsAdvanced: number; variantsProcessed: number } | { error: string };
          try {
            spin = await advanceSpinQueueAdmin();
          } catch (e) {
            spin = { error: safeErrorMessage("jobs/tick:spin", e) };
          }

          let tiktok: import("@/lib/tiktok-posting.server").TiktokPostSweepResult | { error: string };
          try {
            const { sweepStaleTiktokPosts } = await import("@/lib/tiktok-posting.server");
            tiktok = await sweepStaleTiktokPosts();
          } catch (e) {
            tiktok = { error: safeErrorMessage("jobs/tick:tiktok", e) };
          }

          await recordSchedulerHeartbeat(HEARTBEAT_NAME, true);
          return new Response(JSON.stringify({
            ok: true, sweptHighValue, swept, recovered, reconciled, motionAutoscale, results, spin, tiktok,
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
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