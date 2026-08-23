// Admin → Observability server functions (Task #374). Reads api_logs
// (populated by src/lib/api-logger.server.ts, wired into every request in
// src/server.ts) and returns the four aggregate views the dashboard needs.
// Aggregation itself lives in api-observability-stats.ts (pure, unit-testable).

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

// Cap the window we pull into memory — api_logs can grow fast under real
// traffic, and the dashboard only needs the last day of detail plus a
// rows-per-request ceiling as a hard backstop.
const WINDOW_HOURS = 24;
const MAX_ROWS = 20_000;

export const adminObservability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseAdmin
      .from("api_logs")
      .select("endpoint, method, status, response_time_ms, source, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);
    if (error) throw new Error(error.message);

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
    };
  });
