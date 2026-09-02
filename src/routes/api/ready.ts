import { createFileRoute } from "@tanstack/react-router";

// Readiness probe — unlike /api/health (pure process-liveness, always 200),
// this one actually exercises the app's hard dependencies: Supabase and the
// configured GPU worker pool. GPU workers are checked from the most recent
// live probe written by the worker-health sweep; readiness never performs
// network probes or mutates worker state itself.
//
// Returns 200 when the database is reachable and either no GPU workers are
// configured or at least one active GPU worker has a recent successful probe.
// A pool with no healthy active worker returns 503 so deployment/uptime checks
// can detect a generation-capacity outage before users do.
const DB_CHECK_TIMEOUT_MS = 3000;
const GPU_PROBE_MAX_AGE_MS = 10 * 60 * 1000;

type GpuWorkerReadinessRow = {
  id: string;
  status: string | null;
  last_probe_at: string | null;
  last_probe_ok: boolean | null;
  in_flight: number | null;
  max_concurrency: number | null;
};

function gpuPoolReadiness(workers: GpuWorkerReadinessRow[] | null, now = Date.now()) {
  const active = (workers ?? []).filter((worker) => worker.status === "active");
  const healthy = active.filter((worker) => {
    if (worker.last_probe_ok !== true || !worker.last_probe_at) return false;
    const age = now - new Date(worker.last_probe_at).getTime();
    if (!Number.isFinite(age) || age < 0 || age > GPU_PROBE_MAX_AGE_MS) return false;
    const inFlight = typeof worker.in_flight === "number" ? worker.in_flight : 0;
    const maxConcurrency = typeof worker.max_concurrency === "number" ? worker.max_concurrency : 0;
    return maxConcurrency > 0 && inFlight < maxConcurrency;
  });

  const staleOrFailed = active.length - healthy.length;
  return {
    ok: active.length === 0 || healthy.length > 0,
    configured: active.length > 0,
    active_workers: active.length,
    healthy_workers: healthy.length,
    stale_or_failed_workers: staleOrFailed,
    state:
      active.length === 0 ? "not_configured"
      : healthy.length > 0 && staleOrFailed === 0 ? "healthy"
      : healthy.length > 0 ? "degraded"
      : "unavailable",
  };
}

export const Route = createFileRoute("/api/ready")({
  server: {
    handlers: {
      GET: async () => {
        const startedAt = Date.now();
        const checks: Record<string, { ok: boolean; ms?: number; error?: string; [key: string]: unknown }> = {};

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const dbStart = Date.now();
          const dbCheck = supabaseAdmin
            .from("app_settings")
            .select("key", { count: "exact", head: true })
            .limit(1);
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), DB_CHECK_TIMEOUT_MS),
          );
          const { error } = await Promise.race([dbCheck, timeout]).then(
            (r) => r as { error: { message: string } | null },
            (e: Error) => ({ error: { message: e.message } }),
          );
          if (error) console.error("[ready] database check failed:", error.message);
          checks.database = { ok: !error, ms: Date.now() - dbStart, ...(error ? { error: "database_unavailable" } : {}) };

          if (!error) {
            const gpuStart = Date.now();
            const { data: workers, error: gpuError } = await supabaseAdmin
              .from("gpu_workers")
              .select("id,status,last_probe_at,last_probe_ok,in_flight,max_concurrency");

            if (gpuError) {
              console.error("[ready] GPU pool check failed:", gpuError.message);
              checks.gpu_pool = {
                ok: false,
                ms: Date.now() - gpuStart,
                error: "gpu_pool_unavailable",
              };
            } else {
              const pool = gpuPoolReadiness((workers ?? []) as GpuWorkerReadinessRow[]);
              checks.gpu_pool = {
                ok: pool.ok,
                ms: Date.now() - gpuStart,
                ...pool,
              };
            }
          } else {
            // Keep the response explicit without making a second DB request
            // when the database dependency is already known to be down.
            checks.gpu_pool = { ok: false, error: "database_unavailable" };
          }
        } catch (e) {
          console.error("[ready] dependency check failed:", e);
          checks.database = { ok: false, ms: Date.now() - startedAt, error: "database_unavailable" };
          checks.gpu_pool = { ok: false, error: "database_unavailable" };
        }

        const allOk = Object.values(checks).every((c) => c.ok);
        return new Response(
          JSON.stringify({ ok: allOk, checks, total_ms: Date.now() - startedAt }),
          {
            status: allOk ? 200 : 503,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        );
      },
    },
  },
});
