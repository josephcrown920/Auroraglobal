/* eslint-disable @typescript-eslint/no-explicit-any -- the isolated Supabase-chain double intentionally models only the fluent calls under test. */
import { describe, expect, it } from "bun:test";
import {
  createPendingPurchasedGiftCard,
  issueGiftCardCore,
  redeemGiftCardCore,
} from "./gifts.functions";
import { GIFT_CARD_PRODUCTS } from "./gift-card-catalog";

// Money paths delegate redemption to a single SECURITY DEFINER transaction.
// These tests assert that the JS caller cannot reintroduce the old
// select → claim → grant split that was vulnerable to partial settlement.

function fakeAdmin(opts: {
  role?: unknown;
  insertResult?: { data: unknown; error: { message: string } | null };
  redeemResult?: unknown;
  rpcError?: { message: string } | null;
}) {
  const calls = {
    rpc: [] as Array<{ name: string; args: Record<string, unknown> }>,
    inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
  };
  function table(name: string) {
    let insertedRow: Record<string, unknown> = {};
    const builder: Record<string, any> = {};
    for (const method of ["select", "eq", "is", "order", "limit"]) builder[method] = () => builder;
    builder.insert = (row: Record<string, unknown>) => {
      insertedRow = row;
      calls.inserts.push({ table: name, row });
      return builder;
    };
    builder.maybeSingle = async () => ({
      data: name === "user_roles" ? opts.role ?? null : null,
      error: null,
    });
    builder.single = async () => opts.insertResult ?? { data: insertedRow, error: null };
    return builder;
  }
  return {
    admin: {
      from: (name: string) => table(name),
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.rpc.push({ name, args });
        if (name === "redeem_gift_card") return { data: opts.redeemResult ?? null, error: opts.rpcError ?? null };
        return { data: null, error: opts.rpcError ?? null };
      },
    },
    calls,
  };
}

describe("gift card issuance", () => {
  it("rejects non-admins before creating a reseller card", async () => {
    const { admin, calls } = fakeAdmin({ role: null });
    await expect(issueGiftCardCore({ admin } as any, "u1", {
      credits: 100, amountUsd: 5, design: "aurora",
    })).rejects.toThrow(/Admins only/);
    expect(calls.inserts).toHaveLength(0);
  });

  it("creates a Pro reseller card as active without a customer payment reference", async () => {
    const { admin, calls } = fakeAdmin({ role: { role: "admin" } });
    await issueGiftCardCore({ admin } as any, "admin1", {
      credits: 0, amountUsd: 15, kind: "pro", proDays: 30, design: "neon",
    });
    expect(calls.inserts[0]?.row).toMatchObject({
      kind: "pro", pro_days: 30, payment_status: "succeeded", status: "active",
    });
    expect(String(calls.inserts[0]?.row.code)).toMatch(/^AURA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it("creates customer purchases as pending, never active", async () => {
    const { admin, calls } = fakeAdmin({});
    await createPendingPurchasedGiftCard({ admin } as any, "buyer1", {
      productId: "creator", design: "rose", note: "For your next release", recipientEmail: "buyer@example.test",
    });
    expect(calls.inserts[0]?.row).toMatchObject({
      purchaser_id: "buyer1",
      payment_status: "pending",
      status: "pending",
      kind: "aura",
    });
  });
});

describe("redeemGiftCardCore", () => {
  it("uses exactly one atomic redemption RPC for an Aura card", async () => {
    const { admin, calls } = fakeAdmin({
      redeemResult: [{ credits: 300, kind: "aura", pro_days: 0, design: "rose" }],
    });
    const result = await redeemGiftCardCore({ admin } as any, "u1", "  aura-abcd-efgh-1234  ");
    expect(result).toMatchObject({ credits: 300, kind: "aura", design: "rose" });
    expect(calls.rpc).toEqual([{
      name: "redeem_gift_card",
      args: { _user: "u1", _code: "AURA-ABCD-EFGH-1234" },
    }]);
  });

  it("returns a Pro term from the same atomic redemption path", async () => {
    const { admin } = fakeAdmin({
      redeemResult: [{ credits: 0, kind: "pro", pro_days: 90, design: "midnight" }],
    });
    await expect(redeemGiftCardCore({ admin } as any, "u1", "AURA-PRO-90D")).resolves.toMatchObject({
      kind: "pro", pro_days: 90,
    });
  });

  it("fails without a grant when the database denies a duplicate or invalid redemption", async () => {
    const { admin, calls } = fakeAdmin({ rpcError: { message: "This card has already been redeemed" } });
    await expect(redeemGiftCardCore({ admin } as any, "u1", "AURA-USED-CARD")).rejects.toThrow(/already been redeemed/);
    expect(calls.rpc).toHaveLength(1);
  });
});
// The live gift_cards table enforces kind-aware invariants:
//   gift_cards_credits_kind_check: (aura AND credits > 0) OR (pro AND credits = 0)
//   gift_cards_pro_days_check:     (aura AND pro_days = 0) OR (pro AND pro_days > 0)
// Every sellable product must satisfy them, or checkout inserts are rejected
// by PostgreSQL before an invoice is ever created.
describe("gift card catalog obeys the DB kind/credits invariants", () => {
  for (const product of Object.values(GIFT_CARD_PRODUCTS)) {
    it(`${product.id} satisfies gift_cards_credits_kind_check + pro_days check`, () => {
      if (product.kind === "aura") {
        expect(product.credits).toBeGreaterThan(0);
        expect(product.proDays).toBe(0);
      } else {
        expect(product.kind).toBe("pro");
        expect(product.credits).toBe(0);
        expect(product.proDays).toBeGreaterThan(0);
      }
      expect(product.usdMinor).toBeGreaterThan(0);
    });
  }
});
