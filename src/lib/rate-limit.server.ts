// Shared per-user sliding-window rate limiter for expensive/abuse-prone
// server routes (generation, performance-reskin, HeyGen video agent, etc).
//
// This generalizes the pattern already used for the Video Agent "Enhance"
// and "Cinematic Analyze" passes (src/lib/video-agent.functions.ts) so every
// credit-charging or provider-calling endpoint gets the same cheap,
// dependency-free abuse guard instead of each route reinventing it.
//
// Deliberately in-memory, not DB-backed: the goal is to blunt rapid-fire
// abuse/misconfigured-client loops within a single server process, not to
// enforce a hard multi-instance quota (credits/daily-spend-limit already do
// that at the DB level). A server restart resetting the window is an
// acceptable tradeoff for a zero-latency, zero-extra-infra guard.
const buckets = new Map<string, number[]>();

// Opportunistic global cleanup so `buckets` can't grow unbounded across many
// distinct limiter keys/users over the process lifetime.
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;
const MAX_BUCKETS_BEFORE_SWEEP = 20_000;

function sweep(now: number, windowMs: number): void {
  if (buckets.size < MAX_BUCKETS_BEFORE_SWEEP && now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [k, hits] of buckets) {
    if (hits.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
}

export class RateLimitError extends Error {
  constructor(message = "Rate limit exceeded — wait a moment and try again") {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Throws RateLimitError if `key` (typically `${routeName}:${userId}`) has
 * already made `maxPerWindow` calls within the trailing `windowMs`.
 * Otherwise records this call (or the requested number of reservations) and
 * returns normally. Reservations are recorded synchronously, before callers
 * begin any awaited work, so concurrent requests in one process cannot all
 * pass the check against the same stale count.
 */
export function assertRateLimit(
  key: string,
  maxPerWindow: number,
  windowMs: number,
  reservations = 1,
): void {
  if (!Number.isInteger(reservations) || reservations < 1) {
    throw new Error("Rate-limit reservations must be a positive integer");
  }
  const now = Date.now();
  sweep(now, windowMs);
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length + reservations > maxPerWindow) {
    throw new RateLimitError();
  }
  for (let i = 0; i < reservations; i++) hits.push(now);
  buckets.set(key, hits);
}

/** Same check as assertRateLimit, but returns a boolean instead of throwing
 *  — convenient in fetch-style route handlers that build their own Response. */
export function checkRateLimit(key: string, maxPerWindow: number, windowMs: number): boolean {
  try {
    assertRateLimit(key, maxPerWindow, windowMs);
    return true;
  } catch {
    return false;
  }
}
