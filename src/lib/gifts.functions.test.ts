import { describe, expect, it } from "bun:test";
import { issueGiftCardCore, redeemGiftCardCore } from "./gifts.functions";

// Gift cards are a money-path: issuing is admin-gated and redeeming must grant
// credits exactly once and fail closed when the conditional claim loses a race.
// The createServerFn handlers can't run without a Start request context, so we
// exercise the deps-injected cores with an in-memory admin stub.

function fakeAdmin(opts: {
  role?: unknown;
  card?: unknown;
  updateResult?: { data: unknown; error: { message: string } | null };
  insertResult?: { data: unknown; error: { message: string } | null };
  grantError?: { message: string } | null;
}) {
  const calls = {
    rpc: [] as Array<{ name: string; args: unknown }>,
    inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
    updates: [] as Array<{ table: string; patch: unknown }>,
  };
  function table(name: string) {
    let op: "select" | "insert" | "update" = "select";
    let insertedRow: Record<string, unknown> = {};
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "order", "limit"]) b[m] = () => b;
    b.insert = (row: Record<string, unknown>) => {
      op = "insert";
      insertedRow = row;
      calls.inserts.push({ table: name, row });
      return b;
    };
    b.update = (patch: unknown) => {
      op = "update";
      calls.updates.push({ table: name, patch });
      return b;
    };
    b.maybeSingle = async () => {
      if (name === "user_roles") return { data: opts.role ?? null, error: null };
      if (name === "gift_cards") return { data: opts.card ?? null, error: null };
      return { data: null, error: null };
    };
    b.single = async () => {
      if (op === "insert") return opts.insertResult ?? { data: insertedRow, error: null };
      if (op === "update") return opts.updateResult ?? { data: { id: "c1" }, error: null };
      return { data: null, error: null };
    };
    return b;
  }
  const admin = {
    from: (n: string) => table(n),
    rpc: async (name: string, args: unknown) => {
      calls.rpc.push({ name, args });
      return { data: null, error: opts.grantError ?? null };
    },
  };
  return { admin, calls };
}

describe("issueGiftCardCore", () => {
  it("rejects non-admins before creating a card", async () => {
    const { admin, calls } = fakeAdmin({ role: null });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      issueGiftCardCore({ admin } as any, "u1", { credits: 100, amountUsd: 5, design: "aurora" }),
    ).rejects.toThrow(/Admins only/);
    expect(calls.inserts).toHaveLength(0);
  });

  it("creates a gift card for an admin with a generated AURA- code", async () => {
    const { admin, calls } = fakeAdmin({
      role: { role: "admin" },
      insertResult: { data: { id: "c1" }, error: null },
    });
    const row = await issueGiftCardCore(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { admin } as any,
      "admin1",
      { credits: 250, amountUsd: 10, design: "neon", note: "vip" },
    );
    expect(row).toMatchObject({ id: "c1" });
    const ins = calls.inserts[0];
    expect(ins.row).toMatchObject({
      credits: 250,
      amount_usd: 10,
      design: "neon",
      note: "vip",
      created_by: "admin1",
    });
    expect(String(ins.row.code)).toMatch(/^AURA-/);
  });
});

describe("redeemGiftCardCore", () => {
  it("rejects an unknown code", async () => {
    const { admin } = fakeAdmin({ card: null });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      redeemGiftCardCore({ admin } as any, "u1", "AURA-XXXX-YYYY"),
    ).rejects.toThrow(/Invalid gift card code/);
  });

  it("rejects an already-redeemed card", async () => {
    const { admin } = fakeAdmin({
      card: { id: "c1", credits: 100, redeemed_by: "someone", design: "aurora" },
    });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      redeemGiftCardCore({ admin } as any, "u1", "code"),
    ).rejects.toThrow(/already been redeemed/);
  });

  it("fails closed (no credit grant) when the conditional claim loses the race", async () => {
    const { admin, calls } = fakeAdmin({
      card: { id: "c1", credits: 100, redeemed_by: null, design: "aurora" },
      updateResult: { data: null, error: null },
    });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      redeemGiftCardCore({ admin } as any, "u1", "code"),
    ).rejects.toThrow(/just redeemed by someone else/);
    expect(calls.rpc.find((c) => c.name === "grant_credits")).toBeUndefined();
  });

  it("grants credits exactly once on a successful redemption", async () => {
    const { admin, calls } = fakeAdmin({
      card: { id: "c1", credits: 300, redeemed_by: null, design: "rose" },
      updateResult: { data: { id: "c1", redeemed_by: "u1" }, error: null },
    });
    const r = await redeemGiftCardCore(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { admin } as any,
      "u1",
      "  aura-abcd-efgh  ",
    );
    expect(r).toMatchObject({ credits: 300, design: "rose" });
    const grant = calls.rpc.find((c) => c.name === "grant_credits");
    expect(grant?.args).toMatchObject({
      _user: "u1",
      _amount: 300,
      _reason: "gift_card_redeem",
      _ref: "c1",
    });
  });

  it("surfaces a grant_credits RPC error", async () => {
    const { admin } = fakeAdmin({
      card: { id: "c1", credits: 100, redeemed_by: null, design: "aurora" },
      updateResult: { data: { id: "c1" }, error: null },
      grantError: { message: "ledger down" },
    });
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      redeemGiftCardCore({ admin } as any, "u1", "code"),
    ).rejects.toThrow(/ledger down/);
  });
});
