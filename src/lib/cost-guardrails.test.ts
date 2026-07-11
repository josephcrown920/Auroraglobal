import { describe, it, expect } from "bun:test";
import { assertDailyBudget, type DailyBudgetDeps } from "./cost-guardrails.server";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const UID = "user-aaa";

function deps(
  limit: number | null,
  reservedToday: number,
  releasedToday = 0,
): DailyBudgetDeps {
  return {
    getProfile: async () => ({ daily_spend_limit: limit }),
    getLedgerRows: async () => [
      // reserve rows: negative delta (credits leaving the balance)
      ...(reservedToday > 0
        ? [{ delta: -reservedToday, reason: "reserve:orchestrate" }]
        : []),
      // release rows: positive delta (credits coming back on failure)
      ...(releasedToday > 0
        ? [{ delta: releasedToday, reason: "release:orchestrate" }]
        : []),
    ],
  };
}

// ─── assertDailyBudget ───────────────────────────────────────────────────────

describe("assertDailyBudget", () => {
  it("passes when no daily_spend_limit is set (null profile)", async () => {
    const d: DailyBudgetDeps = {
      getProfile: async () => null,
      getLedgerRows: async () => [],
    };
    await expect(assertDailyBudget(UID, 999, d)).resolves.toBeUndefined();
  });

  it("passes when daily_spend_limit is null", async () => {
    await expect(assertDailyBudget(UID, 999, deps(null, 0))).resolves.toBeUndefined();
  });

  it("passes when no credits have been spent yet and cost < limit", async () => {
    await expect(assertDailyBudget(UID, 50, deps(100, 0))).resolves.toBeUndefined();
  });

  it("passes when spent + cost is exactly equal to limit", async () => {
    // 80 spent + 20 requested = 100 exactly → allowed (strict > check)
    await expect(assertDailyBudget(UID, 20, deps(100, 80))).resolves.toBeUndefined();
  });

  it("throws when spent + cost exceeds limit by 1", async () => {
    await expect(assertDailyBudget(UID, 21, deps(100, 80))).rejects.toThrow(
      /daily_limit_reached/,
    );
  });

  it("throws when cost alone already exceeds limit", async () => {
    await expect(assertDailyBudget(UID, 200, deps(100, 0))).rejects.toThrow(
      /daily_limit_reached/,
    );
  });

  it("includes spent and limit in the error message for UI readability", async () => {
    const err = await assertDailyBudget(UID, 21, deps(100, 80)).catch((e) => e as Error);
    expect(err.message).toContain("80");
    expect(err.message).toContain("100");
  });

  it("error message starts with Unsupported so job fails terminally (no retry)", async () => {
    const err = await assertDailyBudget(UID, 21, deps(100, 80)).catch((e) => e as Error);
    expect(err.message.startsWith("Unsupported")).toBe(true);
  });

  it("release rows (refunds) reduce net spend correctly", async () => {
    // 80 reserved, 30 released → net = 50; cost = 49 → under 100-limit → pass
    await expect(assertDailyBudget(UID, 49, deps(100, 80, 30))).resolves.toBeUndefined();
  });

  it("release rows reduce net spend — over limit still throws", async () => {
    // 80 reserved, 10 released → net = 70; cost = 31 → 101 > 100 → throws
    await expect(assertDailyBudget(UID, 31, deps(100, 80, 10))).rejects.toThrow(
      /daily_limit_reached/,
    );
  });

  it("ignores ledger rows with unrelated reason prefixes (e.g. commit:, topup:)", async () => {
    const mixedDeps: DailyBudgetDeps = {
      getProfile: async () => ({ daily_spend_limit: 100 }),
      getLedgerRows: async () => [
        { delta: -50, reason: "reserve:orchestrate" },
        { delta: 50, reason: "commit:orchestrate" },   // bookkeeping — ignored
        { delta: 100, reason: "topup:paystack" },       // top-up — ignored
        { delta: -200, reason: "admin:adjustment" },    // admin — ignored
      ],
    };
    // Only reserve: row counts → spent = 50; cost = 49 → under limit
    await expect(assertDailyBudget(UID, 49, mixedDeps)).resolves.toBeUndefined();
    // cost = 51 → 101 > 100 → throws
    await expect(assertDailyBudget(UID, 51, mixedDeps)).rejects.toThrow(/daily_limit_reached/);
  });
});
