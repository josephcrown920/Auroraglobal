import "./lib/error-capture";

import { defaultStreamHandler, createStartHandler } from "@tanstack/react-start/server";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { reportServerException } from "./lib/sentry.server";
import { logApiRequest } from "./lib/api-logger.server";
import { validateEnvAtStartup } from "./lib/env-validation.server";

// Fail fast on a missing core secret (Supabase URL/keys) instead of limping
// into confusing per-request 500s; log a value-free summary of which
// optional provider groups are configured. See src/lib/env-validation.server.ts.
validateEnvAtStartup();

export type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type PublicBucket = { tokens: number; updatedAt: number };
const publicBuckets = new Map<string, PublicBucket>();
const PUBLIC_RATE_CAPACITY = 240;
const PUBLIC_RATE_REFILL_PER_MS = PUBLIC_RATE_CAPACITY / 60_000;
const PUBLIC_BUCKET_TTL_MS = 5 * 60_000;
const PUBLIC_BUCKET_MAX_KEYS = 20_000;
let lastPublicBucketSweep = 0;
const PUBLIC_RATE_PATHS = new Set([
  "/api/public/generate",
  "/api/generate",
  "/api/public/paystack-webhook",
  "/api/public/workers/health",
]);

function requestClientKey(request: Request): string {
  // Only trust the edge-owned header. x-forwarded-for can be supplied by the
  // caller in direct/local environments and must not create arbitrary keys.
  return (request.headers.get("cf-connecting-ip") ?? "unknown").slice(0, 128);
}

function sweepPublicBuckets(now: number): void {
  if (
    publicBuckets.size < PUBLIC_BUCKET_MAX_KEYS
    && now - lastPublicBucketSweep < 60_000
  ) {
    return;
  }
  lastPublicBucketSweep = now;
  for (const [key, bucket] of publicBuckets) {
    if (now - bucket.updatedAt >= PUBLIC_BUCKET_TTL_MS) publicBuckets.delete(key);
  }
  while (publicBuckets.size >= PUBLIC_BUCKET_MAX_KEYS) {
    const oldest = publicBuckets.keys().next().value as string | undefined;
    if (!oldest) break;
    publicBuckets.delete(oldest);
  }
}

/** Cheap bounded pre-router token bucket for public API bursts. */
export function unauthenticatedPublicRateLimitResponse(
  request: Request,
  now = Date.now(),
): Response | null {
  const pathname = new URL(request.url).pathname;
  if (!PUBLIC_RATE_PATHS.has(pathname)) return null;

  sweepPublicBuckets(now);
  const key = `${pathname}:${requestClientKey(request)}`;
  const previous = publicBuckets.get(key) ?? { tokens: PUBLIC_RATE_CAPACITY, updatedAt: now };
  const elapsed = Math.max(0, now - previous.updatedAt);
  const tokens = Math.min(
    PUBLIC_RATE_CAPACITY,
    previous.tokens + elapsed * PUBLIC_RATE_REFILL_PER_MS,
  );
  if (tokens < 1) {
    publicBuckets.set(key, { tokens, updatedAt: now });
    return new Response('{"error":"Too many requests"}', {
      status: 429,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": "1",
      },
    });
  }
  publicBuckets.set(key, { tokens: tokens - 1, updatedAt: now });
  return null;
}

// Build the default TanStack Start entry from the concrete implementation
// modules instead of the package's server namespace. The namespace re-export
// can leave `createRequestHandler` unbound in the production Rollup/Nitro
// bundle.
const serverFetch = createStartHandler(defaultStreamHandler);
const serverEntry: ServerEntry = {
  fetch: (request) => serverFetch(request),
};

// Deployment readiness probe. MUST answer before the TanStack SSR route
// graph is consulted: the probe fires while the app is still warming up
// (and in environments where SSR cannot run at all), so routing it through
// the router would reintroduce false "Run failed at startup" deploy alerts.
// artifacts/web/.replit-artifact/artifact.toml points the startup probe at
// this path; src/server.test.ts pins the contract on both sides.
export function startupHealthResponse(request: Request): Response | null {
  if (request.method !== "GET" || new URL(request.url).pathname !== "/health") {
    return null;
  }

  return new Response('{"ok":true}', {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

// Some deploy targets (Cloudflare Workers, and Workers-compatible runtimes)
// terminate the isolate shortly after `fetch` returns its Response, which
// would silently kill an unawaited async write like the api_logs insert.
// `ctx.waitUntil(promise)` tells the runtime to keep the isolate alive for
// that promise without blocking the response we already returned. Node
// (this project's actual dev/prod target) has no such teardown and simply
// ignores a missing waitUntil, so this stays a no-op fallback there.
function keepAlive(ctx: unknown, promise: Promise<unknown>): void {
  const waitUntil = (ctx as { waitUntil?: (p: Promise<unknown>) => void } | null)?.waitUntil;
  if (typeof waitUntil === "function") {
    waitUntil.call(ctx, promise);
  }
  // Always attach a catch so a rejection never becomes an unhandled
  // rejection, regardless of whether waitUntil was available.
  void promise.catch(() => {});
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

   const error = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
   reportServerException(error, { source: "ssr", requestUrl: response.url });
   console.error(error);
  return brandedErrorResponse();
}

// Factory for the top-level fetch handler. Exported (with an injectable
// `entry`) so src/server.test.ts can prove the /health short-circuit never
// reaches the SSR entry — the default export below wires in the real
// TanStack entry and is what Nitro bundles into .output/server/index.mjs.
export function createAuroraFetchHandler(entry: ServerEntry) {
  return {
    async fetch(request: Request, env: unknown, ctx: unknown) {
      const healthResponse = startupHealthResponse(request);
      if (healthResponse) {
        return healthResponse;
      }

      const rateLimitResponse = unauthenticatedPublicRateLimitResponse(request);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }
      const pathname = new URL(request.url).pathname;
      if (
        request.method === "POST"
        && (pathname === "/api/public/generate" || pathname === "/api/generate")
        && !request.headers.get("authorization")
      ) {
        return new Response('{"error":"Unauthorized"}', {
          status: 401,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      }

      // Every request to src/routes/api/** passes through this single fetch
      // entry point, so logging it here (once) gives complete coverage of
      // every current and future API route without editing each route file.
      const isApiRequest = pathname.startsWith("/api/");
      const startedAt = Date.now();
      let routedRequest = request;
      if (pathname === "/api/generate") {
        const routedUrl = new URL(request.url);
        routedUrl.pathname = "/api/public/generate";
        routedRequest = new Request(routedUrl, request);
      }

      try {
        // Register the complete route promise with Workers-compatible runtimes.
        // Tick and webhook handlers intentionally await their critical queue /
        // payment finalization before acknowledging the request; waitUntil keeps
        // the isolate alive for that same promise if the client disconnects.
        const routePromise = Promise.resolve(entry.fetch(routedRequest, env, ctx));
        keepAlive(ctx, routePromise);
        const response = await routePromise;
        const normalized = await normalizeCatastrophicSsrResponse(response);
        if (isApiRequest) {
          keepAlive(
            ctx,
            logApiRequest({
              endpoint: pathname,
              method: request.method,
              status: normalized.status,
              responseTimeMs: Date.now() - startedAt,
              request,
            }),
          );
        }
        return normalized;
      } catch (error) {
        reportServerException(error, { source: "server-fetch", requestUrl: request.url });
        console.error(error);
        if (isApiRequest) {
          keepAlive(
            ctx,
            logApiRequest({
              endpoint: pathname,
              method: request.method,
              status: 500,
              responseTimeMs: Date.now() - startedAt,
              request,
            }),
          );
        }
        return brandedErrorResponse();
      }
    },
  };
}

export default createAuroraFetchHandler(serverEntry);
