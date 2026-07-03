// Admin cost analytics — pure aggregation + success-status contract.
// Regression: the dashboard previously filtered on 'completed' (a status no
// writer uses) and silently dropped every studio render from spend totals.
import { describe, expect, test } from "bun:test";
import { GENERATION_SUCCESS_STATUSES, aggregateByDayKind } from "./cost-stats";

describe("GENERATION_SUCCESS_STATUSES", () => {
  test("covers both writer conventions and nothing invented", () => {
    // API core writes 'succeeded'; studio server fns write 'complete'.
    expect([...GENERATION_SUCCESS_STATUSES].sort()).toEqual(["complete", "succeeded"]);
    // 'completed' is NOT a real status — filtering on it drops studio rows.
    expect(GENERATION_SUCCESS_STATUSES).not.toContain("completed");
  });
});

describe("aggregateByDayKind", () => {
  test("groups by day and kind, summing counts and credits", () => {
    const rows = [
      { kind: "video", credits_cost: 5, created_at: "2026-07-01T10:00:00Z" },
      { kind: "video", credits_cost: 3, created_at: "2026-07-01T18:00:00Z" },
      { kind: "image", credits_cost: 1, created_at: "2026-07-01T09:00:00Z" },
      { kind: "video", credits_cost: 5, created_at: "2026-06-30T09:00:00Z" },
    ];
    const out = aggregateByDayKind(rows);
    expect(out).toEqual([
      { day: "2026-07-01", kind: "video", count: 2, totalCredits: 8 },
      { day: "2026-07-01", kind: "image", count: 1, totalCredits: 1 },
      { day: "2026-06-30", kind: "video", count: 1, totalCredits: 5 },
    ]);
  });

  test("null kind/cost/date fall back without dropping rows", () => {
    const out = aggregateByDayKind([{ kind: null, credits_cost: null, created_at: null }]);
    expect(out).toEqual([{ day: "unknown", kind: "unknown", count: 1, totalCredits: 0 }]);
  });

  test("empty input yields empty output", () => {
    expect(aggregateByDayKind([])).toEqual([]);
  });
});
