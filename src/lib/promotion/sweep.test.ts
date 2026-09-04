import { describe, expect, test } from "bun:test";
import {
  SWEEP_RETRY_CAP,
  finishRetryPass,
  freshCheckpoint,
  nextSweepAction,
  recordOutcome,
  sweepComplete,
  type SweepCheckpoint,
} from "./sweep";

function state(patch: Partial<SweepCheckpoint> = {}): SweepCheckpoint {
  return { ...freshCheckpoint("2026-09-05"), ...patch };
}

describe("nextSweepAction phase order", () => {
  test("links → tiktok → retry → done", () => {
    expect(nextSweepAction(state())).toBe("links");
    expect(nextSweepAction(state({ linksDone: true }))).toBe("tiktok");
    expect(
      nextSweepAction(
        state({ linksDone: true, tiktokDone: true, retry: [{ user_id: "u", platform: "spotify" }] }),
      ),
    ).toBe("retry");
    expect(nextSweepAction(state({ linksDone: true, tiktokDone: true }))).toBe("done");
    expect(
      nextSweepAction(state({ linksDone: true, tiktokDone: true, retriedToday: true })),
    ).toBe("done");
  });
});

describe("checkpoint resume", () => {
  test("a partially-walked day resumes the same phase, not from scratch", () => {
    const s = state({ linkCursor: 10_000 });
    expect(nextSweepAction(s)).toBe("links");
    expect(s.linkCursor).toBe(10_000);
  });
  test("sweepComplete only when both walks finished and retries settled", () => {
    expect(sweepComplete(state())).toBe(false);
    expect(sweepComplete(state({ linksDone: true, tiktokDone: true }))).toBe(true);
    expect(
      sweepComplete(
        state({ linksDone: true, tiktokDone: true, retry: [{ user_id: "u", platform: "x" }] }),
      ),
    ).toBe(false);
    expect(
      sweepComplete(
        state({
          linksDone: true,
          tiktokDone: true,
          retriedToday: true,
          retry: [],
        }),
      ),
    ).toBe(true);
  });
});

describe("recordOutcome retry queue", () => {
  test("counts outcomes and queues failures exactly once per row", () => {
    const s = state();
    recordOutcome(s, "synced");
    recordOutcome(s, "skipped");
    const ref = { user_id: "u1", platform: "spotify" };
    recordOutcome(s, "failed", ref);
    recordOutcome(s, "failed", ref); // duplicate — must not double-queue
    recordOutcome(s, "failed", { user_id: "u2", platform: "tiktok" });
    expect(s.synced).toBe(1);
    expect(s.skipped).toBe(1);
    expect(s.failed).toBe(3);
    expect(s.retry).toEqual([ref, { user_id: "u2", platform: "tiktok" }]);
  });
  test("failures without a ref are counted but never queued (retry-pass rows)", () => {
    const s = state();
    recordOutcome(s, "failed");
    expect(s.retry).toEqual([]);
  });
  test("overflow past the cap is counted, not silently dropped", () => {
    const s = state({ retry: Array.from({ length: SWEEP_RETRY_CAP }, (_, i) => ({ user_id: `x${i}`, platform: "youtube" })) });
    recordOutcome(s, "failed", { user_id: "new1", platform: "youtube" });
    recordOutcome(s, "failed", { user_id: "new2", platform: "spotify" });
    expect(s.retry.length).toBe(SWEEP_RETRY_CAP);
    expect(s.retryOverflow).toBe(2);
    expect(s.failed).toBe(2);
  });
});

describe("finishRetryPass", () => {
  test("marks the pass done and drops remaining entries (terminal for the day)", () => {
    const s = state({
      linksDone: true,
      tiktokDone: true,
      retry: [{ user_id: "u", platform: "spotify" }],
    });
    finishRetryPass(s);
    expect(s.retriedToday).toBe(true);
    expect(s.retry).toEqual([]);
    expect(sweepComplete(s)).toBe(true);
  });
});
