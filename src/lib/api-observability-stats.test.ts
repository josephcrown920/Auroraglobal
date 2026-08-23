// Admin observability dashboard — pure aggregation helpers (Task #374).
import { describe, expect, test } from "bun:test";
import {
  type ApiLogRow,
  computeErrorRatePerEndpoint,
  computeP95LatencyPerEndpoint,
  computeRequestsPerHour,
  computeTopEndpoints,
} from "./api-observability-stats";

function row(overrides: Partial<ApiLogRow> = {}): ApiLogRow {
  return {
    endpoint: "/api/public/jobs/tick",
    method: "POST",
    status: 200,
    response_time_ms: 100,
    source: "internal",
    created_at: "2026-08-22T10:00:00.000Z",
    ...overrides,
  };
}

describe("computeTopEndpoints", () => {
  test("counts requests per endpoint, most-traffic first", () => {
    const rows = [
      row({ endpoint: "/api/a" }),
      row({ endpoint: "/api/b" }),
      row({ endpoint: "/api/a" }),
      row({ endpoint: "/api/a" }),
    ];
    expect(computeTopEndpoints(rows)).toEqual([
      { endpoint: "/api/a", count: 3 },
      { endpoint: "/api/b", count: 1 },
    ]);
  });

  test("respects the limit", () => {
    const rows = ["a", "b", "c"].map((e) => row({ endpoint: `/api/${e}` }));
    expect(computeTopEndpoints(rows, 2)).toHaveLength(2);
  });

  test("empty input yields empty output", () => {
    expect(computeTopEndpoints([])).toEqual([]);
  });
});

describe("computeRequestsPerHour", () => {
  test("pre-seeds all 24 hourly buckets so empty hours read as 0", () => {
    const now = new Date("2026-08-22T12:30:00.000Z");
    const out = computeRequestsPerHour([], now);
    expect(out).toHaveLength(24);
    expect(out.every((b) => b.count === 0)).toBe(true);
    // Oldest first, newest (current hour) last.
    expect(out[0].hour).toBe("2026-08-21T13");
    expect(out[out.length - 1].hour).toBe("2026-08-22T12");
  });

  test("buckets matching rows into their hour, ignores rows outside the window", () => {
    const now = new Date("2026-08-22T12:30:00.000Z");
    const rows = [
      row({ created_at: "2026-08-22T12:05:00.000Z" }),
      row({ created_at: "2026-08-22T12:59:00.000Z" }),
      row({ created_at: "2026-08-22T11:00:00.000Z" }),
      row({ created_at: "2020-01-01T00:00:00.000Z" }), // outside the 24h window
    ];
    const out = computeRequestsPerHour(rows, now);
    const byHour = new Map(out.map((b) => [b.hour, b.count]));
    expect(byHour.get("2026-08-22T12")).toBe(2);
    expect(byHour.get("2026-08-22T11")).toBe(1);
    expect(out.reduce((sum, b) => sum + b.count, 0)).toBe(3);
  });
});

describe("computeErrorRatePerEndpoint", () => {
  test("computes error rate and filters out low-traffic endpoints", () => {
    const rows = [
      row({ endpoint: "/api/a", status: 200 }),
      row({ endpoint: "/api/a", status: 200 }),
      row({ endpoint: "/api/a", status: 500 }),
      row({ endpoint: "/api/b", status: 500 }), // only 1 request — filtered by minRequests default
    ];
    const out = computeErrorRatePerEndpoint(rows);
    expect(out).toEqual([{ endpoint: "/api/a", total: 3, errors: 1, errorRatePct: (1 / 3) * 100 }]);
  });

  test("400s and above count as errors, below 400 does not", () => {
    const rows = [
      row({ endpoint: "/api/a", status: 399 }),
      row({ endpoint: "/api/a", status: 400 }),
      row({ endpoint: "/api/a", status: 200 }),
    ];
    const out = computeErrorRatePerEndpoint(rows, 1);
    expect(out[0]).toEqual({ endpoint: "/api/a", total: 3, errors: 1, errorRatePct: (1 / 3) * 100 });
  });

  test("worst offenders sort first", () => {
    const rows = [
      row({ endpoint: "/api/low", status: 200 }),
      row({ endpoint: "/api/low", status: 200 }),
      row({ endpoint: "/api/low", status: 500 }),
      row({ endpoint: "/api/high", status: 500 }),
      row({ endpoint: "/api/high", status: 500 }),
      row({ endpoint: "/api/high", status: 200 }),
    ];
    const out = computeErrorRatePerEndpoint(rows, 1);
    expect(out[0].endpoint).toBe("/api/high");
    expect(out[1].endpoint).toBe("/api/low");
  });

  test("empty input yields empty output", () => {
    expect(computeErrorRatePerEndpoint([])).toEqual([]);
  });
});

describe("computeP95LatencyPerEndpoint", () => {
  test("computes p95 and filters out low-traffic endpoints", () => {
    const rows = Array.from({ length: 10 }, (_, i) => row({ endpoint: "/api/a", response_time_ms: (i + 1) * 100 }));
    const out = computeP95LatencyPerEndpoint(rows);
    expect(out).toHaveLength(1);
    expect(out[0].endpoint).toBe("/api/a");
    expect(out[0].count).toBe(10);
    // 95th percentile of [100..1000] (10 values) is the 10th value: 1000.
    expect(out[0].p95Ms).toBe(1000);
  });

  test("slowest endpoints sort first", () => {
    const rows = [
      row({ endpoint: "/api/fast", response_time_ms: 50 }),
      row({ endpoint: "/api/fast", response_time_ms: 60 }),
      row({ endpoint: "/api/fast", response_time_ms: 70 }),
      row({ endpoint: "/api/slow", response_time_ms: 900 }),
      row({ endpoint: "/api/slow", response_time_ms: 950 }),
      row({ endpoint: "/api/slow", response_time_ms: 999 }),
    ];
    const out = computeP95LatencyPerEndpoint(rows);
    expect(out[0].endpoint).toBe("/api/slow");
    expect(out[1].endpoint).toBe("/api/fast");
  });

  test("endpoints below minRequests are excluded", () => {
    const rows = [row({ endpoint: "/api/rare", response_time_ms: 100 })];
    expect(computeP95LatencyPerEndpoint(rows, 3)).toEqual([]);
  });

  test("empty input yields empty output", () => {
    expect(computeP95LatencyPerEndpoint([])).toEqual([]);
  });
});
