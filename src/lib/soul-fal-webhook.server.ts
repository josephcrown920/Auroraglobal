import { createHash, createPublicKey, verify as cryptoVerify, type JsonWebKeyInput } from "crypto";

/**
 * fal.ai LoRA-training webhook — signature/transport verification only.
 * Pulled out of the route file (per the paystack-webhook pattern: business/
 * verification logic lives in a *.server.ts unit that's directly testable;
 * the route under src/routes/ stays a thin dispatcher and cannot itself carry
 * a *.test.ts file — TanStack Start treats every file there as a route).
 *
 * fal signs every webhook with Ed25519 over
 *   `${requestId}\n${userId}\n${timestamp}\n${sha256(body)}`
 * using a rotating key published at fal's JWKS endpoint. Verification steps,
 * all REQUIRED before touching the payload:
 *   1. Timestamp within a 5-minute window (replay protection).
 *   2. Signature verifies against at least one currently-published JWKS key.
 * A `?secret=` query param gate (SOUL_FAL_WEBHOOK_SECRET) is checked first as
 * a cheap first line of defense; when unset, JWKS verification alone gates
 * the request (still safe — the secret is a defense-in-depth extra, not the
 * only proof of authenticity).
 */

const JWKS_URL = "https://rest.fal.ai/.well-known/jwks.json";
const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const JWKS_TTL_MS = 10 * 60_000;

let jwksCache: { keys: Array<{ x: string }>; fetchedAt: number } | null = null;

/** Test-only hook — clears the module-level JWKS cache between test cases. */
export function resetJwksCacheForTests() {
  jwksCache = null;
}

async function fetchJwks(): Promise<Array<{ x: string }>> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed [${res.status}]`);
  const json = (await res.json()) as { keys?: Array<{ x?: string; crv?: string }> };
  const keys = (json.keys ?? []).filter((k) => k.crv === "Ed25519" && typeof k.x === "string") as Array<{
    x: string;
  }>;
  jwksCache = { keys, fetchedAt: Date.now() };
  return keys;
}

async function verifyFalSignature(
  requestId: string,
  userId: string,
  timestamp: string,
  bodyDigestHex: string,
  signatureHex: string,
): Promise<boolean> {
  const message = Buffer.from(`${requestId}\n${userId}\n${timestamp}\n${bodyDigestHex}`);
  const signature = Buffer.from(signatureHex, "hex");
  const keys = await fetchJwks();
  for (const key of keys) {
    try {
      const publicKey = createPublicKey({
        key: { kty: "OKP", crv: "Ed25519", x: key.x },
        format: "jwk",
      } as JsonWebKeyInput);
      if (cryptoVerify(null, message, publicKey, signature)) return true;
    } catch {
      // try the next key
    }
  }
  return false;
}

export type SoulFalWebhookVerification =
  | { ok: true; requestId: string; body: string }
  | { ok: false; status: number; message: string };

/**
 * Verify an incoming fal.ai webhook Request end-to-end (secret gate, header
 * presence, timestamp window, Ed25519 signature). Returns the raw body text
 * on success so the caller (route dispatcher) can parse and act on it — kept
 * separate so verification is unit-testable without touching Supabase.
 */
export async function verifySoulFalWebhook(request: Request): Promise<SoulFalWebhookVerification> {
  const url = new URL(request.url);
  const requiredSecret = process.env.SOUL_FAL_WEBHOOK_SECRET;
  if (requiredSecret && url.searchParams.get("secret") !== requiredSecret) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const requestId = request.headers.get("x-fal-webhook-request-id") ?? "";
  const userId = request.headers.get("x-fal-webhook-user-id") ?? "";
  const timestamp = request.headers.get("x-fal-webhook-timestamp") ?? "";
  const signature = request.headers.get("x-fal-webhook-signature") ?? "";
  const body = await request.text();

  if (!requestId || !timestamp || !signature) {
    return { ok: false, status: 401, message: "Missing signature headers" };
  }
  const tsMs = Number(timestamp) * 1000;
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > MAX_CLOCK_SKEW_MS) {
    return { ok: false, status: 401, message: "Stale timestamp" };
  }
  const bodyDigest = createHash("sha256").update(body).digest("hex");

  try {
    const valid = await verifyFalSignature(requestId, userId, timestamp, bodyDigest, signature);
    if (!valid) return { ok: false, status: 401, message: "Invalid signature" };
  } catch (err) {
    console.error("[soul/fal-webhook] JWKS verification error", err);
    return { ok: false, status: 503, message: "Verification unavailable" };
  }

  return { ok: true, requestId, body };
}
