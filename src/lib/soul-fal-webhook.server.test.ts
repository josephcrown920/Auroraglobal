import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { createHash, generateKeyPairSync, sign as cryptoSign } from "crypto";
import {
  verifySoulFalWebhook as verifySoulFalWebhookImpl,
  resetJwksCacheForTests,
} from "./soul-fal-webhook.server";

// Real Ed25519 key pair so signatures verify against a JWKS response the test
// controls — no reliance on fal.ai's live endpoint.
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicJwk = publicKey.export({ format: "jwk" }) as { x: string };

function signWebhook(requestId: string, userId: string, timestampSec: number, body: string) {
  const bodyDigest = createHash("sha256").update(body).digest("hex");
  const message = Buffer.from(`${requestId}\n${userId}\n${timestampSec}\n${bodyDigest}`);
  return cryptoSign(null, message, privateKey).toString("hex");
}

function jwksResponse(): Response {
  return new Response(JSON.stringify({ keys: [{ crv: "Ed25519", x: publicJwk.x }] }), { status: 200 });
}

let jwksFetcher: typeof fetch;
let originalEnv: string | undefined;

beforeEach(() => {
  originalEnv = process.env.SOUL_FAL_WEBHOOK_SECRET;
  delete process.env.SOUL_FAL_WEBHOOK_SECRET;
  resetJwksCacheForTests();
  jwksFetcher = mock(async () => jwksResponse()) as unknown as typeof fetch;
});

afterEach(() => {
  if (originalEnv === undefined) delete process.env.SOUL_FAL_WEBHOOK_SECRET;
  else process.env.SOUL_FAL_WEBHOOK_SECRET = originalEnv;
});

function verifySoulFalWebhook(request: Request, fetcher = jwksFetcher) {
  return verifySoulFalWebhookImpl(request, { fetcher });
}

// These tests replace process-global fetch to control the JWKS response. Keep
// them serial so the unavailable-JWKS case cannot race a valid-signature case.
describe.serial("verifySoulFalWebhook", () => {
  it("rejects a request missing signature headers", async () => {
    const result = await verifySoulFalWebhook(
      new Request("https://example.com/api/soul/fal-webhook", { method: "POST", body: "{}" }),
    );
    expect(result).toEqual({ ok: false, status: 401, message: "Missing signature headers" });
  });

  it("rejects a stale timestamp even with otherwise well-formed headers", async () => {
    const body = JSON.stringify({ request_id: "req_1", status: "OK" });
    const staleTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1h old
    const signature = signWebhook("req_1", "user_1", staleTimestamp, body);
    const result = await verifySoulFalWebhook(
      new Request("https://example.com/api/soul/fal-webhook", {
        method: "POST",
        body,
        headers: {
          "x-fal-webhook-request-id": "req_1",
          "x-fal-webhook-user-id": "user_1",
          "x-fal-webhook-timestamp": String(staleTimestamp),
          "x-fal-webhook-signature": signature,
        },
      }),
    );
    expect(result).toEqual({ ok: false, status: 401, message: "Stale timestamp" });
  });

  it("returns 503 (not 401) when JWKS verification itself is unavailable", async () => {
    jwksFetcher = mock(async () => new Response("down", { status: 500 })) as unknown as typeof fetch;
    const body = JSON.stringify({ request_id: "req_1", status: "OK" });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhook("req_1", "user_1", timestamp, body);
    const result = await verifySoulFalWebhook(
      new Request("https://example.com/api/soul/fal-webhook", {
        method: "POST",
        body,
        headers: {
          "x-fal-webhook-request-id": "req_1",
          "x-fal-webhook-user-id": "user_1",
          "x-fal-webhook-timestamp": String(timestamp),
          "x-fal-webhook-signature": signature,
        },
      }),
    );
    expect(result).toEqual({ ok: false, status: 503, message: "Verification unavailable" });
  });

  it("rejects a signature that doesn't verify against the published JWKS", async () => {
    const body = JSON.stringify({ request_id: "req_1", status: "OK" });
    const timestamp = Math.floor(Date.now() / 1000);
    const result = await verifySoulFalWebhook(
      new Request("https://example.com/api/soul/fal-webhook", {
        method: "POST",
        body,
        headers: {
          "x-fal-webhook-request-id": "req_1",
          "x-fal-webhook-user-id": "user_1",
          "x-fal-webhook-timestamp": String(timestamp),
          "x-fal-webhook-signature": "00".repeat(64), // well-formed hex, wrong signature
        },
      }),
    );
    expect(result).toEqual({ ok: false, status: 401, message: "Invalid signature" });
  });

  it("accepts a genuinely valid signature and returns the raw body", async () => {
    const body = JSON.stringify({ request_id: "req_1", status: "OK" });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhook("req_1", "user_1", timestamp, body);
    const result = await verifySoulFalWebhook(
      new Request("https://example.com/api/soul/fal-webhook", {
        method: "POST",
        body,
        headers: {
          "x-fal-webhook-request-id": "req_1",
          "x-fal-webhook-user-id": "user_1",
          "x-fal-webhook-timestamp": String(timestamp),
          "x-fal-webhook-signature": signature,
        },
      }),
    );
    expect(result).toEqual({ ok: true, requestId: "req_1", body });
  });

  it("rejects when the ?secret= gate is configured and missing/wrong", async () => {
    process.env.SOUL_FAL_WEBHOOK_SECRET = "correct-secret";
    const body = JSON.stringify({ request_id: "req_1", status: "OK" });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhook("req_1", "user_1", timestamp, body);
    const result = await verifySoulFalWebhook(
      new Request("https://example.com/api/soul/fal-webhook?secret=wrong-secret", {
        method: "POST",
        body,
        headers: {
          "x-fal-webhook-request-id": "req_1",
          "x-fal-webhook-user-id": "user_1",
          "x-fal-webhook-timestamp": String(timestamp),
          "x-fal-webhook-signature": signature,
        },
      }),
    );
    expect(result).toEqual({ ok: false, status: 401, message: "Unauthorized" });
  });

  it("accepts when the ?secret= gate is configured and correct (still verifies signature)", async () => {
    process.env.SOUL_FAL_WEBHOOK_SECRET = "correct-secret";
    const body = JSON.stringify({ request_id: "req_1", status: "OK" });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhook("req_1", "user_1", timestamp, body);
    const result = await verifySoulFalWebhook(
      new Request("https://example.com/api/soul/fal-webhook?secret=correct-secret", {
        method: "POST",
        body,
        headers: {
          "x-fal-webhook-request-id": "req_1",
          "x-fal-webhook-user-id": "user_1",
          "x-fal-webhook-timestamp": String(timestamp),
          "x-fal-webhook-signature": signature,
        },
      }),
    );
    expect(result).toEqual({ ok: true, requestId: "req_1", body });
  });
});
