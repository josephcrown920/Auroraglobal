import { describe, expect, test } from "bun:test";
import { shouldConfirmPackPurchase } from "./billing-pack-confirm";
import { PLANS } from "./billing.plans";
import { auraValueEstimate } from "./pricing";

describe("shouldConfirmPackPurchase", () => {
  test("requires confirmation when the pack cannot fund a performance render", () => {
    expect(
      shouldConfirmPackPurchase({ performanceCount: 0, confirmedKey: null, key: "starter" }),
    ).toBe(true);
  });

  test("second click (already confirmed for this pack) proceeds", () => {
    expect(
      shouldConfirmPackPurchase({ performanceCount: 0, confirmedKey: "starter", key: "starter" }),
    ).toBe(false);
  });

  test("confirmation acknowledged for another pack does not carry over", () => {
    expect(
      shouldConfirmPackPurchase({ performanceCount: 0, confirmedKey: "creator", key: "starter" }),
    ).toBe(true);
  });

  test("packs that fund at least one render proceed immediately", () => {
    expect(
      shouldConfirmPackPurchase({ performanceCount: 1, confirmedKey: null, key: "creator" }),
    ).toBe(false);
    expect(
      shouldConfirmPackPurchase({ performanceCount: 12, confirmedKey: null, key: "studio" }),
    ).toBe(false);
  });

  test("gate matches the live warning condition for every pack at current pricing", () => {
    // The confirmation must appear exactly when the amber card warning does:
    // both derive from auraValueEstimate(pack.credits, "performance").count.
    for (const key of ["starter", "creator", "studio"] as const) {
      const { count } = auraValueEstimate(PLANS[key].credits, "performance");
      expect(
        shouldConfirmPackPurchase({ performanceCount: count, confirmedKey: null, key }),
      ).toBe(count === 0);
    }
  });
});
