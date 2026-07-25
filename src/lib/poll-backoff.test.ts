import { describe, expect, test } from "bun:test";
import { backoffMs } from "./poll-backoff";

describe("backoffMs", () => {
  test("returns base at attempt 0", () => {
    expect(backoffMs(0)).toBe(2_000);
  });

  test("multiplies by factor each attempt", () => {
    expect(backoffMs(1)).toBe(3_000);    // 2000 × 1.5
    expect(backoffMs(2)).toBe(4_500);    // 3000 × 1.5
    expect(backoffMs(3)).toBe(6_750);    // 4500 × 1.5
    expect(backoffMs(4)).toBe(10_125);   // 6750 × 1.5
  });

  test("caps at max", () => {
    expect(backoffMs(5)).toBe(15_000);   // 10125 × 1.5 = 15187.5 → capped
    expect(backoffMs(10)).toBe(15_000);
    expect(backoffMs(100)).toBe(15_000);
  });

  test("respects custom base, factor, max", () => {
    expect(backoffMs(0, 3_000, 2, 20_000)).toBe(3_000);
    expect(backoffMs(1, 3_000, 2, 20_000)).toBe(6_000);
    expect(backoffMs(2, 3_000, 2, 20_000)).toBe(12_000);
    expect(backoffMs(3, 3_000, 2, 20_000)).toBe(20_000); // capped
  });

  test("a 90-second job takes fewer than 20 polls", () => {
    let elapsed = 0;
    let polls = 0;
    while (elapsed < 90_000) {
      elapsed += backoffMs(polls);
      polls++;
    }
    expect(polls).toBeLessThan(20);
  });

  test("never returns below base", () => {
    for (let i = 0; i < 10; i++) {
      expect(backoffMs(i)).toBeGreaterThanOrEqual(2_000);
    }
  });

  // Budget-proof tests — confirm that attempt caps and deadline arithmetic
  // keep total scheduled delay within stated SLAs.

  test("job-polling: 23 attempts stay within the 5-minute budget", () => {
    // With 2s/×1.5/15s, 23 attempts = ~296 s < 300 s (5 min).
    // The 24th would push over; deadline gates it in pollJobUntilDone.
    let total = 0;
    for (let i = 0; i < 23; i++) total += backoffMs(i);
    expect(total).toBeLessThanOrEqual(5 * 60_000);
  });

  test("job-polling: 24+ attempts would exceed the 5-minute budget without a deadline", () => {
    let total = 0;
    for (let i = 0; i < 24; i++) total += backoffMs(i);
    expect(total).toBeGreaterThan(5 * 60_000);
  });

  test("tiktok-posting: 10 attempts stay within the 2-minute budget (3s/×1.5/15s)", () => {
    // With 3s/×1.5/15s, 10 attempts = ~114 s < 120 s (2 min).
    let total = 0;
    for (let i = 0; i < 10; i++) total += backoffMs(i, 3_000, 1.5, 15_000);
    expect(total).toBeLessThanOrEqual(2 * 60_000);
  });

  test("tiktok-posting: 11+ attempts would exceed the 2-minute budget without a deadline", () => {
    let total = 0;
    for (let i = 0; i < 11; i++) total += backoffMs(i, 3_000, 1.5, 15_000);
    expect(total).toBeGreaterThan(2 * 60_000);
  });
});
