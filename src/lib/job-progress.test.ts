// Unit tests for real server-side job progress (task #284):
//  - replicateProgressPct: pure log→percent parser for Replicate poll logs
//  - makeJobProgressReporter: throttled/monotonic emitter (DI'd write/now —
//    never mock.module shared modules; Bun leaks stubs across suites)
import { describe, expect, test } from "bun:test";

import { makeJobProgressReporter } from "./jobs.server";
import { replicateProgressPct } from "./replicate.server";

describe("replicateProgressPct", () => {
  test("null/undefined/empty logs → null", () => {
    expect(replicateProgressPct(null)).toBeNull();
    expect(replicateProgressPct(undefined)).toBeNull();
    expect(replicateProgressPct("")).toBeNull();
  });

  test("logs without numbers → null", () => {
    expect(replicateProgressPct("Loading weights onto GPU...")).toBeNull();
  });

  test("parses an explicit percent", () => {
    expect(replicateProgressPct("37%")).toBe(37);
  });

  test("typical tqdm line: percent wins over the step counter", () => {
    expect(replicateProgressPct(" 37%|███       | 15/40 [00:12<00:20]")).toBe(37);
  });

  test("last percent wins across multiple lines", () => {
    expect(replicateProgressPct("10%|█\n 55%|█████")).toBe(55);
  });

  test("decimal percents round", () => {
    expect(replicateProgressPct("37.5%")).toBe(38);
  });

  test("out-of-range percent clamps to 100", () => {
    expect(replicateProgressPct("137%")).toBe(100);
  });

  test("step counter fallback when no percent present", () => {
    expect(replicateProgressPct("step 12/50")).toBe(24);
  });

  test("last step counter wins", () => {
    expect(replicateProgressPct("5/50 done\n25/50 done")).toBe(50);
  });

  test("tiny denominators (<5) are ignored — flags/dates, not counters", () => {
    expect(replicateProgressPct("pass 1/2")).toBeNull();
    expect(replicateProgressPct("3/4")).toBeNull();
  });

  test("numerator above denominator is ignored", () => {
    expect(replicateProgressPct("9/5")).toBeNull();
  });

  test("an early percent takes precedence over a later counter (deliberate)", () => {
    expect(replicateProgressPct("10% loaded\nstep 40/50")).toBe(10);
  });
});

// ─── makeJobProgressReporter ────────────────────────────────────────────────

type Written = { jobId: string; pct?: number | null; stage?: string | null };

function makeHarness(minIntervalMs = 2_000) {
  const writes: Written[] = [];
  let t = 0;
  const report = makeJobProgressReporter("job-1", {
    write: async (jobId, u) => {
      writes.push({ jobId, ...u });
      return true;
    },
    now: () => t,
    minIntervalMs,
  });
  return { writes, report, tick: (ms: number) => (t += ms) };
}

describe("makeJobProgressReporter", () => {
  test("first update writes immediately", () => {
    const h = makeHarness();
    h.report({ pct: 5 });
    expect(h.writes).toEqual([{ jobId: "job-1", pct: 5, stage: undefined }]);
  });

  test("pct-only updates are throttled, then flow after the window", () => {
    const h = makeHarness();
    h.report({ pct: 5 });
    h.tick(1_000);
    h.report({ pct: 50 }); // inside window → suppressed
    expect(h.writes.length).toBe(1);
    h.tick(1_000); // t = 2000 → window elapsed
    h.report({ pct: 50 }); // suppressed pct was NOT recorded, so this still advances
    expect(h.writes.length).toBe(2);
    expect(h.writes[1]).toEqual({ jobId: "job-1", pct: 50, stage: undefined });
  });

  test("stage changes bypass the throttle", () => {
    const h = makeHarness();
    h.report({ pct: 5, stage: "starting" });
    h.tick(100); // well inside the window
    h.report({ stage: "uploading" });
    expect(h.writes.length).toBe(2);
    expect(h.writes[1].stage).toBe("uploading");
  });

  test("repeating the same stage with no pct advance writes nothing", () => {
    const h = makeHarness();
    h.report({ pct: 5, stage: "running" });
    h.tick(10_000);
    h.report({ stage: "running" });
    expect(h.writes.length).toBe(1);
  });

  test("pct is monotonic: a lower pct never writes, and a stage change carries the high-water pct", () => {
    const h = makeHarness();
    h.report({ pct: 80 });
    h.tick(5_000);
    h.report({ pct: 40 }); // fallback provider restarting its counter
    expect(h.writes.length).toBe(1);
    h.report({ pct: 40, stage: "uploading" }); // stage change → writes, but with high-water pct
    expect(h.writes.length).toBe(2);
    expect(h.writes[1]).toEqual({ jobId: "job-1", pct: 80, stage: "uploading" });
  });

  test("pct is clamped to 0–99", () => {
    const h = makeHarness();
    h.report({ pct: 150 });
    expect(h.writes[0].pct).toBe(99);
    const h2 = makeHarness();
    h2.report({ pct: -5 });
    expect(h2.writes[0].pct).toBe(0);
  });

  test("non-finite pct with no stage is a no-op", () => {
    const h = makeHarness();
    h.report({ pct: Number.NaN });
    expect(h.writes.length).toBe(0);
  });

  test("write rejections are swallowed (fire-and-forget)", async () => {
    const report = makeJobProgressReporter("job-1", {
      write: async () => {
        throw new Error("boom");
      },
      now: () => 0,
    });
    expect(() => report({ pct: 10 })).not.toThrow();
    await Bun.sleep(1); // let the rejection settle through the internal .catch
  });
});
