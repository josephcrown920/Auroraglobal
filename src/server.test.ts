import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import serverHandler, {
  createAuroraFetchHandler,
  startupHealthResponse,
  unauthenticatedPublicRateLimitResponse,
  type ServerEntry,
} from "./server";

// ── Deployment readiness probe contract ───────────────────────────────────────
//
// Task #771: Autoscale's startup probe (configured in
// artifacts/web/.replit-artifact/artifact.toml) GETs /health while the app is
// still booting. src/server.ts answers it BEFORE the TanStack SSR route graph
// is consulted — if a future server-entry or artifact-config change silently
// sent the probe back through SSR, deploys would flap with false
// "Run failed at startup" alerts even though the code is fine.
//
// This suite pins the contract from three angles:
//   1. the REAL server entry (the exact module vite.config.ts redirects the
//      production Nitro bundle to) answers GET /health with 200 {ok:true};
//   2. the short-circuit provably never invokes the SSR entry (spy entry);
//   3. artifact.toml still points the production startup probe at /health and
//      still runs the bundle built from this entry.

const REAL_ENV = {};
const REAL_CTX = {};

describe("deployment readiness probe — real server entry", () => {
  // serverHandler is the actual default export that Nitro bundles into
  // .output/server/index.mjs (see the "Redirect TanStack Start's bundled
  // server entry to src/server.ts" resolveId hook in vite.config.ts). If the
  // health short-circuit were removed or reordered after the SSR handler,
  // this request would fall into the route graph and could not produce this
  // exact response — under bun there is no built route graph at all, and the
  // app has no /health route besides the short-circuit.
  it("GET /health returns HTTP 200 {ok:true} without SSR", async () => {
    const res = await serverHandler.fetch(
      new Request("http://localhost:8080/health"),
      REAL_ENV,
      REAL_CTX,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    // Probes must always observe the live process, never a cached answer.
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("GET /health with a query string still short-circuits", async () => {
    const res = await serverHandler.fetch(
      new Request("http://localhost:8080/health?probe=startup"),
      REAL_ENV,
      REAL_CTX,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("deployment readiness probe — SSR bypass proof", () => {
  function makeSpyEntry(response?: Response) {
    const calls: string[] = [];
    const entry: ServerEntry = {
      fetch: (request) => {
        calls.push(`${request.method} ${new URL(request.url).pathname}`);
        return response ?? new Response("app route", { status: 200 });
      },
    };
    return { entry, calls };
  }

  it("GET /health never reaches the SSR entry", async () => {
    const { entry, calls } = makeSpyEntry();
    const handler = createAuroraFetchHandler(entry);

    const res = await handler.fetch(
      new Request("http://localhost:8080/health"),
      REAL_ENV,
      REAL_CTX,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(calls).toEqual([]); // the application route graph was never consulted
  });

  it("non-GET /health falls through to the app (probe is GET-only)", async () => {
    const { entry, calls } = makeSpyEntry();
    const handler = createAuroraFetchHandler(entry);

    await handler.fetch(
      new Request("http://localhost:8080/health", { method: "POST" }),
      REAL_ENV,
      REAL_CTX,
    );

    expect(calls).toEqual(["POST /health"]);
  });

  it("nearby paths are NOT swallowed by the short-circuit", async () => {
    const { entry, calls } = makeSpyEntry();
    const handler = createAuroraFetchHandler(entry);

    for (const path of ["/healthz", "/health/live", "/", "/studio"]) {
      await handler.fetch(new Request(`http://localhost:8080${path}`), REAL_ENV, REAL_CTX);
    }

    expect(calls).toEqual(["GET /healthz", "GET /health/live", "GET /", "GET /studio"]);
  });

  it("app responses pass through the handler untouched", async () => {
    const { entry } = makeSpyEntry(new Response("hello", { status: 201 }));
    const handler = createAuroraFetchHandler(entry);

    const res = await handler.fetch(
      new Request("http://localhost:8080/studio"),
      REAL_ENV,
      REAL_CTX,
    );

    expect(res.status).toBe(201);
    expect(await res.text()).toBe("hello");
  });

  it("startupHealthResponse only answers GET /health", () => {
    expect(startupHealthResponse(new Request("http://x/health"))).not.toBeNull();
    expect(startupHealthResponse(new Request("http://x/health", { method: "HEAD" }))).toBeNull();
    expect(startupHealthResponse(new Request("http://x/other"))).toBeNull();
  });
});

describe("unauthenticated public API rate limiting", () => {
  it("limits credential-free public generation bursts and returns Retry-After", () => {
    const now = 1_000;
    const request = new Request("http://localhost:8080/api/public/generate", {
      method: "POST",
      headers: { "cf-connecting-ip": "198.51.100.40" },
    });
    for (let i = 0; i < 240; i++) {
      expect(unauthenticatedPublicRateLimitResponse(request, now)).toBeNull();
    }
    const rejected = unauthenticatedPublicRateLimitResponse(request, now);
    expect(rejected?.status).toBe(429);
    expect(rejected?.headers.get("retry-after")).toBe("1");
  });

  it("does not let arbitrary credentials bypass the bucket", () => {
    const authenticated = new Request("http://localhost:8080/api/public/generate", {
      method: "POST",
      headers: {
        authorization: "Bearer test-token",
        "cf-connecting-ip": "198.51.100.42",
      },
    });
    const unrelated = new Request("http://localhost:8080/studio");
    for (let i = 0; i < 240; i++) {
      expect(unauthenticatedPublicRateLimitResponse(authenticated, 1_000)).toBeNull();
    }
    expect(unauthenticatedPublicRateLimitResponse(authenticated, 1_000)?.status).toBe(429);
    expect(unauthenticatedPublicRateLimitResponse(unrelated, 1_000)).toBeNull();
  });

  it("registers API route work with waitUntil while still awaiting the response", async () => {
    const pending: Promise<unknown>[] = [];
    const handler = createAuroraFetchHandler({
      fetch: async () => new Response("ok"),
    });
    const response = await handler.fetch(
      new Request("http://localhost:8080/api/example"),
      {},
      { waitUntil: (promise: Promise<unknown>) => pending.push(promise) },
    );
    expect(response.status).toBe(200);
    expect(pending.length).toBeGreaterThanOrEqual(1);
    // The first registration is the route itself. A later registration is the
    // best-effort API log insert, which must not make this unit test depend on
    // live Supabase availability.
    await pending[0];
  });

  it("rejects missing generation auth before loading the route graph", async () => {
    const calls: string[] = [];
    const handler = createAuroraFetchHandler({
      fetch: (request) => {
        calls.push(request.url);
        return new Response("should not run");
      },
    });
    const response = await handler.fetch(
      new Request("http://localhost:8080/api/public/generate", {
        method: "POST",
        headers: { "cf-connecting-ip": "198.51.100.41" },
      }),
      {},
      {},
    );
    expect(response.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it("routes the /api/generate compatibility path to the canonical handler", async () => {
    const calls: string[] = [];
    const handler = createAuroraFetchHandler({
      fetch: (request) => {
        calls.push(new URL(request.url).pathname);
        return new Response("ok");
      },
    });
    const response = await handler.fetch(
      new Request("http://localhost:8080/api/generate", {
        method: "POST",
        headers: {
          authorization: "Bearer test-token",
          "cf-connecting-ip": "198.51.100.43",
        },
      }),
      {},
      {},
    );
    expect(response.status).toBe(200);
    expect(calls).toEqual(["/api/public/generate"]);
  });
});

// ── artifact.toml startup-probe configuration ─────────────────────────────────

const ARTIFACT_TOML_PATH = join(
  import.meta.dir,
  "..",
  "artifacts/web/.replit-artifact/artifact.toml",
);

/**
 * Minimal TOML table reader — returns the key/value pairs of one exact
 * `[header]` table (values unquoted), or null if the table is absent.
 * Deliberately dependency-free; artifact.toml is platform-managed and simple.
 */
function readTomlTable(source: string, header: string): Record<string, string> | null {
  let inTable = false;
  let found = false;
  const entries: Record<string, string> = {};

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("[")) {
      if (inTable) break; // next table begins — our table has ended
      inTable = line === `[${header}]`;
      if (inTable) found = true;
      continue;
    }
    if (!inTable || !line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^"(.*)"$/, "$1");
    entries[key] = value;
  }

  return found ? entries : null;
}

describe("artifact.toml production startup probe", () => {
  const source = readFileSync(ARTIFACT_TOML_PATH, "utf8");

  it("targets /health for the startup health check", () => {
    const table = readTomlTable(source, "services.production.health.startup");
    expect(table).not.toBeNull();
    expect(table?.path).toBe("/health");
  });

  it("production run command starts the bundle built from src/server.ts", () => {
    // vite.config.ts redirects the bundled server entry to src/server.ts, so
    // .output/server/index.mjs is the artifact that actually contains the
    // /health short-circuit asserted above. The run command now goes through
    // the start-time boot guard (scripts/start-prod.sh, docs/BACKUP_AND_DR.md),
    // which must in turn exec that bundle (or its health-gated snapshot copy,
    // whose server/index.mjs is the same hardlinked file). If either link
    // breaks, the probe contract no longer applies to what deploys run.
    const table = readTomlTable(source, "services.production");
    expect(table).not.toBeNull();
    expect(table?.run).toContain("scripts/start-prod.sh");
    const guard = readFileSync(join(import.meta.dir, "..", "scripts/start-prod.sh"), "utf8");
    expect(guard).toContain('exec bash scripts/replit-node.sh "$1/server/index.mjs"');
    expect(guard).toMatch(/AURORA_BUILD_OUTPUT:-\$ROOT\/\.output/);
  });
});
