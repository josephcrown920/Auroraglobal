import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// The health-sweep endpoint is triggered by an external cron (Supabase pg_cron)
// hitting POST /api/public/workers/health with the Supabase anon `apikey`. It
// must reject anything else, and on success it must actually invoke the sweep
// (checkGPUWorkerHealth) rather than just echoing ok:true.
const healthSweepTables: string[] = [];
mock.module("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      healthSweepTables.push(table);
      return {
        select: () => ({
          order: async () => ({ data: [], error: null }),
        }),
        update: () => ({
          eq: async () => ({ error: null }),
        }),
      };
    },
  },
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
  const realPublishable = process.env.SUPABASE_PUBLISHABLE_KEY;
  const realAnon = process.env.SUPABASE_ANON_KEY;

  beforeEach(() => {
    healthSweepTables.length = 0;
    process.env.SUPABASE_PUBLISHABLE_KEY = "test-anon-key";
  });

  afterEach(() => {
    if (realPublishable === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = realPublishable;
    if (realAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = realAnon;
  });

  it("returns 401 with no credential at all", async () => {
    const res = await post();
    expect(res.status).toBe(401);
    expect(healthSweepTables).toHaveLength(0);
  });

  it("returns 401 for a wrong apikey header", async () => {
    const res = await post({ apikey: "wrong-key" });
    expect(res.status).toBe(401);
    expect(healthSweepTables).toHaveLength(0);
  });

  it("returns 200 and runs the sweep for the correct apikey header", async () => {
    const res = await post({ apikey: "test-anon-key" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, autoPaused: 0 });
    expect(healthSweepTables).toEqual(["gpu_workers"]);
  });

  it("also accepts the key via Authorization: Bearer", async () => {
    const res = await post({ Authorization: "Bearer test-anon-key" });
    expect(res.status).toBe(200);
    expect(healthSweepTables).toEqual(["gpu_workers"]);
  });

  it("fails closed when no expected key is configured at all", async () => {
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    const res = await post({ apikey: "anything" });
    expect(res.status).toBe(401);
    expect(healthSweepTables).toHaveLength(0);
  });
});
