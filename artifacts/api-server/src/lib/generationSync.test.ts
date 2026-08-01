/**
 * generationSync.test.ts
 *
 * Key coverage:
 *  - syncProviderStatus: completion push fires exactly once under concurrent calls
 *  - syncProviderStatus: credit refund fires exactly once under concurrent calls on failure
 *  - refundCredits: writes a credit_transactions row with correct fields
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a drizzle-like update builder.
 * Plain functions (not vi.fn) so they are not affected by vi.clearAllMocks().
 * `.returning()` resolves to `rows`.
 */
function makeUpdateChain(rows: any[]) {
  const promise = Promise.resolve(rows);
  const chain: any = {
    set: () => chain,
    where: () => chain,
    returning: () => promise,
  };
  // Make the chain itself awaitable (for code that awaits without .returning)
  chain.then = promise.then.bind(promise);
  chain.catch = promise.catch.bind(promise);
  return chain;
}

/**
 * Build a drizzle-like insert builder.
 * `.values()` is a tracked vi.fn so tests can inspect it.
 */
function makeInsertChain() {
  const chain: any = { values: vi.fn().mockReturnValue(Promise.resolve(undefined)) };
  return chain;
}

// ─── Mock @workspace/db ──────────────────────────────────────────────────────
vi.mock("@workspace/db", () => {
  const db: any = {
    update: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
  };
  return {
    db,
    generationsTable: {
      id: "id",
      status: "status",
      userId: "userId",
      type: "type",
      creditsUsed: "creditsUsed",
    },
    usersTable: { id: "id", credits: "credits" },
    creditTransactionsTable: {},
  };
});

// ─── Mock providers ───────────────────────────────────────────────────────────
vi.mock("./providers", () => ({
  falPollPhoto: vi.fn(),
  falPollVideo: vi.fn(),
  falPollUgc: vi.fn(),
  falPollMusicVideo: vi.fn(),
  klingPollVideo: vi.fn(),
  seedancePollVideo: vi.fn(),
  syncPollLipsync: vi.fn(),
  heygenPollLipsync: vi.fn(),
}));

// ─── Mock push ────────────────────────────────────────────────────────────────
vi.mock("./push", () => ({
  sendPushToUser: vi.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────
import { db } from "@workspace/db";
import { sendPushToUser } from "./push";
import { syncProviderStatus, refundCredits } from "./generationSync";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("syncProviderStatus — completion atomicity", () => {
  beforeEach(() => vi.resetAllMocks());

  it("fires push exactly once when two concurrent syncs both see 'completed'", async () => {
    const providers = await import("./providers");
    (providers.falPollPhoto as any).mockResolvedValue({
      status: "completed",
      outputUrl: "https://example.com/photo.jpg",
    });

    // call 1 (first worker wins): UPDATE returns a row → push fires
    // call 2 (second worker loses): UPDATE returns [] → already completed, push skipped
    (db.update as any)
      .mockReturnValueOnce(makeUpdateChain([{ userId: "user-1", type: "photo" }]))
      .mockReturnValueOnce(makeUpdateChain([]));

    await Promise.all([
      syncProviderStatus("gen-1", "fal-photo:job-1", "photo"),
      syncProviderStatus("gen-1", "fal-photo:job-1", "photo"),
    ]);

    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    expect(sendPushToUser).toHaveBeenCalledWith(
      "user-1",
      expect.stringContaining("Photo ready"),
      expect.any(String),
      expect.objectContaining({ generationId: "gen-1" }),
    );
  });
});

describe("syncProviderStatus — failure atomicity", () => {
  beforeEach(() => vi.resetAllMocks());

  it("inserts exactly one credit_transactions row when two concurrent syncs both see 'failed'", async () => {
    const providers = await import("./providers");
    (providers.falPollPhoto as any).mockResolvedValue({
      status: "failed",
      error: "Provider timeout",
    });

    // call 1 (first worker wins status transition): returns row with credits
    // call 2 (second worker loses — row already failed): returns []
    // call 3 (winner's refundCredits → usersTable update): returns updated balance
    (db.update as any)
      .mockReturnValueOnce(makeUpdateChain([{ userId: "user-2", creditsUsed: 2 }]))
      .mockReturnValueOnce(makeUpdateChain([]))
      .mockReturnValueOnce(makeUpdateChain([{ credits: 48 }]));

    const insertChain = makeInsertChain();
    (db.insert as any).mockReturnValue(insertChain);

    await Promise.all([
      syncProviderStatus("gen-2", "fal-photo:job-2", "photo"),
      syncProviderStatus("gen-2", "fal-photo:job-2", "photo"),
    ]);

    // Exactly one credit_transactions insert — not two
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(insertChain.values).toHaveBeenCalledTimes(1);
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-2",
        amount: 2,
        type: "refund",
      }),
    );
  });

  it("increments the user balance by exactly creditsUsed (not doubled) when two concurrent syncs race", async () => {
    const providers = await import("./providers");
    const CREDITS_USED = 8; // e.g. a lipsync generation

    (providers.falPollPhoto as any).mockResolvedValue({
      status: "failed",
      error: "Provider timeout",
    });

    // Sequence of db.update calls under a race:
    //  1. Concurrent sync A — generationsTable transition (winner): returns the generation row
    //  2. Concurrent sync B — generationsTable transition (loser):  returns [] (row already failed)
    //  3. Sync A's refundCredits — usersTable balance increment:    returns updated balance
    // A correct guard means there are exactly 3 db.update calls.
    // A broken guard would produce a 4th call (sync B also incrementing the balance).
    (db.update as any)
      .mockReturnValueOnce(makeUpdateChain([{ userId: "user-4", creditsUsed: CREDITS_USED }])) // A wins
      .mockReturnValueOnce(makeUpdateChain([]))                                                 // B loses
      .mockReturnValueOnce(makeUpdateChain([{ credits: 100 - CREDITS_USED + CREDITS_USED }])); // A refunds

    const insertChain = makeInsertChain();
    (db.insert as any).mockReturnValue(insertChain);

    await Promise.all([
      syncProviderStatus("gen-4", "fal-photo:job-4", "photo"),
      syncProviderStatus("gen-4", "fal-photo:job-4", "photo"),
    ]);

    // The user balance was incremented exactly once — not twice.
    // db.update is called 3 times total:
    //   • twice for the generationsTable status transition (one winner, one loser)
    //   • once for the usersTable balance increment inside refundCredits
    // A double-refund would produce a 4th call.
    expect(db.update).toHaveBeenCalledTimes(3);

    // The single balance-increment call carries exactly creditsUsed, not 2×creditsUsed.
    expect(insertChain.values).toHaveBeenCalledTimes(1);
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-4",
        amount: CREDITS_USED,
        type: "refund",
      }),
    );
  });
});

describe("refundCredits", () => {
  beforeEach(() => vi.resetAllMocks());

  it("writes a credit_transactions row with the correct userId, amount, and type", async () => {
    // db.update returns a chain that resolves to [{ credits: 45 }]
    (db.update as any).mockReturnValue(makeUpdateChain([{ credits: 45 }]));

    const insertChain = makeInsertChain();
    (db.insert as any).mockReturnValue(insertChain);

    await refundCredits("user-3", 5, "gen-3", "provider_failure");

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-3",
        amount: 5,
        type: "refund",
        reference: "gen-3",
      }),
    );
  });
});
