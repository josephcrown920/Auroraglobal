import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

// Unit tests for the three subscription event handlers extracted from the
// Paystack webhook route into the shared service module.  All DB calls are
// stubbed so the tests are fast, offline, and deterministic.
//
// Reminder for future contributors: subscription business logic belongs in
// paystack-webhook.server.ts, NOT in the route file.  The route must stay a
// thin dispatcher.  Tests here ensure each handler calls exactly the RPCs and
// table writes the business rules require.

type TableData = { data: unknown; error: { message: string } | null };
let tables: Record<string, TableData> = {};
let upsertResults: Record<string, TableData> = {};
let rpcResult: Record<string, { data: unknown; error: { message: string } | null }> = {};
const calls = {
  rpc: [] as Array<{ name: string; args: Record<string, unknown> }>,
  inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
  updates: [] as Array<{ table: string; patch: Record<string, unknown> }>,
  upserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
};

function builder(table: string) {
  let op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  const resolve = () => {
    if (op === "insert") return upsertResults[table] ?? { data: null, error: null };
    if (op === "upsert") return upsertResults[table] ?? { data: null, error: null };
    if (op !== "select") return { data: null, error: null };
    return tables[table] ?? { data: null, error: null };
  };
  const b: Record<string, unknown> = {};
  for (const m of [
    "select", "eq", "neq", "order", "limit", "contains", "is", "in", "gte", "lte",
  ]) {
    b[m] = () => b;
  }
  b.insert = (row: Record<string, unknown>) => {
    op = "insert";
    calls.inserts.push({ table, row });
    return b;
  };
  b.upsert = (row: Record<string, unknown>, _opts?: unknown) => {
    op = "upsert";
    calls.upserts.push({ table, row });
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

const { processSubscriptionCreate, processSubscriptionRenewal, processSubscriptionDisable } =
  await import("./paystack-webhook.server");

beforeEach(() => {
  tables = {};
  upsertResults = {};
  rpcResult = {};
  calls.rpc.length = 0;
  calls.inserts.length = 0;
  calls.updates.length = 0;
  calls.upserts.length = 0;
});

// ── processSubscriptionCreate ─────────────────────────────────────────────────

describe("processSubscriptionCreate", () => {
  it("activates Pro, grants monthly Aura, and upserts the subscriptions row", async () => {
    tables.profiles = { data: { user_id: "u1" }, error: null };

    const result = await processSubscriptionCreate({
      subscription_code: "SUB_abc",
      customer: { email: "user@example.com", customer_code: "CUS_1" },
      plan: { plan_code: "PLN_pro" },
      next_payment_date: "2026-09-15T00:00:00Z",
      email_token: "tok_xyz",
      amount: 1500,
    });

    expect(result).toMatchObject({ status: "success", userId: "u1", subscriptionCode: "SUB_abc" });

    const activate = calls.rpc.find((c) => c.name === "activate_pro_subscription");
    expect(activate?.args).toMatchObject({
      _user: "u1",
      _sub_code: "SUB_abc",
    });
    expect(typeof activate?.args._expires_at).toBe("string");

    const grantAura = calls.rpc.find((c) => c.name === "grant_monthly_aura");
    expect(grantAura?.args).toMatchObject({
      _user: "u1",
      _amount: 2000, // SUBSCRIPTION_TIERS.pro.monthly_aura
    });
    expect(typeof grantAura?.args._ref).toBe("string");

    const upsert = calls.upserts.find((u) => u.table === "subscriptions");
    expect(upsert?.row).toMatchObject({
      user_id: "u1",
      paystack_subscription_code: "SUB_abc",
      paystack_customer_code: "CUS_1",
      plan_code: "PLN_pro",
      status: "active",
      amount_minor: 1500,
      currency: "USD",
    });
  });

  it("is idempotent — the monthly Aura ref is stable for the same subCode+month", async () => {
    tables.profiles = { data: { user_id: "u1" }, error: null };

    await processSubscriptionCreate({ subscription_code: "SUB_abc" });
    const ref1 = calls.rpc.find((c) => c.name === "grant_monthly_aura")?.args._ref;
    calls.rpc.length = 0;

    tables.profiles = { data: { user_id: "u1" }, error: null };
    await processSubscriptionCreate({ subscription_code: "SUB_abc" });
    const ref2 = calls.rpc.find((c) => c.name === "grant_monthly_aura")?.args._ref;

    expect(ref1).toBe(ref2);
  });

  it("returns ignored when the customer email matches no profile", async () => {
    tables.profiles = { data: null, error: null };
    const result = await processSubscriptionCreate({
      subscription_code: "SUB_abc",
      customer: { email: "nobody@example.com" },
    });
    expect(result).toEqual({ status: "ignored" });
    expect(calls.rpc.length).toBe(0);
  });

  it("returns ignored when subscription_code is absent", async () => {
    tables.profiles = { data: { user_id: "u1" }, error: null };
    const result = await processSubscriptionCreate({
      customer: { email: "user@example.com" },
    });
    expect(result).toEqual({ status: "ignored" });
    expect(calls.rpc.length).toBe(0);
  });

  it("uses the fallback expiry (~32 days) when next_payment_date is absent", async () => {
    tables.profiles = { data: { user_id: "u1" }, error: null };
    await processSubscriptionCreate({ subscription_code: "SUB_abc" });
    const activate = calls.rpc.find((c) => c.name === "activate_pro_subscription");
    const expiry = new Date(activate?.args._expires_at as string);
    const daysFromNow = (expiry.getTime() - Date.now()) / 86400000;
    expect(daysFromNow).toBeGreaterThan(30);
    expect(daysFromNow).toBeLessThan(35);
  });
});

// ── processSubscriptionRenewal ────────────────────────────────────────────────

describe("processSubscriptionRenewal", () => {
  it("extends Pro expiry, grants monthly Aura, and marks subscription active", async () => {
    tables.subscriptions = { data: { user_id: "u1", next_payment_date: null }, error: null };

    const result = await processSubscriptionRenewal({ subscription_code: "SUB_abc" });
    expect(result).toMatchObject({ status: "success", userId: "u1", subscriptionCode: "SUB_abc" });

    expect(calls.rpc.find((c) => c.name === "activate_pro_subscription")).toBeTruthy();
    const grantAura = calls.rpc.find((c) => c.name === "grant_monthly_aura");
    expect(grantAura?.args).toMatchObject({ _user: "u1", _amount: 2000 });

    const upd = calls.updates.find((u) => u.table === "subscriptions");
    expect(upd?.patch).toMatchObject({ status: "active" });
    expect(typeof upd?.patch.next_payment_date).toBe("string");
  });

  it("falls back to metadata.user_id when the subscriptions row has no user_id", async () => {
    tables.subscriptions = { data: null, error: null };
    const result = await processSubscriptionRenewal({
      subscription_code: "SUB_abc",
      metadata: { user_id: "u_meta" },
    });
    expect(result).toMatchObject({ status: "success", userId: "u_meta" });
    const grant = calls.rpc.find((c) => c.name === "grant_monthly_aura");
    expect(grant?.args._user).toBe("u_meta");
  });

  it("returns ignored when subscription_code is absent", async () => {
    const result = await processSubscriptionRenewal({});
    expect(result).toEqual({ status: "ignored" });
    expect(calls.rpc.length).toBe(0);
  });

  it("returns ignored when no userId can be resolved", async () => {
    tables.subscriptions = { data: null, error: null };
    const result = await processSubscriptionRenewal({ subscription_code: "SUB_abc" });
    expect(result).toEqual({ status: "ignored" });
    expect(calls.rpc.length).toBe(0);
  });

  it("produces the same monthly Aura ref as subscription.create for the same subCode in the same month", async () => {
    // Both events must produce the same ref so the DB unique index deduplicates
    // the grant whichever fires second (initial subscription race).
    tables.profiles = { data: { user_id: "u1" }, error: null };
    tables.subscriptions = { data: { user_id: "u1", next_payment_date: null }, error: null };

    await processSubscriptionCreate({ subscription_code: "SUB_dup" });
    const createRef = calls.rpc.find((c) => c.name === "grant_monthly_aura")?.args._ref;
    calls.rpc.length = 0;

    tables.subscriptions = { data: { user_id: "u1", next_payment_date: null }, error: null };
    await processSubscriptionRenewal({ subscription_code: "SUB_dup" });
    const renewRef = calls.rpc.find((c) => c.name === "grant_monthly_aura")?.args._ref;

    expect(createRef).toBe(renewRef);
    expect(typeof createRef).toBe("string");
  });
});

// ── processSubscriptionDisable ────────────────────────────────────────────────

describe("processSubscriptionDisable", () => {
  it("deactivates the Pro subscription and marks the row cancelled", async () => {
    tables.subscriptions = { data: { user_id: "u1" }, error: null };

    const result = await processSubscriptionDisable({ subscription_code: "SUB_abc" });
    expect(result).toMatchObject({ status: "success", userId: "u1", subscriptionCode: "SUB_abc" });

    const deactivate = calls.rpc.find((c) => c.name === "deactivate_pro_subscription");
    expect(deactivate?.args).toMatchObject({ _user: "u1" });

    const upd = calls.updates.find((u) => u.table === "subscriptions");
    expect(upd?.patch).toMatchObject({ status: "cancelled" });
  });

  it("returns ignored when subscription_code is absent", async () => {
    const result = await processSubscriptionDisable({});
    expect(result).toEqual({ status: "ignored" });
    expect(calls.rpc.length).toBe(0);
  });

  it("returns ignored when the subscriptions row cannot be found", async () => {
    tables.subscriptions = { data: null, error: null };
    const result = await processSubscriptionDisable({ subscription_code: "SUB_unknown" });
    expect(result).toEqual({ status: "ignored" });
    expect(calls.rpc.length).toBe(0);
  });
});

afterAll(() => {
  /* module mock is process-local to this test file */
});
