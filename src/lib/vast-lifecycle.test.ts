// Guardrail tests for the Vast GPU lifecycle service. Everything runs against
// an in-memory repo + fake Vast client — no live Vast calls, no live DB.

import { describe, expect, test } from "bun:test";
import type { VastClient, VastInstance, VastOffer } from "./vast-api.server";
import {
  createVastLifecycle,
  endpointFromInstance,
  makeConfirmToken,
  VAST_CONFIRM_TTL_MS,
  VAST_MAX_HOURLY_USD,
  VAST_MAX_RUNTIME_MS,
  VastGuardrailError,
  verifyConfirmToken,
  type ManagedInstanceRow,
  type ManagedRepo,
} from "./vast-lifecycle.server";

const SECRET = "test-secret";
const APP_URL = "https://aurora.test";

function fakeOffer(over: Partial<VastOffer> = {}): VastOffer {
  return {
    id: 111,
    gpu_name: "RTX 3090",
    num_gpus: 1,
    dph_total: 0.2,
    gpu_ram_gb: 24,
    disk_space_gb: 100,
    cuda_max_good: 12.4,
    reliability: 0.99,
    geolocation: "US",
    verified: true,
    ...over,
  };
}

function fakeInstance(over: Partial<VastInstance> = {}): VastInstance {
  return {
    id: 9001,
    actual_status: "running",
    intended_status: "running",
    gpu_name: "RTX 3090",
    num_gpus: 1,
    dph_total: 0.2,
    public_ipaddr: "1.2.3.4",
    ports: { "8000/tcp": [{ HostIp: "1.2.3.4", HostPort: "40123" }] },
    label: "test",
    start_date: 0,
    ...over,
  };
}

function makeRepo(initial: ManagedInstanceRow[] = []) {
  const rows: ManagedInstanceRow[] = [...initial];
  let seq = 0;
  const repo: ManagedRepo = {
    async getByVastId(v) {
      return rows.find((r) => r.vast_instance_id === v) ?? null;
    },
    async get(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async insert(row) {
      if (rows.some((r) => r.vast_instance_id === row.vast_instance_id)) {
        throw new Error("duplicate key value violates unique constraint");
      }
      // Mirror the partial unique index: one active non-adopted rental.
      const activeStates = ["renting", "running", "stopped"];
      if (!row.adopted && activeStates.includes(row.state) && rows.some((r) => !r.adopted && activeStates.includes(r.state))) {
        throw new Error('duplicate key value violates unique constraint "vast_managed_one_active_rental_idx"');
      }
      const full: ManagedInstanceRow = { ...row, id: `row-${++seq}`, created_at: new Date().toISOString() };
      rows.push(full);
      return full;
    },
    async update(id, patch) {
      const r = rows.find((x) => x.id === id);
      if (!r) throw new Error("row not found");
      Object.assign(r, patch);
    },
    async listActive() {
      return rows.filter((r) => r.state === "renting" || r.state === "running" || r.state === "stopped");
    },
    async listRecent(limit) {
      return rows.slice(-limit).reverse();
    },
  };
  return { repo, rows };
}

function makeVast(over: Partial<VastClient> = {}) {
  const calls: Record<string, unknown[][]> = { create: [], destroy: [], stop: [] };
  const vast: VastClient = {
    async searchOffers() {
      return [fakeOffer()];
    },
    async getOfferById(id) {
      return fakeOffer({ id });
    },
    async listInstances() {
      return [];
    },
    async getInstance() {
      return fakeInstance();
    },
    async createInstance(offerId, opts) {
      calls.create.push([offerId, opts]);
      return { instanceId: 9001 };
    },
    async stopInstance(id) {
      calls.stop.push([id]);
    },
    async destroyInstance(id) {
      calls.destroy.push([id]);
    },
    ...over,
  };
  return { vast, calls };
}

const NOW = new Date("2026-08-10T12:00:00Z");

function makeService(opts: { vast?: VastClient; repo?: ManagedRepo; now?: () => Date } = {}) {
  const { repo } = makeRepo();
  return createVastLifecycle({
    vast: opts.vast ?? makeVast().vast,
    repo: opts.repo ?? repo,
    now: opts.now ?? (() => NOW),
    confirmSecret: SECRET,
    appUrl: APP_URL,
  });
}

function validToken(offerId: number, price: number) {
  return makeConfirmToken(SECRET, offerId, price, NOW.getTime() + VAST_CONFIRM_TTL_MS);
}

const baseProvision = {
  offerId: 111,
  hourlyUsd: 0.2,
  userId: "user-1",
  registerSecret: "reg-secret",
};

describe("confirm tokens", () => {
  test("round-trips for the same offer/price", () => {
    const t = validToken(111, 0.2);
    expect(verifyConfirmToken(SECRET, t, 111, 0.2, NOW.getTime()).ok).toBe(true);
  });
  test("rejects a different offer, price, or expired token", () => {
    const t = validToken(111, 0.2);
    expect(verifyConfirmToken(SECRET, t, 222, 0.2, NOW.getTime()).ok).toBe(false);
    expect(verifyConfirmToken(SECRET, t, 111, 0.35, NOW.getTime()).ok).toBe(false);
    expect(verifyConfirmToken(SECRET, t, 111, 0.2, NOW.getTime() + VAST_CONFIRM_TTL_MS + 1).ok).toBe(false);
    expect(verifyConfirmToken(SECRET, "garbage", 111, 0.2, NOW.getTime()).ok).toBe(false);
  });
});

describe("provision guardrails", () => {
  test("refuses prices above the $0.35/hr ceiling", async () => {
    const lc = makeService();
    await expect(
      lc.provision({ ...baseProvision, hourlyUsd: 0.36, confirmToken: validToken(111, 0.36) }),
    ).rejects.toThrow(VastGuardrailError);
  });

  test("refuses without a valid confirm token (no single-call billable rental)", async () => {
    const lc = makeService();
    await expect(lc.provision({ ...baseProvision, confirmToken: "" })).rejects.toThrow(/Confirmation required/);
    await expect(
      lc.provision({ ...baseProvision, confirmToken: validToken(999, 0.2) }),
    ).rejects.toThrow(/Confirmation required/);
  });

  test("refuses when the register secret is missing", async () => {
    const lc = makeService();
    await expect(
      lc.provision({ ...baseProvision, confirmToken: validToken(111, 0.2), registerSecret: "" }),
    ).rejects.toThrow(/AURORA_REGISTER_SECRET/);
  });

  test("creates the instance with a 1-hour destroy deadline and bootstrap env", async () => {
    const { vast, calls } = makeVast();
    const { repo } = makeRepo();
    const lc = createVastLifecycle({ vast, repo, now: () => NOW, confirmSecret: SECRET, appUrl: APP_URL });
    const row = await lc.provision({ ...baseProvision, confirmToken: validToken(111, 0.2) });
    expect(row.state).toBe("renting");
    expect(new Date(row.destroy_deadline).getTime() - NOW.getTime()).toBe(VAST_MAX_RUNTIME_MS);
    const [, opts] = calls.create[0] as [number, { env: Record<string, string>; onstartCmd: string }];
    expect(opts.env.AURORA_URL).toBe(APP_URL);
    expect(opts.env.AURORA_REGISTER_SECRET).toBe("reg-secret");
    expect(opts.onstartCmd).toContain("/api/public/workers/files/vast_bootstrap.py");
  });

  test("re-validates the LIVE offer price before renting — repriced offers are rejected", async () => {
    const { vast, calls } = makeVast({
      getOfferById: async (id) => fakeOffer({ id, dph_total: 0.3 }), // repriced above the confirmed 0.2
    });
    const { repo } = makeRepo();
    const lc = createVastLifecycle({ vast, repo, now: () => NOW, confirmSecret: SECRET, appUrl: APP_URL });
    await expect(lc.provision({ ...baseProvision, confirmToken: validToken(111, 0.2) })).rejects.toThrow(
      /now costs \$0\.3\/hr/,
    );
    expect(calls.create.length).toBe(0); // nothing rented
  });

  test("rejects offers that vanished between search and provision", async () => {
    const { vast } = makeVast({ getOfferById: async () => null });
    const lc = makeService({ vast });
    await expect(lc.provision({ ...baseProvision, confirmToken: validToken(111, 0.2) })).rejects.toThrow(
      /no longer available/,
    );
  });

  test("passes worker env + port 8000 to the Vast create call", async () => {
    const { vast, calls } = makeVast();
    const { repo } = makeRepo();
    const lc = createVastLifecycle({ vast, repo, now: () => NOW, confirmSecret: SECRET, appUrl: APP_URL });
    await lc.provision({ ...baseProvision, confirmToken: validToken(111, 0.2) });
    const [, opts] = calls.create[0] as [number, { env: Record<string, string>; ports: number[] }];
    expect(opts.env.AURORA_URL).toBe(APP_URL);
    expect(opts.env.AURORA_REGISTER_SECRET).toBeTruthy();
    expect(opts.ports).toEqual([8000]);
  });

  test("parallel provision calls: exactly one rents, the other hits the reservation lock", async () => {
    const { repo } = makeRepo();
    const { vast, calls } = makeVast();
    const lc = createVastLifecycle({ vast, repo, now: () => NOW, confirmSecret: SECRET, appUrl: APP_URL });
    const results = await Promise.allSettled([
      lc.provision({ ...baseProvision, confirmToken: validToken(111, 0.2) }),
      lc.provision({ ...baseProvision, confirmToken: validToken(111, 0.2) }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok.length).toBe(1);
    expect(failed.length).toBe(1);
    expect(String(failed[0].reason)).toMatch(/already active/);
    expect(calls.create.length).toBe(1); // only one billable create
  });

  test("Vast create failure releases the reservation so a retry can proceed", async () => {
    const { repo, rows } = makeRepo();
    let fail = true;
    const { vast } = makeVast({
      createInstance: async () => {
        if (fail) throw new Error("vast 500");
        return { instanceId: 9001 };
      },
    });
    const lc = createVastLifecycle({ vast, repo, now: () => NOW, confirmSecret: SECRET, appUrl: APP_URL });
    await expect(lc.provision({ ...baseProvision, confirmToken: validToken(111, 0.2) })).rejects.toThrow("vast 500");
    expect(rows[0].state).toBe("failed"); // reservation released
    fail = false;
    const row = await lc.provision({ ...baseProvision, confirmToken: validToken(111, 0.2) });
    expect(row.state).toBe("renting");
  });

  test("persistence failure after create destroys the just-rented instance (compensation)", async () => {
    const { repo, rows } = makeRepo();
    const { vast, calls } = makeVast();
    // First update (recording the real instance id) fails; later updates work.
    let failUpdates = 1;
    const flakyRepo: ManagedRepo = {
      ...repo,
      async update(id, patch) {
        if (patch.vast_instance_id !== undefined && failUpdates-- > 0) throw new Error("db down");
        return repo.update(id, patch);
      },
    };
    const lc = createVastLifecycle({ vast, repo: flakyRepo, now: () => NOW, confirmSecret: SECRET, appUrl: APP_URL });
    await expect(lc.provision({ ...baseProvision, confirmToken: validToken(111, 0.2) })).rejects.toThrow(
      /it was destroyed/,
    );
    expect(calls.destroy).toEqual([[9001]]); // compensating destroy fired
    expect(rows[0].state).toBe("failed");
  });

  test("crash between create and id update: expiry cron reconciles the orphan by label", async () => {
    const { repo, rows } = makeRepo();
    const { vast } = makeVast();
    // Simulate the crash: reservation row exists with placeholder id, deadline passed.
    const reservation = await repo.insert({
      vast_instance_id: -12345,
      label: "pending",
      gpu_name: null,
      hourly_usd: 0.2,
      adopted: false,
      endpoint_url: null,
      worker_id: null,
      state: "renting",
      failure_reason: null,
      created_by: "user-1",
      destroy_deadline: new Date(NOW.getTime() - 1000).toISOString(),
      destroyed_at: null,
    });
    const orphan = fakeInstance({ id: 777, label: `aurora-${reservation.id}` });
    const destroyed: number[] = [];
    const lc = createVastLifecycle({
      vast: {
        ...vast,
        listInstances: async () => [orphan],
        destroyInstance: async (id) => {
          destroyed.push(id);
        },
      },
      repo,
      now: () => NOW,
      confirmSecret: SECRET,
      appUrl: APP_URL,
    });
    await lc.expireOverdue();
    expect(destroyed).toEqual([777]); // orphaned rental found by label and destroyed
    expect(rows[0].state).toBe("expired");
  });

  test("refuses a second concurrent rental (retry-safe, no stacking)", async () => {
    const { repo } = makeRepo();
    const { vast } = makeVast();
    const lc = createVastLifecycle({ vast, repo, now: () => NOW, confirmSecret: SECRET, appUrl: APP_URL });
    await lc.provision({ ...baseProvision, confirmToken: validToken(111, 0.2) });
    await expect(
      lc.provision({ ...baseProvision, offerId: 222, confirmToken: validToken(222, 0.2) }),
    ).rejects.toThrow(/already active/);
  });
});

describe("adopt", () => {
  test("adopting is idempotent — re-adopt returns the existing row", async () => {
    const { repo } = makeRepo();
    const { vast } = makeVast();
    const lc = createVastLifecycle({ vast, repo, now: () => NOW, confirmSecret: SECRET, appUrl: APP_URL });
    const a = await lc.adopt(9001, "user-1");
    const b = await lc.adopt(9001, "user-1");
    expect(b.id).toBe(a.id);
    expect(a.adopted).toBe(true);
    expect(a.endpoint_url).toBe("http://1.2.3.4:40123");
  });

  test("refuses instances the Vast account does not own", async () => {
    const { vast } = makeVast({ getInstance: async () => null });
    const lc = makeService({ vast });
    await expect(lc.adopt(4242, "user-1")).rejects.toThrow(/not found on your account/);
  });
});

describe("stop/destroy ownership scope", () => {
  test("refuses to touch instances Aurora does not manage", async () => {
    const lc = makeService();
    await expect(lc.destroy("31337")).rejects.toThrow(/not managed by Aurora/);
    await expect(lc.stop("31337")).rejects.toThrow(/not managed by Aurora/);
  });

  test("destroy is idempotent — second call is a no-op", async () => {
    const { repo } = makeRepo();
    const { vast, calls } = makeVast();
    const lc = createVastLifecycle({ vast, repo, now: () => NOW, confirmSecret: SECRET, appUrl: APP_URL });
    await lc.provision({ ...baseProvision, confirmToken: validToken(111, 0.2) });
    await lc.destroy("9001");
    await lc.destroy("9001");
    expect(calls.destroy.length).toBe(1);
    expect((await repo.getByVastId(9001))?.state).toBe("destroyed");
  });
});

describe("expiry cleanup", () => {
  test("destroys only instances past their deadline; failures stay active for retry", async () => {
    const mk = (vastId: number, deadlineOffsetMs: number): ManagedInstanceRow => ({
      id: `r-${vastId}`,
      vast_instance_id: vastId,
      label: "t",
      gpu_name: null,
      hourly_usd: 0.2,
      adopted: false,
      endpoint_url: null,
      worker_id: null,
      state: "running",
      failure_reason: null,
      created_by: "user-1",
      created_at: NOW.toISOString(),
      destroy_deadline: new Date(NOW.getTime() + deadlineOffsetMs).toISOString(),
      destroyed_at: null,
    });
    const { repo, rows } = makeRepo([mk(1, -1000), mk(2, +60_000), mk(3, -5000)]);
    const { vast } = makeVast({
      destroyInstance: async (id) => {
        if (id === 3) throw new Error("vast 500");
      },
    });
    const lc = createVastLifecycle({ vast, repo, now: () => NOW, confirmSecret: SECRET, appUrl: APP_URL });
    const result = await lc.expireOverdue();
    expect(result.expired).toEqual([1]);
    expect(result.failed).toEqual([{ vastId: 3, error: "vast 500" }]);
    expect(rows.find((r) => r.vast_instance_id === 1)?.state).toBe("expired");
    expect(rows.find((r) => r.vast_instance_id === 2)?.state).toBe("running"); // untouched
    expect(rows.find((r) => r.vast_instance_id === 3)?.state).toBe("running"); // retried next sweep

    // Retry succeeds once Vast recovers — idempotent second sweep.
    const { vast: goodVast } = makeVast();
    const lc2 = createVastLifecycle({ vast: goodVast, repo, now: () => NOW, confirmSecret: SECRET, appUrl: APP_URL });
    const second = await lc2.expireOverdue();
    expect(second.expired).toEqual([3]);
    expect(second.failed).toEqual([]);
  });
});

describe("endpoint derivation", () => {
  test("maps container port 8000 to the public host:port", () => {
    expect(endpointFromInstance(fakeInstance())).toBe("http://1.2.3.4:40123");
    expect(endpointFromInstance(fakeInstance({ ports: null }))).toBeNull();
    expect(
      endpointFromInstance(fakeInstance({ ports: { "8000/tcp": [{ HostIp: "0.0.0.0", HostPort: "40123" }] } })),
    ).toBe("http://1.2.3.4:40123"); // falls back to public_ipaddr
  });
});

describe("constants", () => {
  test("guardrail constants match the approved policy", () => {
    expect(VAST_MAX_HOURLY_USD).toBe(0.35);
    expect(VAST_MAX_RUNTIME_MS).toBe(3_600_000);
  });
});
