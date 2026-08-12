import { describe, expect, it } from "bun:test";
import { nextSyntheticProgress } from "./use-generation-progress";

// stepsTo95 for the default 15s estimate at the 600ms tick: (15000/600)*0.9
const STEPS = (15_000 / 600) * 0.9;

/** Run the ticker reducer n times, exactly like the interval does. */
function run(prev: number, realPct: number | null, ticks: number, rand = 0.5): number {
  let p = prev;
  for (let i = 0; i < ticks; i++) p = nextSyntheticProgress(p, STEPS, realPct, rand);
  return p;
}

describe("nextSyntheticProgress server-progress ceiling", () => {
  it("a job stalled at a low real percent can NEVER coast to the synthetic 95% cap", () => {
    // 500 ticks ≈ 5 minutes of wall time on the 600ms interval — far past the
    // point where the old timer-only fill would have parked the bar at 95.
    const final = run(5, 8, 500);
    expect(final).toBeLessThanOrEqual(8 + 6);
    expect(final).toBeGreaterThanOrEqual(8); // still creeps within the headroom band
  });

  it("without any real percent the original estimate-paced fill to 95 is unchanged", () => {
    const final = run(5, null, 500);
    expect(final).toBeGreaterThan(90);
    expect(final).toBeLessThanOrEqual(95);
  });

  it("holds (never regresses) when the bar already sits above a late first report", () => {
    // First real report lands late: bar drifted to 60, server says 8.
    expect(nextSyntheticProgress(60, STEPS, 8, 0.5)).toBe(60);
    // …and it stays parked there tick after tick.
    expect(run(60, 8, 50)).toBe(60);
  });

  it("resumes advancing when a newer report raises the ceiling", () => {
    const parked = run(5, 8, 100); // capped at 14
    expect(parked).toBeLessThanOrEqual(14);
    const resumed = run(parked, 50, 200); // ceiling now 56
    expect(resumed).toBeGreaterThan(parked);
    expect(resumed).toBeLessThanOrEqual(56);
  });

  it("hard-caps at 95 even when the server reports higher", () => {
    expect(run(90, 99, 100)).toBeLessThanOrEqual(95);
  });

  it("each step is monotonic non-decreasing", () => {
    let p = 5;
    for (let i = 0; i < 200; i++) {
      const next = nextSyntheticProgress(p, STEPS, i < 100 ? 40 : null, 0.9);
      expect(next).toBeGreaterThanOrEqual(p);
      p = next;
    }
  });
});
