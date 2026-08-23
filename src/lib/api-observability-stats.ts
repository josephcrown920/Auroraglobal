// Pure aggregation helpers for the Admin → Observability dashboard (Task
// #374). No Supabase deps, so they're testable without mocking the client —
// mirrors the pattern in cost-stats.ts.

export type ApiLogRow = {
  endpoint: string;
  method: string;
  status: number;
  response_time_ms: number;
  source: string;
  created_at: string;
};

export type TopEndpointRow = { endpoint: string; count: number };
export type RequestsPerHourRow = { hour: string; count: number };
export type ErrorRateRow = { endpoint: string; total: number; errors: number; errorRatePct: number };
export type LatencyP95Row = { endpoint: string; p95Ms: number; count: number };

/** Highest-traffic endpoints, most requests first. */
export function computeTopEndpoints(rows: ApiLogRow[], limit = 15): TopEndpointRow[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.endpoint, (counts.get(r.endpoint) ?? 0) + 1);
  return [...counts.entries()]
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Request volume bucketed by hour (UTC), covering the last 24h, oldest first. */
export function computeRequestsPerHour(rows: ApiLogRow[], now: Date = new Date()): RequestsPerHourRow[] {
  const buckets = new Map<string, number>();
  // Pre-seed the last 24 hourly buckets so empty hours still render as 0
  // instead of being missing from the chart.
  for (let i = 23; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 60 * 60 * 1000);
    const key = t.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    buckets.set(key, 0);
  }
  for (const r of rows) {
    const key = r.created_at.slice(0, 13);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([hour, count]) => ({ hour, count }));
}

/** Error rate (status >= 400) per endpoint, worst offenders first. */
export function computeErrorRatePerEndpoint(rows: ApiLogRow[], minRequests = 3): ErrorRateRow[] {
  const totals = new Map<string, { total: number; errors: number }>();
  for (const r of rows) {
    const entry = totals.get(r.endpoint) ?? { total: 0, errors: 0 };
    entry.total++;
    if (r.status >= 400) entry.errors++;
    totals.set(r.endpoint, entry);
  }
  return [...totals.entries()]
    .map(([endpoint, { total, errors }]) => ({
      endpoint,
      total,
      errors,
      errorRatePct: total > 0 ? (errors / total) * 100 : 0,
    }))
    .filter((r) => r.total >= minRequests)
    .sort((a, b) => b.errorRatePct - a.errorRatePct);
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.min(sortedValues.length - 1, Math.ceil((p / 100) * sortedValues.length) - 1);
  return sortedValues[Math.max(0, idx)] ?? 0;
}

/** p95 response time (ms) per endpoint, slowest first. */
export function computeP95LatencyPerEndpoint(rows: ApiLogRow[], minRequests = 3): LatencyP95Row[] {
  const byEndpoint = new Map<string, number[]>();
  for (const r of rows) {
    const arr = byEndpoint.get(r.endpoint) ?? [];
    arr.push(r.response_time_ms);
    byEndpoint.set(r.endpoint, arr);
  }
  return [...byEndpoint.entries()]
    .map(([endpoint, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return { endpoint, p95Ms: percentile(sorted, 95), count: sorted.length };
    })
    .filter((r) => r.count >= minRequests)
    .sort((a, b) => b.p95Ms - a.p95Ms);
}
