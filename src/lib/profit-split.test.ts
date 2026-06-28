import { describe, expect, it } from "bun:test";
import { computeProfitSplit, CREDIT_FUNDING_PCT, PROFIT_SPLIT_PCT } from "./profit-split";

// The 60/40 split is the single source of truth for purchase accounting
// (webhook persistence + admin earnings). Profit is rounded and the remainder
// funds credits, so the two halves must always reconstruct the gross exactly.
describe("computeProfitSplit", () => {
  it("splits 60/40 with profit rounded and the remainder funding credits", () => {
    const s = computeProfitSplit(1000);
    expect(s.profit_minor).toBe(600);
    expect(s.credit_funding_minor).toBe(400);
    expect(s.gross_minor).toBe(1000);
    expect(s.profit_pct).toBe(PROFIT_SPLIT_PCT);
  });

  it("always sums profit + funding back to the gross (rounding lands in funding)", () => {
    for (const gross of [1, 3, 7, 99, 333, 1001, 12345]) {
      const s = computeProfitSplit(gross);
      expect(s.profit_minor + s.credit_funding_minor).toBe(s.gross_minor);
      expect(s.profit_minor).toBe(Math.round(gross * (PROFIT_SPLIT_PCT / 100)));
    }
  });

  it("rounds the gross and floors negatives / garbage to zero", () => {
    expect(computeProfitSplit(10.4).gross_minor).toBe(10);
    expect(computeProfitSplit(10.6).gross_minor).toBe(11);
    expect(computeProfitSplit(-50)).toMatchObject({
      gross_minor: 0,
      profit_minor: 0,
      credit_funding_minor: 0,
    });
    expect(computeProfitSplit(Number.NaN).gross_minor).toBe(0);
  });

  it("keeps the profit and credit-funding percentages complementary", () => {
    expect(PROFIT_SPLIT_PCT + CREDIT_FUNDING_PCT).toBe(100);
  });
});
