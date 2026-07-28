/**
 * Tests for the Paystack webhook handler.
 *
 * Covers:
 *  - verifyPaystackSignature (valid / tampered body)
 *  - Full charge.success flow: credits updated, transaction row created
 *  - Idempotency: duplicate reference is ignored
 *  - Invalid signature returns 400
 */

import crypto from "node:crypto";
import express from "express";
import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";
import request from "supertest";

// ─── Mock @workspace/db ──────────────────────────────────────────────────────
// vi.mock is hoisted above all imports automatically by vitest.
vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
  usersTable: {},
  creditTransactionsTable: {},
}));

import { db } from "@workspace/db";
import webhooksRouter from "./webhooks";

// ─── Minimal test app ────────────────────────────────────────────────────────
// Avoid importing the full app (with Clerk / pino / etc.) — only the parts the
// webhook route depends on.
const testApp = (() => {
  const app = express();
  app.use("/api/paystack/webhook", express.raw({ type: "application/json" }), webhooksRouter);
  return app;
})();

// ─── Constants ───────────────────────────────────────────────────────────────

const TEST_SECRET = "test_paystack_secret_key";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Serialise `body` to a JSON string and compute the Paystack HMAC over it.
 *
 * Important: tests must use `.send(bodyStr)` (a string), NOT `.send(Buffer)`.
 * When supertest receives a Buffer with Content-Type: application/json it
 * JSON-serialises the Buffer object ({"type":"Buffer","data":[…]}), producing
 * a body that is different from what was signed.  Sending the string directly
 * avoids this — express.raw still stores it as a Buffer on req.body.
 */
function signedPayload(body: object): { bodyStr: string; sig: string } {
  const bodyStr = JSON.stringify(body);
  const sig = crypto
    .createHmac("sha512", TEST_SECRET)
    .update(Buffer.from(bodyStr))
    .digest("hex");
  return { bodyStr, sig };
}

/** A minimal charge.success event. `dataOverrides` are spread into `event.data`. */
function chargeSuccessEvent(dataOverrides: Record<string, unknown> = {}) {
  return {
    event: "charge.success",
    data: {
      reference: "ref_test_001",
      amount: 5000,
      status: "success",
      metadata: {
        userId: "user_abc",
        packageId: "starter_100",
        credits: 100,
      },
      ...dataOverrides,
    },
  };
}

/** Wire db.select() → chain that resolves to `rows` on the next call. */
function mockSelectOnce(rows: unknown[]) {
  const limitFn = vi.fn().mockResolvedValue(rows);
  const whereFn = vi.fn().mockReturnValue({ limit: limitFn });
  const fromFn = vi.fn().mockReturnValue({ where: whereFn });
  (db.select as MockedFunction<typeof db.select>).mockReturnValueOnce({ from: fromFn } as any);
}

/** Mock a successful Paystack API verification response. */
function mockPaystackVerifySuccess(amount = 5000) {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({ status: true, data: { status: "success", amount } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
}

/** Mock a failed Paystack API verification response. */
function mockPaystackVerifyFail() {
  return vi.spyOn(global, "fetch").mockResolvedValueOnce(
    new Response(
      JSON.stringify({ status: false, data: null }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/paystack/webhook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  // ── Signature verification ────────────────────────────────────────────────

  describe("signature verification", () => {
    it("returns 400 when the signature header is missing", async () => {
      const { bodyStr } = signedPayload(chargeSuccessEvent());

      const res = await request(testApp)
        .post("/api/paystack/webhook")
        .set("Content-Type", "application/json")
        .send(bodyStr);

      expect(res.status).toBe(400);
      expect(res.text).toMatch(/invalid signature/i);
    });

    it("returns 400 when the body has been tampered with after signing", async () => {
      const originalEvent = chargeSuccessEvent();
      const originalStr = JSON.stringify(originalEvent);
      // Sign the original body…
      const sig = crypto
        .createHmac("sha512", TEST_SECRET)
        .update(Buffer.from(originalStr))
        .digest("hex");
      // …then send a different body
      const tamperedStr = JSON.stringify({ ...originalEvent, tampered: true });

      const res = await request(testApp)
        .post("/api/paystack/webhook")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", sig)
        .send(tamperedStr);

      expect(res.status).toBe(400);
      expect(res.text).toMatch(/invalid signature/i);
    });

    it("returns 400 for a plausible-looking but incorrect HMAC", async () => {
      const { bodyStr } = signedPayload(chargeSuccessEvent());
      const wrongSig = "a".repeat(128); // same length as real SHA-512 hex, but wrong

      const res = await request(testApp)
        .post("/api/paystack/webhook")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", wrongSig)
        .send(bodyStr);

      expect(res.status).toBe(400);
      expect(res.text).toMatch(/invalid signature/i);
    });
  });

  // ── Successful charge flow ────────────────────────────────────────────────

  describe("charge.success – happy path", () => {
    it("credits the user, records the transaction, and returns 200", async () => {
      const event = chargeSuccessEvent();
      const { bodyStr, sig } = signedPayload(event);

      // Idempotency check → no existing transaction
      mockSelectOnce([]);
      // User lookup → existing user with 50 credits
      mockSelectOnce([{ credits: 50, plan: "free" }]);

      // Paystack verification succeeds
      mockPaystackVerifySuccess(5000);

      // db.transaction executes its callback with a fake trx
      const trxUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) });
      const trxInsertValues = vi.fn();
      const trxInsert = vi.fn().mockReturnValue({ values: trxInsertValues });
      (db.transaction as MockedFunction<typeof db.transaction>).mockImplementation(
        async (cb: (trx: any) => Promise<void>) => cb({ update: trxUpdate, insert: trxInsert }),
      );

      const res = await request(testApp)
        .post("/api/paystack/webhook")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", sig)
        .send(bodyStr);

      expect(res.status).toBe(200);
      expect(res.text).toBe("OK");

      // Transaction was opened exactly once
      expect(db.transaction).toHaveBeenCalledOnce();

      // Users table was updated
      expect(trxUpdate).toHaveBeenCalledOnce();

      // A credit_transactions row was inserted with the correct values
      expect(trxInsert).toHaveBeenCalledOnce();
      expect(trxInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user_abc",
          amount: 100,
          type: "topup",
          reference: "ref_test_001",
          balanceAfter: 150, // 50 existing + 100 purchased
        }),
      );
    });
  });

  // ── Idempotency ───────────────────────────────────────────────────────────

  describe("idempotency", () => {
    it("returns 200 without touching the DB again when the reference already exists", async () => {
      const event = chargeSuccessEvent();
      const { bodyStr, sig } = signedPayload(event);

      // Idempotency check → reference already processed
      mockSelectOnce([{ id: "tx_existing", reference: "ref_test_001" }]);

      const fetchSpy = vi.spyOn(global, "fetch");

      const res = await request(testApp)
        .post("/api/paystack/webhook")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", sig)
        .send(bodyStr);

      expect(res.status).toBe(200);
      expect(res.text).toBe("Already processed");

      // Must not call Paystack or write to DB
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(db.transaction).not.toHaveBeenCalled();
    });
  });

  // ── Edge / error cases ────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("ignores non-charge.success events with 200", async () => {
      const event = { event: "transfer.success", data: {} };
      const { bodyStr, sig } = signedPayload(event);

      const res = await request(testApp)
        .post("/api/paystack/webhook")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", sig)
        .send(bodyStr);

      expect(res.status).toBe(200);
      expect(res.text).toBe("Ignored");
    });

    it("returns 400 when required metadata fields are missing", async () => {
      // Only userId, no packageId or credits
      const event = chargeSuccessEvent({ metadata: { userId: "user_abc" } });
      const { bodyStr, sig } = signedPayload(event);

      // Idempotency check → nothing found
      mockSelectOnce([]);

      const res = await request(testApp)
        .post("/api/paystack/webhook")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", sig)
        .send(bodyStr);

      expect(res.status).toBe(400);
      expect(res.text).toMatch(/missing metadata/i);
    });

    it("returns 400 when Paystack API verification fails", async () => {
      const event = chargeSuccessEvent();
      const { bodyStr, sig } = signedPayload(event);

      // Idempotency check → nothing found
      mockSelectOnce([]);

      // Paystack returns failure
      mockPaystackVerifyFail();

      const res = await request(testApp)
        .post("/api/paystack/webhook")
        .set("Content-Type", "application/json")
        .set("x-paystack-signature", sig)
        .send(bodyStr);

      expect(res.status).toBe(400);
      expect(res.text).toMatch(/verification failed/i);
    });
  });
});
