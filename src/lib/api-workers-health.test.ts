import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// The health-sweep endpoint is triggered by the Replit cron workflow hitting
// POST /api/public/workers/health with the server-only CRON_SECRET `apikey`.
// It must reject anything else (including the public Supabase anon key), and
// on success it must actually invoke the sweep (checkGPUWorkerHealth) rather
// than just echoing ok:true.
const checkCalls: unknown[] = [];
mock.module("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { marker: "fake-admin" },
}));
// Preserve every real export (normalizeWorkerBase etc.) — mock.module is
// process-global in bun, so a partial stub would leak into sibling suites
// (register.test imports normalizeWorkerBase through the register route).
const realGpuWorkerHealth = await import("@/lib/gpu-worker-health");
mock.module("@/lib/gpu-worker-health", () => ({
  ...realGpuWorkerHealth,
  checkGPUWorkerHealth: mock(async (admin: unknown) => {
    checkCalls.push(admin);
    return { autoPaused: [] };
  }),
}));

const { Route } = await import("@/routes/api/public/workers/health");

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/api/public/workers/health", {
    method: "POST",
    headers,
  });
}

async function post(headers?: Record<string, string>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Route.options as any).server.handlers.POST({ request: req(headers) }) as Promise<Response>;
}

describe("POST /api/public/workers/health", () => {
  const realCronSecret = process.env.CRON_SECRET;
  const realPublishable = process.env.SUPABASE_PUBLISHABLE_KEY;

  beforeEach(() => {
    checkCalls.length = 0;
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.SUPABASE_PUBLISHABLE_KEY = "test-anon-key";
  });

  afterEach(() => {
    if (realCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = realCronSecret;
    if (realPublishable === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = realPublishable;
  });

  // mock.module is process-global in bun: the stub above replaces
  // checkGPUWorkerHealth for every file that resolves to this module (relative
  // or aliased import), including gpu-worker-health.test.ts itself. Restore the
  // real implementation once this suite is done so sibling suites see the real
  // function again instead of the no-op stub.
  afterAll(() => {
    mock.module("@/lib/gpu-worker-health", () => realGpuWorkerHealth);
  });

  it("returns 401 with no credential at all", async () => {
    const res = await post();
    expect(res.status).toBe(401);
    expect(checkCalls).toHaveLength(0);
  });

  it("returns 401 for a wrong apikey header", async () => {
    const res = await post({ apikey: "wrong-key" });
    expect(res.status).toBe(401);
    expect(checkCalls).toHaveLength(0);
  });

  it("returns 401 for the public Supabase anon key (browser-bundle credential)", async () => {
    const res = await post({ apikey: "test-anon-key" });
    expect(res.status).toBe(401);
    expect(checkCalls).toHaveLength(0);
  });

  it("returns 200 and runs the sweep for the correct CRON_SECRET apikey header", async () => {
    const res = await post({ apikey: "test-cron-secret" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, autoPaused: 0 });
    expect(checkCalls).toHaveLength(1);
  });

  it("also accepts the secret via Authorization: Bearer", async () => {
    const res = await post({ Authorization: "Bearer test-cron-secret" });
    expect(res.status).toBe(200);
    expect(checkCalls).toHaveLength(1);
  });

  it("fails closed when CRON_SECRET is not configured at all", async () => {
    delete process.env.CRON_SECRET;
    const res = await post({ apikey: "test-anon-key" });
    expect(res.status).toBe(401);
    expect(checkCalls).toHaveLength(0);
  });
});
