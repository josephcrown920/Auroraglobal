// Admin → Observability server functions.
// Reads API telemetry plus the derived live GPU pool health view.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/lib/admin.functions";
import {
  computeErrorRatePerEndpoint,
  computeP95LatencyPerEndpoint,
  computeRequestsPerHour,
  computeTopEndpoints,
} from "@/lib/api-observability-stats";

const WINDOW_HOURS = 24;
const MAX_ROWS = 20_000;

export const adminObservability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    const [{ data, error }, { data: gpuPool, error: gpuPoolError }] = await Promise.all([
      supabaseAdmin
        .from("api_logs")
        .select("endpoint, method, status, response_time_ms, source, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(MAX_ROWS),
      supabaseAdmin.from("gpu_pool_health").select("*").maybeSingle(),
    ]);

    if (error) throw new Error(error.message);
    if (gpuPoolError) throw new Error(gpuPoolError.message);

    const rows = data ?? [];
    const sourceBreakdown = { real: 0, bot: 0, internal: 0 };
    for (const r of rows) {
      if (r.source === "real" || r.source === "bot" || r.source === "internal") {
        sourceBreakdown[r.source]++;
      }
    }

    return {
      since,
      totalRequests: rows.length,
      rowCap: MAX_ROWS,
      hitRowCap: rows.length >= MAX_ROWS,
      sourceBreakdown,
      topEndpoints: computeTopEndpoints(rows),
      requestsPerHour: computeRequestsPerHour(rows),
      errorRates: computeErrorRatePerEndpoint(rows),
      latencyP95: computeP95LatencyPerEndpoint(rows),
      gpuPool: gpuPool ?? {
        configured_workers: 0,
        healthy_workers: 0,
        degraded_workers: 0,
        unavailable_workers: 0,
        in_flight: 0,
        max_concurrency: 0,
        utilization_pct: 0,
        healthy_pct: 0,
        oldest_healthy_heartbeat: null,
        last_probe_at: null,
      },
    };
  });
