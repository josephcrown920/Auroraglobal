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
});
