import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// POST /api/public/workers/register is what lets a Colab/Kaggle worker
// self-register on every boot without an admin touching the Workers UI. Two
// things must never regress:
//   1. Dedup via normalizeWorkerBase() — announcing the bare origin and the
//      full `.../generate` URL for the SAME worker must update one row, not
//      spawn a second `gpu_workers` entry every restart.
//   2. The auth gate is the private AURORA_REGISTER_SECRET (not the public
//      Supabase anon key) — a missing/wrong apikey must 401 and create no worker.

type Row = Record<string, unknown>;

let gpuWorkers: Row[] = [];
let nextId = 1;
let insertCalls: Row[] = [];
let updateCalls: { id: unknown; patch: Row }[] = [];
let attemptInserts: Row[] = [];
let attemptInsertError: Error | null = null;

// A minimal, awaitable Supabase query builder scoped to `gpu_workers`. Each
// call to `.from("gpu_workers")` gets its own builder instance so concurrent
// mode tracking (select vs insert vs update) never bleeds across chains.
function makeGpuWorkersBuilder() {
  let mode: "select" | "insert" | "update" = "select";
  let insertPayload: Row | null = null;
  let updatePatch: Row | null = null;
  let updateId: unknown = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {};
  builder.select = () => builder;
  builder.insert = (payload: Row) => {
    mode = "insert";
    insertPayload = payload;
    return builder;
  };
  builder.update = (payload: Row) => {
    mode = "update";
    updatePatch = payload;
    return builder;
  };
  builder.eq = (_col: string, val: unknown) => {
    updateId = val;
    return builder;
  };
  builder.single = () => builder;
  builder.then = (resolve: (v: unknown) => unknown) => {
    if (mode === "insert" && insertPayload) {
      const row: Row = { id: `w-${nextId++}`, ...insertPayload };
      gpuWorkers.push(row);
      insertCalls.push(insertPayload);
      return resolve({ data: { id: row.id }, error: null });
    }
    if (mode === "update" && updatePatch) {
      const idx = gpuWorkers.findIndex((w) => w.id === updateId);
      if (idx >= 0) gpuWorkers[idx] = { ...gpuWorkers[idx], ...updatePatch };
      updateCalls.push({ id: updateId, patch: updatePatch });
      return resolve({ error: null });
    }
    // select("id, endpoint_url, status") — dedup lookup
    return resolve({
      data: gpuWorkers.map((w) => ({ id: w.id, endpoint_url: w.endpoint_url, status: w.status })),
      error: null,
    });
  };
  return builder;
}

const supabaseStub = {
  from: (table: string) => {
    if (table === "gpu_workers") return makeGpuWorkersBuilder();
    // worker_register_attempts — best-effort audit log; failure is configurable per test.
    return {
      insert: async (payload: Row) => {
        if (attemptInsertError) throw attemptInsertError;
        attemptInserts.push(payload);
        return { data: null, error: null };
      },
    };
  },
};

mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: supabaseStub }));

const { Route } = await import("@/routes/api/public/workers/register");

function req(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/api/public/workers/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function post(body: unknown, headers?: Record<string, string>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Route.options as any).server.handlers.POST({ request: req(body, headers) }) as Promise<Response>;
}

const SECRET = "test-register-secret";
const AUTH = { apikey: SECRET };

describe("POST /api/public/workers/register", () => {
  const realSecret = process.env.AURORA_REGISTER_SECRET;

  beforeEach(() => {
    process.env.AURORA_REGISTER_SECRET = SECRET;
    gpuWorkers = [];
    nextId = 1;
    insertCalls = [];
    updateCalls = [];
    attemptInserts = [];
    attemptInsertError = null;
  });

  afterEach(() => {
    if (realSecret === undefined) delete process.env.AURORA_REGISTER_SECRET;
    else process.env.AURORA_REGISTER_SECRET = realSecret;
  });

  function expectFailedAttempt(endpointUrl: string | null = null) {
    expect(attemptInserts).toHaveLength(1);
    expect(attemptInserts[0]).toMatchObject({
      endpoint_url: endpointUrl,
      ok: false,
    });
    expect(typeof attemptInserts[0].error).toBe("string");
    expect((attemptInserts[0].error as string).length).toBeGreaterThan(0);
  }

  function expectSuccessfulAttempt(outcome: "created" | "updated", endpointUrl: string) {
    expect(attemptInserts.at(-1)).toMatchObject({
      endpoint_url: endpointUrl,
      ok: true,
      outcome,
    });
  }

  // ── Auth gate ────────────────────────────────────────────────────────────

  it("returns 401 with no apikey at all and creates no worker", async () => {
    const res = await post({ name: "colab-1", endpoint_url: "https://colab.example.com" });
    expect(res.status).toBe(401);
    expect(gpuWorkers).toHaveLength(0);
    expect(insertCalls).toHaveLength(0);
    expect(updateCalls).toHaveLength(0);
    expectFailedAttempt();
  });

  it("returns 401 for a wrong apikey and creates no worker", async () => {
    const res = await post(
      { name: "colab-1", endpoint_url: "https://colab.example.com" },
      { apikey: "wrong-secret" },
    );
    expect(res.status).toBe(401);
    expect(gpuWorkers).toHaveLength(0);
    expectFailedAttempt();
  });

  it("rejects the public Supabase anon/publishable key — must never be accepted as a register credential", async () => {
    // The anon key ships to every browser. If it were accepted here, anyone
    // who knows the Aurora URL could register a rogue "worker" and start
    // receiving real job inputs including signed links to private user media.
    const fakeAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.fake";
    const prevPublishable = process.env.SUPABASE_PUBLISHABLE_KEY;
    const prevAnon = process.env.SUPABASE_ANON_KEY;
    process.env.SUPABASE_PUBLISHABLE_KEY = fakeAnonKey;
    process.env.SUPABASE_ANON_KEY = fakeAnonKey;

    try {
      const res = await post(
        { name: "rogue-worker", endpoint_url: "https://attacker.example.com" },
        { apikey: fakeAnonKey },
      );
      expect(res.status).toBe(401);
      expect(gpuWorkers).toHaveLength(0);
      expect(insertCalls).toHaveLength(0);
      expectFailedAttempt();
    } finally {
      if (prevPublishable === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
      else process.env.SUPABASE_PUBLISHABLE_KEY = prevPublishable;
      if (prevAnon === undefined) delete process.env.SUPABASE_ANON_KEY;
      else process.env.SUPABASE_ANON_KEY = prevAnon;
    }
  });

  it("fails closed (503) when AURORA_REGISTER_SECRET is not configured, even with a plausible apikey", async () => {
    delete process.env.AURORA_REGISTER_SECRET;
    const res = await post(
      { name: "colab-1", endpoint_url: "https://colab.example.com" },
      { apikey: "anything" },
    );
    expect(res.status).toBe(503);
    expect(gpuWorkers).toHaveLength(0);
    expectFailedAttempt();
  });

  it("also accepts the secret via Authorization: Bearer", async () => {
    const res = await post(
      { name: "colab-1", endpoint_url: "https://colab.example.com" },
      { Authorization: `Bearer ${SECRET}` },
    );
    expect(res.status).toBe(200);
    expect(gpuWorkers).toHaveLength(1);
    expectSuccessfulAttempt("created", "https://colab.example.com");
  });

  it("keeps registration working when the audit-log insert fails", async () => {
    attemptInsertError = new Error("worker_register_attempts unavailable");

    const res = await post({ name: "colab-1", endpoint_url: "https://colab.example.com" }, AUTH);

    expect(res.status).toBe(200);
    expect(gpuWorkers).toHaveLength(1);
    expect(attemptInserts).toHaveLength(0);
  });

  // ── Fresh registration ───────────────────────────────────────────────────

  it("inserts a brand-new worker with status=pending_approval and a fresh heartbeat", async () => {
    const before = Date.now();
    const res = await post(
      { name: "colab-1", endpoint_url: "https://colab.example.com", capabilities: ["lipsync"] },
      AUTH,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(true);
    // New community workers must wait for admin approval before receiving jobs.
    expect(body.registration_status).toBe("pending_approval");

    expect(gpuWorkers).toHaveLength(1);
    const row = gpuWorkers[0];
    expect(row.status).toBe("pending_approval");
    expect(typeof row.last_heartbeat).toBe("string");
    expect(new Date(row.last_heartbeat as string).getTime()).toBeGreaterThanOrEqual(before);
    expectSuccessfulAttempt("created", "https://colab.example.com");
  });

  it("a pending_approval worker that re-registers stays pending_approval (reconnect cannot self-approve)", async () => {
    // First registration → pending_approval.
    await post({ name: "colab-1", endpoint_url: "https://colab.example.com" }, AUTH);
    expect(gpuWorkers[0].status).toBe("pending_approval");

    // Worker reboots and re-announces itself — status must remain pending.
    const res = await post({ name: "colab-1", endpoint_url: "https://colab.example.com" }, AUTH);
    const body = await res.json();
    expect(body.updated).toBe(true);
    expect(body.registration_status).toBe("pending_approval");
    expect(gpuWorkers[0].status).toBe("pending_approval");
  });

  it("an already-approved (active) worker stays active on reconnect", async () => {
    // Simulate a worker that an admin has previously approved.
    await post({ name: "colab-1", endpoint_url: "https://colab.example.com" }, AUTH);
    gpuWorkers[0].status = "active"; // admin approved it

    const res = await post({ name: "colab-1", endpoint_url: "https://colab.example.com" }, AUTH);
    const body = await res.json();
    expect(body.updated).toBe(true);
    expect(body.registration_status).toBe("active");
    expect(gpuWorkers[0].status).toBe("active");
  });

  // ── Dedup on restart ─────────────────────────────────────────────────────

  it("registering the bare origin then the full .../generate URL for the same worker updates ONE row, never a duplicate", async () => {
    const res1 = await post(
      { name: "colab-1", endpoint_url: "https://colab.example.com", capabilities: ["lipsync"] },
      AUTH,
    );
    expect(res1.status).toBe(200);
    expect((await res1.json()).created).toBe(true);
    expect(gpuWorkers).toHaveLength(1);

    // Simulate a restart that announces the full /generate URL instead.
    const res2 = await post(
      { name: "colab-1", endpoint_url: "https://colab.example.com/generate", capabilities: ["lipsync"] },
      AUTH,
    );
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.updated).toBe(true);

    // Still exactly one row — no duplicate was created.
    expect(gpuWorkers).toHaveLength(1);
    expect(insertCalls).toHaveLength(1);
    expect(updateCalls).toHaveLength(1);
    expect(body2.id).toBe(gpuWorkers[0].id);
    expect(attemptInserts).toHaveLength(2);
    expect(attemptInserts[0]).toMatchObject({ ok: true, outcome: "created" });
    expectSuccessfulAttempt("updated", "https://colab.example.com/generate");
  });

  it("re-registering the identical bare-origin URL also updates in place (no duplicate)", async () => {
    await post({ name: "colab-1", endpoint_url: "https://colab.example.com" }, AUTH);
    await post({ name: "colab-1", endpoint_url: "https://colab.example.com" }, AUTH);
    await post({ name: "colab-1", endpoint_url: "https://colab.example.com/" }, AUTH);

    expect(gpuWorkers).toHaveLength(1);
    expect(insertCalls).toHaveLength(1);
    expect(updateCalls).toHaveLength(2);
  });

  // ── Optional-field overwrite semantics ───────────────────────────────────

  it("only overwrites auth_token / max_concurrency / region when provided in the payload", async () => {
    // Initial registration sets all three.
    await post(
      {
        name: "colab-1",
        endpoint_url: "https://colab.example.com",
        auth_token: "secret-token-1",
        max_concurrency: 2,
        region: "us-east",
      },
      AUTH,
    );
    expect(gpuWorkers[0].auth_token).toBe("secret-token-1");
    expect(gpuWorkers[0].max_concurrency).toBe(2);
    expect(gpuWorkers[0].region).toBe("us-east");

    // A subsequent heartbeat-style re-register omits all three — they must
    // survive untouched, not get wiped to undefined/null.
    const res = await post({ name: "colab-1", endpoint_url: "https://colab.example.com/generate" }, AUTH);
    expect(res.status).toBe(200);
    expect(gpuWorkers).toHaveLength(1);
    expect(gpuWorkers[0].auth_token).toBe("secret-token-1");
    expect(gpuWorkers[0].max_concurrency).toBe(2);
    expect(gpuWorkers[0].region).toBe("us-east");

    // Providing a new value DOES overwrite.
    await post(
      { name: "colab-1", endpoint_url: "https://colab.example.com", auth_token: "secret-token-2" },
      AUTH,
    );
    expect(gpuWorkers[0].auth_token).toBe("secret-token-2");
    // Still untouched since this call omitted it.
    expect(gpuWorkers[0].max_concurrency).toBe(2);
    expect(gpuWorkers[0].region).toBe("us-east");
  });

  it("does not set auth_token / max_concurrency / region on a fresh insert when omitted", async () => {
    await post({ name: "colab-1", endpoint_url: "https://colab.example.com" }, AUTH);
    expect(gpuWorkers[0].auth_token).toBeUndefined();
    expect(gpuWorkers[0].max_concurrency).toBeUndefined();
    expect(gpuWorkers[0].region).toBeUndefined();
  });

  // ── Two distinct workers never collide ───────────────────────────────────

  it("registering two different endpoints creates two distinct rows", async () => {
    await post({ name: "colab-1", endpoint_url: "https://colab-1.example.com" }, AUTH);
    await post({ name: "colab-2", endpoint_url: "https://colab-2.example.com" }, AUTH);
    expect(gpuWorkers).toHaveLength(2);
    expect(insertCalls).toHaveLength(2);
  });

  // ── Admin-paused/draining workers stay parked on reconnect ──────────────

  it("a reconnecting worker that an admin paused stays paused, but refreshes its heartbeat", async () => {
    await post({ name: "colab-1", endpoint_url: "https://colab.example.com" }, AUTH);
    expect(gpuWorkers[0].status).toBe("pending_approval");
    // Simulate admin approval, then a subsequent admin pause.
    gpuWorkers[0].status = "active";

    // Admin pauses it directly in gpu_workers (simulating setWorkerStatus).
    gpuWorkers[0].status = "paused";
    gpuWorkers[0].paused_reason = "admin";
    gpuWorkers[0].last_heartbeat = "2000-01-01T00:00:00.000Z";

    // Colab session reboots and re-announces itself as up.
    const res = await post(
      { name: "colab-1", endpoint_url: "https://colab.example.com/generate", capabilities: ["lipsync"] },
      AUTH,
    );
    expect(res.status).toBe(200);
    expect((await res.json()).updated).toBe(true);

    expect(gpuWorkers).toHaveLength(1);
    expect(gpuWorkers[0].status).toBe("paused");
    expect(gpuWorkers[0].last_heartbeat).not.toBe("2000-01-01T00:00:00.000Z");
    expect(gpuWorkers[0].endpoint_url).toBe("https://colab.example.com/generate");
  });

  it("a reconnecting worker that an admin set to draining stays draining", async () => {
    await post({ name: "colab-1", endpoint_url: "https://colab.example.com" }, AUTH);
    // Simulate admin approval then drain (reconnect must not reset either).
    gpuWorkers[0].status = "active";
    gpuWorkers[0].status = "draining";

    await post({ name: "colab-1", endpoint_url: "https://colab.example.com" }, AUTH);

    expect(gpuWorkers[0].status).toBe("draining");
  });

  it("a fresh (never-before-seen) worker starts pending_approval even though other rows are paused", async () => {
    await post({ name: "colab-1", endpoint_url: "https://colab-1.example.com" }, AUTH);
    gpuWorkers[0].status = "paused";

    await post({ name: "colab-2", endpoint_url: "https://colab-2.example.com" }, AUTH);

    const fresh = gpuWorkers.find((w) => w.endpoint_url === "https://colab-2.example.com");
    // All new workers land in pending_approval regardless of other workers' statuses.
    expect(fresh?.status).toBe("pending_approval");
  });
});

afterAll(() => {
  // no global env leakage beyond AURORA_REGISTER_SECRET, already restored per-test
});
