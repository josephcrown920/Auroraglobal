import { describe, expect, it } from "bun:test";
import { computeProfitSplit, PROFIT_SPLIT_PCT } from "./profit-split";
import {
  reconcileEarningsTotals,
  computeWithdrawalSummaryTotals,
  sumProfitFromPaymentRows,
  type EarningsPaymentRow,
} from "./admin.functions";

// reconcileEarningsTotals is the pure aggregation core behind the adminEarnings
// dashboard. It must reconcile totals against the underlying `payments` rows —
// including the legacy-row fallback path for rows persisted before
// profit_amount_minor / credit_funding_amount_minor existed — so the owner's
// earnings view never drifts from what was actually charged.

const row = (overrides: Partial<EarningsPaymentRow>): EarningsPaymentRow => ({
  amount_kobo: 1000,
  currency: "USD",
  credits_granted: 100,
  profit_amount_minor: null,
  credit_funding_amount_minor: null,
  ...overrides,
});

describe("reconcileEarningsTotals", () => {
  it("uses the persisted split for modern rows", () => {
    const totals = reconcileEarningsTotals([
      row({
        amount_kobo: 1000,
        profit_amount_minor: 600,
        credit_funding_amount_minor: 400,
        credits_granted: 50,
      }),
    ]);
    expect(totals).toMatchObject({
      transactions: 1,
      revenueMinor: 1000,
      profitMinor: 600,
      creditFundingMinor: 400,
      creditsDistributed: 50,
    });
  });

  it("falls back to computeProfitSplit for legacy rows missing the persisted split", () => {
    const totals = reconcileEarningsTotals([row({ amount_kobo: 2000, credits_granted: 200 })]);
    const expected = computeProfitSplit(2000);
    expect(totals).toMatchObject({
      transactions: 1,
      revenueMinor: 2000,
      profitMinor: expected.profit_minor,
      creditFundingMinor: expected.credit_funding_minor,
      creditsDistributed: 200,
    });
  });

  it("reconciles a mix of legacy and modern rows against total revenue", () => {
    const rows = [
      row({
        amount_kobo: 1000,
        profit_amount_minor: 600,
        credit_funding_amount_minor: 400,
        credits_granted: 10,
      }),
      row({ amount_kobo: 3333, credits_granted: 20 }), // legacy — no persisted split
      row({
        amount_kobo: 777,
        profit_amount_minor: 466,
        credit_funding_amount_minor: 311,
        credits_granted: 5,
      }),
    ];
    const totals = reconcileEarningsTotals(rows);

    expect(totals.transactions).toBe(3);
    expect(totals.revenueMinor).toBe(1000 + 3333 + 777);
    expect(totals.creditsDistributed).toBe(35);
    // The core money guarantee: profit + credit-funding must always reconcile
    // back to revenue, whether a row used the persisted split or the fallback.
    expect(totals.profitMinor + totals.creditFundingMinor).toBe(totals.revenueMinor);
  });

  it("excludes non-USD rows from every total", () => {
    const rows = [
      row({
        amount_kobo: 1000,
        profit_amount_minor: 600,
        credit_funding_amount_minor: 400,
        credits_granted: 10,
      }),
      row({ amount_kobo: 500000, currency: "NGN", credits_granted: 9999 }),
    ];
    const totals = reconcileEarningsTotals(rows);
    expect(totals).toMatchObject({
      transactions: 1,
      revenueMinor: 1000,
      profitMinor: 600,
      creditFundingMinor: 400,
      creditsDistributed: 10,
    });
  });

  it("returns all-zero totals for an empty payment set", () => {
    expect(reconcileEarningsTotals([])).toEqual({
      transactions: 0,
      revenueMinor: 0,
      profitMinor: 0,
      creditFundingMinor: 0,
      creditsDistributed: 0,
    });
  });

  it("treats a partially-persisted row (one column null) as legacy for that column only", () => {
    // Defensive case: if only one of the two split columns was ever null'd out,
    // each column independently falls back rather than trusting a stale partner.
    const totals = reconcileEarningsTotals([
      row({
        amount_kobo: 1000,
        profit_amount_minor: 600,
        credit_funding_amount_minor: null,
        credits_granted: 1,
      }),
    ]);
    const expectedFundingFallback = computeProfitSplit(1000).credit_funding_minor;
    expect(totals.profitMinor).toBe(600);
    expect(totals.creditFundingMinor).toBe(expectedFundingFallback);
  });

  it("keeps the fallback split percentage consistent with PROFIT_SPLIT_PCT", () => {
    const totals = reconcileEarningsTotals([row({ amount_kobo: 10_000, credits_granted: 1 })]);
    expect(totals.profitMinor).toBe(Math.round(10_000 * (PROFIT_SPLIT_PCT / 100)));
  });
});

// sumProfitFromPaymentRows is the per-row aggregation core of
// computeAllTimeProfitMinor — the paginated DB scanner that drives the
// all-time profit figure used by adminWithdrawalSummary. Extracting it as a
// pure helper means the USD-filter + legacy-fallback math can be verified
// without a live Supabase round-trip.
describe("sumProfitFromPaymentRows", () => {
  it("uses persisted profit_amount_minor for modern rows", () => {
    const result = sumProfitFromPaymentRows([
      { amount_kobo: 1000, currency: "USD", profit_amount_minor: 600 },
      { amount_kobo: 2000, currency: "USD", profit_amount_minor: 1200 },
    ]);
    expect(result).toBe(1800);
  });

  it("falls back to computeProfitSplit for legacy rows (profit_amount_minor null)", () => {
    const amount = 5000;
    const result = sumProfitFromPaymentRows([
      { amount_kobo: amount, currency: "USD", profit_amount_minor: null },
    ]);
    expect(result).toBe(computeProfitSplit(amount).profit_minor);
  });

  it("handles a mix of modern and legacy rows correctly", () => {
    const legacyAmount = 3333;
    const legacyProfit = computeProfitSplit(legacyAmount).profit_minor;
    const result = sumProfitFromPaymentRows([
      { amount_kobo: 1000, currency: "USD", profit_amount_minor: 600 },
      { amount_kobo: legacyAmount, currency: "USD", profit_amount_minor: null },
    ]);
    expect(result).toBe(600 + legacyProfit);
  });

  it("skips non-USD rows entirely", () => {
    const result = sumProfitFromPaymentRows([
      { amount_kobo: 1000, currency: "USD", profit_amount_minor: 600 },
      { amount_kobo: 500_000, currency: "NGN", profit_amount_minor: 300_000 },
    ]);
    expect(result).toBe(600);
  });

  it("returns zero for an empty page", () => {
    expect(sumProfitFromPaymentRows([])).toBe(0);
  });

  it("accumulates correctly across multiple pages of rows (simulated fan-out)", () => {
    // Simulates computeAllTimeProfitMinor summing across two DB pages.
    const page1 = [
      { amount_kobo: 1000, currency: "USD", profit_amount_minor: 600 },
      { amount_kobo: 2000, currency: "USD", profit_amount_minor: 1200 },
    ];
    const page2 = [
      { amount_kobo: 500, currency: "USD", profit_amount_minor: null }, // legacy
    ];
    const total =
      sumProfitFromPaymentRows(page1) + sumProfitFromPaymentRows(page2);
    expect(total).toBe(600 + 1200 + computeProfitSplit(500).profit_minor);
  });
});

// computeWithdrawalSummaryTotals is the pure reconciliation core behind the
// owner payout ledger (all-time profit − total withdrawn = remaining). It
// must stay correct in isolation so a future schema/profit-split change
// can't silently break the owner's "remaining to withdraw" figure.
describe("computeWithdrawalSummaryTotals", () => {
  it("sums withdrawals and subtracts from all-time profit", () => {
    const totals = computeWithdrawalSummaryTotals(10_000, [
      { amount_minor: 2_000 },
      { amount_minor: 1_500 },
    ]);
    expect(totals.totalWithdrawnMinor).toBe(3_500);
    expect(totals.remainingMinor).toBe(6_500);
  });

  it("returns zero withdrawn and full profit as remaining with no payouts", () => {
    const totals = computeWithdrawalSummaryTotals(5_000, []);
    expect(totals.totalWithdrawnMinor).toBe(0);
    expect(totals.remainingMinor).toBe(5_000);
  });

  it("allows remaining to go negative when withdrawals exceed recorded profit", () => {
    const totals = computeWithdrawalSummaryTotals(1_000, [{ amount_minor: 1_500 }]);
    expect(totals.remainingMinor).toBe(-500);
  });
});
