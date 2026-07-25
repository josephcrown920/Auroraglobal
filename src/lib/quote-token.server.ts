// Stateless signed quote tokens for quote-to-charge parity enforcement.
//
// Purpose: `quoteGenerate` and `/api/estimate` sign the computed billing
// features into an opaque token. `orchestrateGenerate` validates the token
// at execution and uses the quoted features as the authoritative billing set,
// throwing if motion was quoted but cannot be reproduced at charge time.
//
// Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature)
// No DB required — stateless, like a minimal JWT.
//
// Signing key: derived from SUPABASE_SERVICE_ROLE_KEY so no new secret is needed.
// The token is anti-tamper only (not auth) — a client cannot forge quoted features.

export type QuotePayload = {
  /** Billing kind at quote time. */
  k: string;
  /** Detected feature set at quote time (e.g. ["video", "motion"]). */
  f: string[];
  /** Resolution at quote time, if applicable. */
  r?: string;
  /** Duration (seconds) at quote time, if applicable. */
  d?: number;
};

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function getKey(usage: "sign" | "verify"): Promise<CryptoKey> {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!raw) {
    // Fail-closed in production: missing secret means tokens cannot be signed
    // or verified, which would allow quote features to be tampered with.
    if (process.env.NODE_ENV === "production") {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for quote token signing in production");
    }
    // In non-production environments (local dev, CI) use a fixed key so that
    // unit tests and local runs work without secrets configured. Tokens signed
    // with this key are only valid in the same non-production environment.
  }
  const secret = `quote:${(raw ?? "aurora-dev-quote-secret-local-only").slice(0, 40)}`;
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

/**
 * Sign a quote payload. Returns an opaque string the client can send back with
 * the execution request. Verification confirms the features were not tampered with.
 */
export async function signQuoteToken(payload: QuotePayload): Promise<string> {
  const body = JSON.stringify(payload);
  const bodyB64 = b64url(new TextEncoder().encode(body).buffer as ArrayBuffer);
  const key = await getKey("sign");
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${bodyB64}.${b64url(sig)}`;
}

/**
 * Verify a quote token and return its payload. Throws if the signature is
 * invalid or the token is malformed.
 */
export async function verifyQuoteToken(token: string): Promise<QuotePayload> {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Malformed quote token");
  }
  const [bodyB64, sigB64] = parts;

  let body: string;
  try {
    body = new TextDecoder().decode(b64urlDecode(bodyB64));
  } catch {
    throw new Error("Malformed quote token (body)");
  }

  const expectedSig = b64urlDecode(sigB64);
  const key = await getKey("verify");
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    expectedSig.buffer as ArrayBuffer,
    new TextEncoder().encode(body),
  );
  if (!valid) throw new Error("Quote token signature invalid — possible tampering");

  try {
    return JSON.parse(body) as QuotePayload;
  } catch {
    throw new Error("Malformed quote token (payload)");
  }
}
