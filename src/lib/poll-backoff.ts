/**
 * Exponential backoff delay for polling loops.
 *
 * Returns the delay in milliseconds for a given 0-based attempt index.
 * Starts at `base`, multiplies by `factor` each attempt, capped at `max`.
 *
 * Default sequence (2 s base, ×1.5, 15 s cap):
 *   attempt 0 →  2 000 ms
 *   attempt 1 →  3 000 ms
 *   attempt 2 →  4 500 ms
 *   attempt 3 →  6 750 ms
 *   attempt 4 → 10 125 ms
 *   attempt 5+ → 15 000 ms (capped)
 *
 * A 90-second job at this cadence makes ~10 polls instead of ~45 (flat 2 s).
 */
export function backoffMs(
  attempt: number,
  base = 2_000,
  factor = 1.5,
  max = 15_000,
): number {
  return Math.min(base * Math.pow(factor, attempt), max);
}
