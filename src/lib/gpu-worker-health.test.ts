import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  checkGPUWorkerHealth,
  isWorkerHealthy,
  normalizeWorkerBase,
  probeWorkerHealth,
  type WorkerStatus,
} from "./gpu-worker-health";

// The custom/Vast worker serves its job route at `.../generate` and the
// orchestrator appends `/generate` (dispatch) and `/health` (probe). Operators
// naturally register the full `.../generate` URL, so normalization must strip it
// to avoid `.../generate/generate` and `.../generate/health`.
describe("normalizeWorkerBase", () => {
  it("leaves a bare origin untouched", () => {
    expect(normalizeWorkerBase("https://host:8000")).toBe("https://host:8000");
  });

  it("strips a trailing slash", () => {
    expect(normalizeWorkerBase("https://host:8000/")).toBe("https://host:8000");
  });

  it("strips a trailing /generate so dispatch/health build correct paths", () => {
    expect(normalizeWorkerBase("https://host:8000/generate")).toBe("https://host:8000");
  });

  it("strips a trailing /generate/ (with slash)", () => {
    expect(normalizeWorkerBase("https://host:8000/generate/")).toBe("https://host:8000");
  });

  it("is a no-op for RunPod-style endpoints", () => {
    expect(normalizeWorkerBase("https://api.runpod.ai/v2/abc")).toBe(
      "https://api.runpod.ai/v2/abc",
    );
  });

  it("does not strip a path that merely contains 'generate'", () => {
    expect(normalizeWorkerBase("https://host/generate-images")).toBe(
      "https://host/generate-images",
    );
  });
});

// ─── live-probe helpers ───────────────────────────────────────────────────────

function fakeResponse(opts: { ok?: boolean; status?: number; json?: unknown }): Response {
  const status = opts.status ?? (opts.ok === false ? 500 : 200);
  return {
    ok: opts.ok ?? (status >= 200 && status < 300),
    status,
    json: async () => opts.json,
  } as unknown as Response;
}

const realFetch = globalThis.fetch;
function installFetch(handler: (url: string) => Response) {
  const calls: string[] = [];
  // Keep this a plain function rather than a Bun mock. Other test files call
  // mock.restore(), which is process-global and can reset a mocked fetch while
  // this suite is still executing.
  const fetchImpl = ((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);
    return Promise.resolve(handler(url));
  }) as typeof fetch;
  globalThis.fetch = fetchImpl;
  return { calls, fetchImpl };
}

describe("probeWorkerHealth", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("probes custom workers at /health and strips a trailing /generate", async () => {
    const { calls } = installFetch(() => fakeResponse({ ok: true, status: 200 }));
    const r = await probeWorkerHealth({
      endpoint_url: "https://w:8000/generate",
      protocol: "custom",
    });
    expect(r).toMatchObject({ ok: true, status: 200 });
    expect(calls[0]).toBe("https://w:8000/health");
  });

  it("uses /system_stats for comfyui workers", async () => {
    const { calls } = installFetch(() => fakeResponse({ ok: true }));
    await probeWorkerHealth({ endpoint_url: "https://c:8188", protocol: "comfyui" });
    expect(calls[0]).toBe("https://c:8188/system_stats");
  });

  it("treats a RunPod payload with ready workers as ok", async () => {
    installFetch(() => fakeResponse({ json: { workers: { ready: 2, unhealthy: 0 } } }));
    const r = await probeWorkerHealth({
      endpoint_url: "https://api.runpod.ai/v2/x",
      protocol: "runpod",
      auth_token: "t",
    });
    expect(r.ok).toBe(true);
    expect(r.detail).toContain("ready:2");
  });

  it("treats a RunPod endpoint with only unhealthy workers as down", async () => {
    installFetch(() => fakeResponse({ json: { workers: { ready: 0, unhealthy: 3 } } }));
    const r = await probeWorkerHealth({
      endpoint_url: "https://api.runpod.ai/v2/x",
      protocol: "runpod",
    });
    expect(r.ok).toBe(false);
  });

  it("returns unreachable on a network error", async () => {
    globalThis.fetch = (() => Promise.reject(new Error("ECONNREFUSED"))) as unknown as typeof fetch;
    const r = await probeWorkerHealth({ endpoint_url: "https://down:9", protocol: "custom" });
    expect(r).toMatchObject({ ok: false, unreachable: true });
  });

  // A worker that answers with a non-2xx (dead tunnel, wrong port, app crashed
  // behind a still-alive reverse proxy) is NOT a network error — fetch resolves
  // fine, it just isn't healthy. Regression guard: this case used to leave
  // `error` undefined, so Admin -> Workers showed "failed" with no reason at all.
  it("surfaces the HTTP status as `error` on a non-2xx response", async () => {
    installFetch(() => fakeResponse({ ok: false, status: 502 }));
    const r = await probeWorkerHealth({ endpoint_url: "https://w:8000/generate", protocol: "custom" });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(502);
    expect(r.error).toContain("502");
  });
});

describe("isWorkerHealthy", () => {
  const base: WorkerStatus = {
    id: "1",
    name: "w",
    status: "online",
    region: "us",
    capabilities: ["image"],
    in_flight: 0,
    max_concurrency: 4,
    last_heartbeat: new Date().toISOString(),
    uptime_pct: 100,
    failure_rate: 0,
  };

  it("is healthy with a recent heartbeat, spare capacity, and low failures", () => {
    expect(isWorkerHealthy(base)).toBe(true);
  });

  it("is unhealthy when the heartbeat is stale (> 60s)", () => {
    expect(
      isWorkerHealthy({ ...base, last_heartbeat: new Date(Date.now() - 120_000).toISOString() }),
    ).toBe(false);
  });

  it("is unhealthy at full concurrency", () => {
    expect(isWorkerHealthy({ ...base, in_flight: 4, max_concurrency: 4 })).toBe(false);
  });

  it("is unhealthy with a high failure rate (>= 5%)", () => {
    expect(isWorkerHealthy({ ...base, failure_rate: 0.2 })).toBe(false);
  });
});

describe("checkGPUWorkerHealth", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  // Minimal supabaseAdmin stub: serves a worker list and records update().eq() calls.
  function fakeAdmin(workers: Array<Record<string, unknown>>) {
    const updates: Array<{ id: unknown; patch: Record<string, unknown> }> = [];
    const admin = {
      from: () => {
        const b: Record<string, unknown> = {
          select: () => b,
          order: async () => ({ data: workers, error: null }),
          update: (patch: Record<string, unknown>) => ({
            eq: async (_col: string, id: unknown) => {
              updates.push({ id, patch });
              return { error: null };
            },
          }),
        };
        return b;
      },
    };
    return { admin, updates };
  }

  it("pauses an active worker whose probe fails", async () => {
    const { admin, updates } = fakeAdmin([
      {
        id: "a",
        name: "a",
        status: "active",
        endpoint_url: "https://a/generate",
        protocol: "custom",
      },
    ]);
    const { fetchImpl } = installFetch(() => fakeResponse({ ok: false, status: 500 }));
    await checkGPUWorkerHealth(admin, fetchImpl);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ id: "a", patch: { status: "paused" } });
  });

  it("refreshes the heartbeat of an active worker that answers healthy without flipping its status", async () => {
    const { admin, updates } = fakeAdmin([
      {
        id: "h",
        name: "h",
        status: "active",
        endpoint_url: "https://h/generate",
        protocol: "custom",
      },
    ]);
    const { fetchImpl } = installFetch(() => fakeResponse({ ok: true, status: 200 }));
    await checkGPUWorkerHealth(admin, fetchImpl);
    expect(updates).toHaveLength(1);
    expect(updates[0].patch.last_heartbeat).toBeDefined();
    // Already active → status is left untouched (only the heartbeat is patched).
    expect(updates[0].patch.status).toBeUndefined();
  });

  it("flips a non-active worker to active and stamps the heartbeat once it answers healthy", async () => {
    // A worker can land in any status string coming out of the DB (e.g. a stale
    // "offline" value from an older schema/import). Anything other than the
    // admin-intentional "draining"/"paused" states must still be probed, and a
    // healthy response should flip it to "active".
    const { admin, updates } = fakeAdmin([
      {
        id: "r",
        name: "r",
        status: "offline",
        endpoint_url: "https://r/generate",
        protocol: "custom",
      },
    ]);
    const { fetchImpl } = installFetch(() => fakeResponse({ ok: true, status: 200 }));
    await checkGPUWorkerHealth(admin, fetchImpl);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ id: "r", patch: { status: "active" } });
    expect(updates[0].patch.last_heartbeat).toBeDefined();
  });

  it("never auto-flips an intentionally draining/paused worker (no probe, no update)", async () => {
    const { admin, updates } = fakeAdmin([
      { id: "d", name: "d", status: "draining", endpoint_url: "https://d", protocol: "custom" },
    ]);
    let fetched = false;
    globalThis.fetch = (() => {
      fetched = true;
      return Promise.resolve(fakeResponse({ ok: true }));
    }) as unknown as typeof fetch;
    await checkGPUWorkerHealth(admin);
    expect(updates).toHaveLength(0);
    expect(fetched).toBe(false);
  });
});
