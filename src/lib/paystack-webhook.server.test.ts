import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { createHmac } from "crypto";

// processPaymentSuccess drives the purchase money-path: grant credits, persist
// the profit split, and record an affiliate conversion when the buyer was
// referred. It talks only to supabaseAdmin, so a configurable in-memory stub
// lets us assert exactly which RPCs/inserts/updates fire — no live DB.

type TableData = { data: unknown; error: { message: string } | null };
let tables: Record<string, TableData> = {};
// Optional per-table queue of select() results, consumed in order — lets a test
// simulate the row "appearing" only after a couple of retries.
let selectQueues: Record<string, TableData[]> = {};
// Optional per-table result for the row created via .insert().select().maybeSingle().
let insertResults: Record<string, TableData> = {};
let rpcResult: Record<string, { data: unknown; error: { message: string } | null }> = {};
const calls = {
  rpc: [] as Array<{ name: string; args: Record<string, unknown> }>,
  inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
  updates: [] as Array<{ table: string; patch: Record<string, unknown> }>,
};

function builder(table: string) {
  let op: "select" | "insert" | "update" | "delete" = "select";
  const resolve = () => {
    if (op === "insert") {
      return insertResults[table] ?? { data: null, error: null };
    }
    if (op !== "select") return { data: null, error: null };
    const queue = selectQueues[table];
    if (queue && queue.length > 0) {
      return queue.length > 1 ? queue.shift()! : queue[0];
    }
    return tables[table] ?? { data: null, error: null };
  };
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "order", "limit", "contains", "is", "in", "gte", "lte"]) {
    b[m] = () => b;
  }
  b.insert = (row: Record<string, unknown>) => {
    op = "insert";
    calls.inserts.push({ table, row });
    return b;
  };
  b.update = (patch: Record<string, unknown>) => {
    op = "update";
    calls.updates.push({ table, patch });
    return b;
  };
  b.delete = () => {
    op = "delete";
    return b;
  };
  b.maybeSingle = async () => resolve();
  b.single = async () => resolve();
  (b as { then: unknown }).then = (res: (v: unknown) => unknown) => res(resolve());
  return b;
}

const supabaseAdmin = {
  from: (t: string) => builder(t),
  rpc: async (name: string, args: Record<string, unknown>) => {
    calls.rpc.push({ name, args });
    return rpcResult[name] ?? { data: true, error: null };
  },
};

mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin }));

const {
  canRecoverStuckPayment,
  verifyPaystackSignature,
  processPaymentSuccess,
} =
  await import("./paystack-webhook.server");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ev = (data: Record<string, unknown>) => ({ event: "charge.success", data }) as any;

beforeEach(() => {
  tables = {};
  selectQueues = {};
  insertResults = {};
  rpcResult = {};
  calls.rpc.length = 0;
  calls.inserts.length = 0;
  calls.updates.length = 0;
});

describe("verifyPaystackSignature", () => {
  it("accepts a correct HMAC-SHA512 signature and rejects bad ones", () => {
    const secret = "sk_test_x";
    const body = "{}";
    const sig = createHmac("sha512", secret).update(body).digest("hex");
    expect(verifyPaystackSignature(sig, body, secret)).toBe(true);
    expect(verifyPaystackSignature(sig, body, "wrong-secret")).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing", () => {
    const secret = "sk_test_x";
    const body = "{}";
    expect(verifyPaystackSignature("deadbeef", body, secret)).toBe(false);
  });
});

describe("processPaymentSuccess", () => {
  it("grants credits and persists the profit split for a fresh payment", async () => {
    tables.payments = {
      data: { id: "p1", user_id: "u1", credits_granted: 500, status: "pending", amount_kobo: 1000 },
      error: null,
    };
    const r = await processPaymentSuccess(
      ev({
        reference: "ref-race2",
        status: "success",
        amount: 1000,
        metadata: { user_id: "u1", credits: 500 },
      }),
      { retryDelaysMs: [] },
    );
    expect(r).toMatchObject({ status: "success", paymentId: "p1" });

    const grant = calls.rpc.find((c) => c.name === "grant_credits");
    expect(grant?.args).toMatchObject({
      _user: "u1",
      _amount: 500,
      _reason: "purchase",
      _ref: "p1",
    });

    const upd = calls.updates.find((u) => u.table === "payments");
    expect(upd?.patch).toMatchObject({
      status: "succeeded",
      profit_amount_minor: 600,
      credit_funding_amount_minor: 400,
      split_profit_pct: 60,
    });
  });

  it("is idempotent — an already-succeeded payment is not re-granted", async () => {
    tables.payments = {
      data: {
        id: "p1",
        user_id: "u1",
        credits_granted: 500,
        status: "succeeded",
        amount_kobo: 1000,
      },
      error: null,
    };
    const r = await processPaymentSuccess(
      ev({
        reference: "ref-race2",
        status: "success",
        amount: 1000,
        metadata: { user_id: "u1", credits: 500 },
      }),
      { retryDelaysMs: [] },
    );
    expect(r).toEqual({ status: "already_processed" });
    expect(calls.rpc.find((c) => c.name === "grant_credits")).toBeUndefined();
  });

  it("recovers a payment twice without double-granting credits", async () => {
    // The first sweep sees the pending row and grants it. The second sweep
    // reads the same row after it was marked succeeded and takes the
    // already_processed branch.
    selectQueues.payments = [
      {
        data: {
          id: "p-retry",
          user_id: "u1",
          credits_granted: 500,
          status: "pending",
          amount_kobo: 1000,
        },
        error: null,
      },
      {
        data: {
          id: "p-retry",
          user_id: "u1",
          credits_granted: 500,
          status: "succeeded",
          amount_kobo: 1000,
        },
        error: null,
      },
    ];
    const event = ev({ reference: "ref-retry", status: "success", amount: 1000 });

    const first = await processPaymentSuccess(event, { retryDelaysMs: [] });
    const second = await processPaymentSuccess(event, { retryDelaysMs: [] });

    expect(first).toMatchObject({ status: "success", paymentId: "p-retry" });
    expect(second).toEqual({ status: "already_processed" });
    expect(calls.rpc.filter((call) => call.name === "grant_credits")).toHaveLength(1);
  });

  it("does not recover a stuck payment when credits_granted is missing", () => {
    expect(
      canRecoverStuckPayment({ user_id: "u1", credits_granted: null as never }),
    ).toBe(false);
    expect(
      canRecoverStuckPayment({ user_id: "u1", credits_granted: 0 }),
    ).toBe(false);
    expect(
      canRecoverStuckPayment({ user_id: null as never, credits_granted: 500 }),
    ).toBe(false);
    expect(
      canRecoverStuckPayment({ user_id: "u1", credits_granted: 500 }),
    ).toBe(true);
  });

  it("rejects a signed event whose amount or currency differs from Aurora's pending quote", async () => {
    tables.payments = {
      data: {
        id: "p1",
        user_id: "u1",
        credits_granted: 500,
        status: "pending",
        amount_kobo: 1000,
        currency: "USD",
      },
      error: null,
    };

    await expect(
      processPaymentSuccess(ev({ reference: "ref1", status: "success", amount: 900, currency: "USD" })),
    ).rejects.toThrow(/amount mismatch/);
    await expect(
      processPaymentSuccess(ev({ reference: "ref1", status: "success", amount: 1000, currency: "NGN" })),
    ).rejects.toThrow(/currency mismatch/);
    expect(calls.rpc.find((c) => c.name === "grant_credits")).toBeUndefined();
  });

  it("throws when the payment reference is unknown and the webhook has no recovery metadata", async () => {
    tables.payments = { data: null, error: null };
    await expect(
      processPaymentSuccess(ev({ reference: "missing", status: "success" }), {
        retryDelaysMs: [],
      }),
    ).rejects.toThrow(/Payment not found/);
    expect(calls.rpc.find((c) => c.name === "grant_credits")).toBeUndefined();
  });

  it("retries when the payments row hasn't landed yet and succeeds once it appears", async () => {
    // Simulate the checkout redirect's insert finishing between the first
    // (empty) lookup and the second retry attempt.
    selectQueues.payments = [
      { data: null, error: null },
      {
        data: { id: "p1", user_id: "u1", credits_granted: 500, status: "pending", amount_kobo: 1000 },
        error: null,
      },
    ];
    const r = await processPaymentSuccess(
      ev({
        reference: "ref-race2",
        status: "success",
        amount: 1000,
        metadata: { user_id: "u1", credits: 500 },
      }),
      { retryDelaysMs: [] },
    );
    expect(r).toMatchObject({ status: "success", paymentId: "p1" });
    expect(calls.rpc.find((c) => c.name === "grant_credits")).toBeTruthy();
  });

  it("recovers a never-persisted payment from webhook metadata instead of dropping the credit grant", async () => {
    tables.payments = { data: null, error: null };
    insertResults.payments = {
      data: { id: "p-recovered", user_id: "u1", credits_granted: 500, status: "pending", amount_kobo: 1000 },
      error: null,
    };
    const r = await processPaymentSuccess(
      ev({
        reference: "ref-race2",
        status: "success",
        amount: 1000,
        metadata: { user_id: "u1", credits: 500 },
      }),
      { retryDelaysMs: [] },
    );
    expect(r).toMatchObject({ status: "success", paymentId: "p-recovered" });

    const insertedRow = calls.inserts.find((i) => i.table === "payments");
    expect(insertedRow?.row).toMatchObject({
      reference: "ref-race2",
      user_id: "u1",
      credits_granted: 500,
      status: "pending",
    });
    const grant = calls.rpc.find((c) => c.name === "grant_credits");
    expect(grant?.args).toMatchObject({ _user: "u1", _amount: 500, _reason: "purchase" });
  });

  it("does not double-grant when the recovery insert races and another writer already created the row", async () => {
    // Insert "fails" (unique constraint on reference) because the row was
    // created concurrently and already marked succeeded — we must read that
    // row, not throw and not re-grant.
    tables.payments = {
      data: { id: "p1", user_id: "u1", credits_granted: 500, status: "succeeded", amount_kobo: 1000 },
      error: null,
    };
    insertResults.payments = { data: null, error: { message: "duplicate key value" } };
    const r = await processPaymentSuccess(
      ev({
        reference: "ref-race2",
        status: "success",
        amount: 1000,
        metadata: { user_id: "u1", credits: 500 },
      }),
      { retryDelaysMs: [] },
    );
    expect(r).toEqual({ status: "already_processed" });
    expect(calls.rpc.find((c) => c.name === "grant_credits")).toBeUndefined();
  });

  it("records an affiliate conversion and bumps total earned when the buyer was referred", async () => {
    tables.payments = {
      data: { id: "p1", user_id: "u1", credits_granted: 500, status: "pending", amount_kobo: 5000 },
      error: null,
    };
    tables.affiliates = {
      data: { code: "promo", commission_pct: 20, total_earned_usd: 1 },
      error: null,
    };
    await processPaymentSuccess(
      ev({ reference: "ref1", status: "success", amount: 5000, metadata: { ref: "PROMO" } }),
    );

    // amount 5000 minor → $50 → 20% commission = $10
    const conv = calls.inserts.find((i) => i.table === "affiliate_events");
    expect(conv?.row).toMatchObject({
      code: "promo",
      kind: "conversion",
      amount_usd: 10,
      user_id: "u1",
      ref_id: "p1",
    });
    const affUpd = calls.updates.find((u) => u.table === "affiliates");
    expect(affUpd?.patch).toMatchObject({ total_earned_usd: 11 });
  });

  it("skips affiliate recording when the ref code maps to no affiliate", async () => {
    tables.payments = {
      data: { id: "p1", user_id: "u1", credits_granted: 100, status: "pending", amount_kobo: 1000 },
      error: null,
    };
    tables.affiliates = { data: null, error: null };
    await processPaymentSuccess(
      ev({ reference: "r", status: "success", amount: 1000, metadata: { ref: "nope" } }),
    );
    expect(calls.inserts.find((i) => i.table === "affiliate_events")).toBeUndefined();
  });
});

afterEach(() => {
  /* state reset handled in beforeEach */
});

afterAll(() => {
  /* module mock is process-local to this test file */
});
