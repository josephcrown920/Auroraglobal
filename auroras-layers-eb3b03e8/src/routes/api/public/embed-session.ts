import { createFileRoute } from "@tanstack/react-router";
import { embedCorsHeaders, isAllowedEmbedOrigin, normalizeEmbedOrigin } from "@/lib/embedCors";

/**
 * Token-based SSO for the Aurora Layers embed.
 *
 * The host app (Replit) mints a short-lived HMAC-signed token for the signed-in
 * user and hands it to the embed. This endpoint verifies the signature and
 * returns a one-time Supabase magic-link token_hash the embed exchanges for a
 * session — so the user is signed in inside Layers without ever seeing a login
 * screen, and without the host sharing passwords.
 *
 * Token format:  base64url(JSON payload) + "." + hex(HMAC-SHA256)
 * Payload:       { sub: string, email: string, name?: string, aud: string, exp: number }
 */

type Payload = {
  sub: string;
  email: string;
  name?: string;
  aud: string;
  exp: number;
};

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...embedCorsHeaders(origin) },
  });
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const withPad = padded + "=".repeat((4 - (padded.length % 4)) % 4);
  return atob(withPad);
}

function hexEncode(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string): Promise<string> {
  return hexEncode(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

const MAX_TOKEN_TTL_MS = 5 * 60 * 1000;

async function verifyToken(token: string, secret: string): Promise<Payload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = hexEncode(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload)),
  );
  if (!timingSafeEqual(expected, signature.toLowerCase())) return null;

  let payload: Payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as Payload;
  } catch {
    return null;
  }

  if (
    typeof payload?.email !== "string" ||
    payload.email.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) ||
    typeof payload.sub !== "string" ||
    payload.sub.length === 0 ||
    payload.sub.length > 256 ||
    (payload.name !== undefined &&
      (typeof payload.name !== "string" || payload.name.length > 120)) ||
    typeof payload.aud !== "string" ||
    !normalizeEmbedOrigin(payload.aud) ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp) ||
    payload.exp * 1000 <= Date.now() ||
    payload.exp * 1000 > Date.now() + MAX_TOKEN_TTL_MS
  ) {
    return null;
  }
  return payload;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const MAX_TRACKED_CLIENTS = 2_000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function clientAddress(request: Request): string {
  const forwarded =
    request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

function rateLimitHeaders(request: Request): Record<string, string> | null {
  const key = clientAddress(request);
  const now = Date.now();
  if (attempts.size > MAX_TRACKED_CLIENTS) {
    for (const [address, record] of attempts) {
      if (record.resetAt <= now) attempts.delete(address);
    }
  }
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }
  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return { "Retry-After": String(Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return null;
}

export const Route = createFileRoute("/api/public/embed-session")({
  server: {
    handlers: {
      OPTIONS: ({ request }) =>
        new Response(null, {
          status: 204,
          headers: embedCorsHeaders(request.headers.get("origin")),
        }),

      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        const secret = process.env["AURORA_EMBED_SSO_SECRET"];
        if (!secret) {
          return json({ error: "SSO is not configured for this deployment." }, 501, origin);
        }

        const tooManyRequests = rateLimitHeaders(request);
        if (tooManyRequests) {
          return new Response(
            JSON.stringify({ error: "Too many session requests. Try again shortly." }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                ...embedCorsHeaders(origin),
                ...tooManyRequests,
              },
            },
          );
        }

        const contentLength = Number(request.headers.get("content-length") ?? "0");
        if (Number.isFinite(contentLength) && contentLength > 10_240) {
          return json({ error: "Request body is too large." }, 413, origin);
        }

        let body: { token?: unknown; hostOrigin?: unknown };
        try {
          body = (await request.json()) as { token?: unknown; hostOrigin?: unknown };
        } catch {
          return json({ error: "Invalid JSON body." }, 400, origin);
        }
        const token = typeof body.token === "string" ? body.token : "";
        const hostOrigin = normalizeEmbedOrigin(body.hostOrigin);
        if (token.length === 0 || token.length > 8192) {
          return json({ error: "A valid token is required." }, 400, origin);
        }
        if (!hostOrigin || !isAllowedEmbedOrigin(hostOrigin)) {
          return json({ error: "This host is not approved for embed SSO." }, 403, origin);
        }

        const payload = await verifyToken(token, secret);
        if (!payload) return json({ error: "Invalid or expired SSO token." }, 401, origin);
        if (normalizeEmbedOrigin(payload.aud) !== hostOrigin) {
          return json({ error: "SSO token audience does not match this host." }, 401, origin);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error: tokenUseError } = await supabaseAdmin
          .from("aurora_embed_sso_tokens")
          .insert({
            token_hash: await sha256Hex(token),
            host_origin: hostOrigin,
            expires_at: new Date(payload.exp * 1000).toISOString(),
          });

        if (tokenUseError) {
          if (tokenUseError.code === "23505") {
            return json({ error: "This SSO token has already been used." }, 409, origin);
          }
          console.error("Could not reserve Aurora embed SSO token.", tokenUseError);
          return json({ error: "Could not establish an embed session." }, 503, origin);
        }

        // Create the user on first sight; ignore "already registered".
        await supabaseAdmin.auth.admin.createUser({
          email: payload.email,
          email_confirm: true,
          user_metadata: {
            host_user_id: payload.sub,
            full_name: payload.name ?? null,
            source: "aurora-embed-sso",
          },
        });

        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: payload.email,
        });

        if (error || !data?.properties?.hashed_token) {
          return json({ error: "Could not establish an embed session." }, 500, origin);
        }

        return json({ email: payload.email, tokenHash: data.properties.hashed_token }, 200, origin);
      },
    },
  },
});
