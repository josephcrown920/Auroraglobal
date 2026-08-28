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

      // Every request to src/routes/api/** passes through this single fetch
      // entry point, so logging it here (once) gives complete coverage of
      // every current and future API route without editing each route file.
      const pathname = new URL(request.url).pathname;
      const isApiRequest = pathname.startsWith("/api/");
      const startedAt = Date.now();

      try {
        const response = await entry.fetch(request, env, ctx);
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
