import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { withRetry, TRANSIENT_RE } from "./orchestrator.server";

// withRetry wraps every provider adapter call in orchestrate(). It must retry
// transient failures (429/5xx/network/timeout) with exponential backoff, give
// up once the attempt cap is exhausted, and NOT retry non-transient errors
// (auth/validation, e.g. 401/403/400) so a hard failure surfaces immediately
// instead of wasting attempts and time.

// Deterministic fast clock — same pattern as orchestrator.fallback.test.ts.
// Replaces setTimeout with one that advances a virtual Date.now() by the
// requested delay and fires the callback on the next macrotask, so backoff
// sleeps don't make the test suite slow.
const realNow = Date.now;
const realSetTimeout = globalThis.setTimeout;
let fakeNow = 0;
const sleeps: number[] = [];

function installFakeClock(start = 1_000_000) {
  fakeNow = start;
  sleeps.length = 0;
  Date.now = () => fakeNow;
  globalThis.setTimeout = ((cb: (...a: unknown[]) => void, ms?: number) => {
    sleeps.push(ms ?? 0);
    fakeNow += ms ?? 0;
    return realSetTimeout(cb, 0);
  }) as unknown as typeof setTimeout;
}
function restoreClock() {
  Date.now = realNow;
  globalThis.setTimeout = realSetTimeout;
}

beforeEach(() => installFakeClock());
afterEach(() => restoreClock());

describe("TRANSIENT_RE", () => {
  it("matches transient failure signatures", () => {
    for (const msg of [
      "429 Too Many Requests",
      "HTTP 503",
      "connect ECONNRESET",
      "ETIMEDOUT",
      "EAI_AGAIN",
      "fetch failed",
      "network error",
      "request timeout",
    ]) {
      expect(TRANSIENT_RE.test(msg)).toBe(true);
    }
  });

  it("does not match auth/validation failures", () => {
    for (const msg of ["401 Unauthorized", "403 Forbidden", "400 Bad Request", "invalid api key"]) {
      expect(TRANSIENT_RE.test(msg)).toBe(false);
    }
  });
});

describe("withRetry", () => {
  it("succeeds after N transient failures within the attempt cap", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new Error("503 Service Unavailable");
      return "ok";
    }, 3);

    expect(result).toBe("ok");
    expect(calls).toBe(3);
    // Two retries happened before the third (successful) call, so two sleeps.
    expect(sleeps).toHaveLength(2);
  });

  it("gives up once the attempt cap is exhausted, surfacing the last error", async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new Error("429 rate limited");
      }, 2),
    ).rejects.toThrow("429 rate limited");

    // attempts=2 means 3 total tries (i = 0, 1, 2) and 2 sleeps in between.
    expect(calls).toBe(3);
    expect(sleeps).toHaveLength(2);
  });

  it("does not retry a non-transient error — fails on the first attempt", async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new Error("401 Unauthorized");
      }, 3),
    ).rejects.toThrow("401 Unauthorized");

    expect(calls).toBe(1);
    expect(sleeps).toHaveLength(0);
  });

  it("drives backoff sleeps through the fake clock with exponential growth", async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new Error("500 Internal Server Error");
      }, 2),
    ).rejects.toThrow();

    expect(sleeps).toHaveLength(2);
    // backoff = 400 * 2^i + rand(0,200); i=0 then i=1 across the two sleeps.
    expect(sleeps[0]).toBeGreaterThanOrEqual(400);
    expect(sleeps[0]).toBeLessThan(600);
    expect(sleeps[1]).toBeGreaterThanOrEqual(800);
    expect(sleeps[1]).toBeLessThan(1000);
  });

  it("honors a provider's explicit retryAfterMs hint over the default backoff", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls === 1) {
        const err = new Error("429 rate limited") as Error & { retryAfterMs: number };
        err.retryAfterMs = 5_000;
        throw err;
      }
      return "ok";
    }, 2);

    expect(result).toBe("ok");
    expect(sleeps).toEqual([5_000]);
  });

  it("returns on the very first successful call without sleeping", async () => {
    const result = await withRetry(async () => "immediate", 3);
    expect(result).toBe("immediate");
    expect(sleeps).toHaveLength(0);
  });
});
