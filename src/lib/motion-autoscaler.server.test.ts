import { describe, expect, test } from "bun:test";
import {
  createMotionAutoscaler,
  MOTION_AUTOSCALER_ACTOR_ID,
  MOTION_AUTOSCALE_COOLDOWN_MS,
  MOTION_AUTOSCALE_IDLE_MS,
  type MotionAutoscaleRepo,
  type MotionAutoscaleState,
} from "./motion-autoscaler.server";
import type { ManagedInstanceRow, VastLifecycle } from "./vast-lifecycle.server";

const NOW = new Date("2026-09-08T10:00:00.000Z");
const baseState: MotionAutoscaleState = {
  enabled: true,
  cooldown_until: null,
  failure_count: 0,
  failure_reason: null,
  decision_lease_until: null,
  last_activity_at: null,
  last_decision_at: null,
  last_decision_action: null,
  last_decision_provider: null,
  last_decision_reason: null,
};

function managed(over: Partial<ManagedInstanceRow> = {}): ManagedInstanceRow {
  return {
    id: "managed-1",
    vast_instance_id: 123,
    label: "aurora-managed",
    gpu_name: "RTX 4090",
    hourly_usd: 0.25,
    adopted: false,
    endpoint_url: null,
    worker_id: null,
    state: "renting",
    failure_reason: null,
    created_by: MOTION_AUTOSCALER_ACTOR_ID,
    created_at: NOW.toISOString(),
    destroy_deadline: new Date(NOW.getTime() + 60 * 60_000).toISOString(),
    destroyed_at: null,
    ...over,
  };
}

function setup(over: Partial<{
  state: Partial<MotionAutoscaleState>;
  jobs: Array<{ status: string }>;
  workers: Array<Record<string, unknown>>;
  vastRows: ManagedInstanceRow[];
  claim: boolean;
  runpod: { endpointId?: string; apiKey?: string };
  probeOk: boolean;
  provisionFails: boolean;
  offers: Array<{ offer: { id: number; gpu_ram_gb: number; dph_total: number }; confirmToken: string }>;
}> = {}) {
  const state = { ...baseState, ...over.state };
  const calls = { claim: 0, search: 0, provision: 0, destroy: 0, provisionOfferIds: [] as number[] };
  const repo: MotionAutoscaleRepo = {
    async getState() { return state; },
    async patchState(patch) { Object.assign(state, patch); },
    async claimDecision() { calls.claim++; return over.claim ?? true; },
    async listMotionJobs() { return over.jobs ?? []; },
    async listMotionWorkers() { return over.workers ?? []; },
    async listManagedVast() { return over.vastRows ?? []; },
  };
  const lifecycle = {
    async search() {
      calls.search++;
      return over.offers ?? [{ offer: { id: 8, gpu_ram_gb: 24, dph_total: 0.2 }, confirmToken: "token" }];
    },
    async provision(input: { offerId: number }) {
      calls.provision++;
      calls.provisionOfferIds.push(input.offerId);
      if (over.provisionFails) throw new Error("Vast upstream request body should never surface");
      return managed();
    },
    async destroy() { calls.destroy++; return managed({ state: "destroyed" }); },
  } as unknown as VastLifecycle;
  const autoscaler = createMotionAutoscaler({
    repo,
    lifecycle,
    now: () => NOW,
    runpod: over.runpod,
    probe: async () => ({ ok: over.probeOk ?? true }),
    log: () => {},
  });
  return { autoscaler, state, calls };
}

describe("motion autoscaler", () => {
  test("does nothing while the explicit policy is disabled", async () => {
    const { autoscaler, calls } = setup({ state: { enabled: false }, jobs: [{ status: "queued" }] });
    const result = await autoscaler.reconcile();
    expect(result.enabled).toBe(false);
    expect(calls.search).toBe(0);
    expect(calls.provision).toBe(0);
  });

  test("does not provision without motion work", async () => {
    const { autoscaler, calls } = setup();
    const result = await autoscaler.reconcile();
    expect(result.backlog).toEqual({ queued: 0, processing: 0 });
    expect(calls.search).toBe(0);
    expect(calls.provision).toBe(0);
  });

  test("uses any healthy active motion capacity before a new rental", async () => {
    const { autoscaler, calls } = setup({
      jobs: [{ status: "queued" }],
      workers: [{
        id: "self-hosted-motion", name: "existing motion", endpoint_url: "https://worker.example",
        auth_token: null, protocol: "vast", capabilities: ["motion"], status: "active",
        in_flight: 0, max_concurrency: 2, last_heartbeat: NOW.toISOString(),
      }],
    });
    await autoscaler.reconcile();
    expect(calls.provision).toBe(0);
  });

  test("uses a healthy registered RunPod worker before considering a Vast rental", async () => {
    const { autoscaler, calls } = setup({
      jobs: [{ status: "queued" }],
      runpod: { endpointId: "endpoint_123", apiKey: "test-key" },
      workers: [{
        id: "runpod-1", name: "runpod-motion", endpoint_url: "https://api.runpod.ai/v2/endpoint_123",
        auth_token: null, protocol: "runpod", capabilities: ["motion"], status: "active",
        in_flight: 0, max_concurrency: 1, last_heartbeat: NOW.toISOString(),
      }],
    });
    const result = await autoscaler.reconcile();
    expect(result.selectedProvider).toBe("runpod");
    expect(calls.provision).toBe(0);
  });

  test("does not stack Vast behind a healthy but occupied RunPod endpoint", async () => {
    const { autoscaler, calls } = setup({
      jobs: [{ status: "queued" }],
      runpod: { endpointId: "endpoint_123", apiKey: "test-key" },
      workers: [{
        id: "runpod-1", name: "runpod-motion", endpoint_url: "https://api.runpod.ai/v2/endpoint_123",
        auth_token: null, protocol: "runpod", capabilities: ["motion"], status: "active",
        in_flight: 1, max_concurrency: 1, last_heartbeat: NOW.toISOString(),
      }],
    });
    await autoscaler.reconcile();
    expect(calls.provision).toBe(0);
  });

  test("falls back only when RunPod is misregistered or unhealthy", async () => {
    const { autoscaler, calls } = setup({
      jobs: [{ status: "queued" }],
      runpod: { endpointId: "endpoint_123", apiKey: "test-key" },
      probeOk: false,
      workers: [{
        id: "wrong-runpod", name: "wrong endpoint", endpoint_url: "https://api.runpod.ai/v2/another_endpoint",
        auth_token: null, protocol: "runpod", capabilities: ["motion"], status: "active",
        in_flight: 1, max_concurrency: 1, last_heartbeat: NOW.toISOString(),
      }],
    });
    await autoscaler.reconcile();
    expect(calls.provision).toBe(1);
  });

  test("provisions exactly one 24GB managed Vast fallback under an atomic claim", async () => {
    const { autoscaler, calls } = setup({ jobs: [{ status: "queued" }] });
    await autoscaler.reconcile();
    expect(calls.claim).toBe(1);
    expect(calls.search).toBe(1);
    expect(calls.provision).toBe(1);
  });

  test("does not provision if another scheduler tick owns the atomic decision", async () => {
    const { autoscaler, calls } = setup({ jobs: [{ status: "queued" }], claim: false });
    await autoscaler.reconcile();
    expect(calls.claim).toBe(1);
    expect(calls.search).toBe(0);
    expect(calls.provision).toBe(0);
  });

  test("uses cooldown after a failed provisioning attempt", async () => {
    const { autoscaler, state } = setup({ jobs: [{ status: "queued" }], provisionFails: true });
    await autoscaler.reconcile();
    expect(state.cooldown_until).toBe(new Date(NOW.getTime() + MOTION_AUTOSCALE_COOLDOWN_MS).toISOString());
    expect(state.failure_reason).toContain("Vast provisioning");
  });

  test("destroys only its own idle managed Vast worker", async () => {
    const { autoscaler, calls } = setup({
      vastRows: [managed({ created_at: new Date(NOW.getTime() - MOTION_AUTOSCALE_IDLE_MS - 1).toISOString() })],
    });
    await autoscaler.reconcile();
    expect(calls.destroy).toBe(1);
  });

  test("leaves a manually managed Vast instance alone", async () => {
    const { autoscaler, calls } = setup({
      vastRows: [managed({
        created_by: "11111111-1111-1111-1111-111111111111",
        created_at: new Date(NOW.getTime() - MOTION_AUTOSCALE_IDLE_MS - 1).toISOString(),
      })],
    });
    await autoscaler.reconcile();
    expect(calls.destroy).toBe(0);
  });

  test("tears down an autoscaled worker that misses the readiness deadline", async () => {
    const { autoscaler, calls } = setup({
      jobs: [{ status: "queued" }],
      vastRows: [managed({ created_at: new Date(NOW.getTime() - 13 * 60_000).toISOString() })],
    });
    await autoscaler.reconcile();
    expect(calls.destroy).toBe(1);
  });

  test("always tears down its own worker after the absolute deadline, even with a backlog", async () => {
    const { autoscaler, calls } = setup({
      jobs: [{ status: "queued" }],
      vastRows: [managed({ destroy_deadline: new Date(NOW.getTime() - 1).toISOString() })],
    });
    await autoscaler.reconcile();
    expect(calls.destroy).toBe(1);
  });

  test("filters underpowered and over-budget offers before lifecycle revalidation", async () => {
    const { autoscaler, calls } = setup({
      jobs: [{ status: "queued" }],
      offers: [
        { offer: { id: 1, gpu_ram_gb: 16, dph_total: 0.05 }, confirmToken: "small" },
        { offer: { id: 2, gpu_ram_gb: 24, dph_total: 0.36 }, confirmToken: "expensive" },
        { offer: { id: 3, gpu_ram_gb: 24, dph_total: 0.25 }, confirmToken: "eligible" },
      ],
    });
    await autoscaler.reconcile();
    expect(calls.provisionOfferIds).toEqual([3]);
  });
});