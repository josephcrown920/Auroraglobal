import { describe, expect, it } from "bun:test";
import { chargeMarketplaceRunCore, type MarketplaceChargeDeps } from "./marketplace.functions";

// chargeMarketplaceRunCore is the injectable core of chargeMarketplaceTemplateRun
// (extracted in task #214). It uses dependency-injected rpc/getTemplate/updateRunCount
// so these tests need no mock.module calls and carry no leakage risk.
//
// The key invariant being proved is the atomic-finalize contract:
//   SUCCESS  → reserve_credits + finalize_marketplace_run (run row + commit +
//               creator grant all in one Postgres tx) + updateRunCount
//   FINALIZE FAILS → finalize_marketplace_run returned error (Postgres rolled back
//               — nothing written or committed) → release_reservation called so
//               user gets credits back
//   INSUFFICIENT → reserve_credits only, ok:false returned immediately
//   TEMPLATE NOT FOUND → throws before any credit call

type RpcCall = { name: string; args: Record<string, unknown> };

const TEMPLATE_ID = "tmpl-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const RUNNER_ID = "runner-user-1";
const CREATOR_ID = "creator-user-2";

const defaultTemplate = {
  id: TEMPLATE_ID,
  creator_user_id: CREATOR_ID,
  run_cost_aura: 10,
  cut_pct: 30,
  run_count: 42,
};

function makeDeps(overrides: {
  template?: typeof defaultTemplate | null;
  reserveResult?: boolean;
  reserveError?: { message: string } | null;
  finalizeError?: { message: string } | null;
  releaseError?: { message: string } | null;
  onUpdateRunCount?: (id: string, newCount: number) => void;
}): { deps: MarketplaceChargeDeps; calls: RpcCall[]; runCountUpdates: Array<{ id: string; n: number }> } {
  const calls: RpcCall[] = [];
  const runCountUpdates: Array<{ id: string; n: number }> = [];

  const deps: MarketplaceChargeDeps = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "reserve_credits") {
        if (overrides.reserveError) return { data: null, error: overrides.reserveError };
        return { data: overrides.reserveResult !== false ? true : false, error: null };
      }
      if (name === "finalize_marketplace_run") {
        if (overrides.finalizeError) return { data: null, error: overrides.finalizeError };
        return { data: null, error: null };
      }
      if (name === "release_reservation") {
        if (overrides.releaseError) return { data: null, error: overrides.releaseError };
        return { data: null, error: null };
      }
      return { data: null, error: null };
    },
    getTemplate: async (id) => {
      if ("template" in overrides) return overrides.template ?? null;
      return id === TEMPLATE_ID ? defaultTemplate : null;
    },
    updateRunCount: async (id, newCount) => {
      runCountUpdates.push({ id, n: newCount });
      overrides.onUpdateRunCount?.(id, newCount);
    },
  };

  return { deps, calls, runCountUpdates };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("chargeMarketplaceRunCore", () => {
  it("happy path: returns ok:true after reserve + finalize (atomic) + run-count bump", async () => {
    const { deps, calls, runCountUpdates } = makeDeps({});
    const result = await chargeMarketplaceRunCore(TEMPLATE_ID, RUNNER_ID, deps);

    expect(result).toEqual({ ok: true });

    // Exact RPC sequence: reserve then finalize (single atomic call).
    const rpcNames = calls.map((c) => c.name);
    expect(rpcNames).toEqual(["reserve_credits", "finalize_marketplace_run"]);

    // No separate commit or release.
    expect(calls.find((c) => c.name === "commit_reservation")).toBeUndefined();
    expect(calls.find((c) => c.name === "release_reservation")).toBeUndefined();

    // Run count bumped by 1.
    expect(runCountUpdates).toEqual([{ id: TEMPLATE_ID, n: 43 }]);
  });

  it("happy path: finalize_marketplace_run receives correct credit split and refs", async () => {
    const { deps, calls } = makeDeps({});
    await chargeMarketplaceRunCore(TEMPLATE_ID, RUNNER_ID, deps);

    const finalize = calls.find((c) => c.name === "finalize_marketplace_run");
    expect(finalize).toBeDefined();
    expect(finalize?.args._runner_user_id).toBe(RUNNER_ID);
    expect(finalize?.args._creator_user_id).toBe(CREATOR_ID);
    expect(finalize?.args._template_id).toBe(TEMPLATE_ID);
    expect(finalize?.args._aura_charged).toBe(10);
    // 30% of 10 = 3 creator cut; 7 platform cut
    expect(finalize?.args._creator_cut_aura).toBe(3);
    expect(finalize?.args._platform_cut_aura).toBe(7);
    expect(finalize?.args._amount).toBe(10);
    expect(typeof finalize?.args._ref).toBe("string");
    expect(typeof finalize?.args._creator_ref).toBe("string");
    // _ref (reservation ref) and _creator_ref must be different UUIDs
    expect(finalize?.args._ref).not.toBe(finalize?.args._creator_ref);
  });

  it("happy path: reserve_credits receives the exact cost from the template", async () => {
    const { deps, calls } = makeDeps({});
    await chargeMarketplaceRunCore(TEMPLATE_ID, RUNNER_ID, deps);

    const reserve = calls.find((c) => c.name === "reserve_credits");
    expect(reserve?.args._user).toBe(RUNNER_ID);
    expect(reserve?.args._amount).toBe(10);
  });

  it("template not found: throws before any RPC call", async () => {
    const { deps, calls } = makeDeps({ template: null });
    await expect(chargeMarketplaceRunCore(TEMPLATE_ID, RUNNER_ID, deps)).rejects.toThrow(
      "Template not found or not approved",
    );
    expect(calls).toHaveLength(0);
  });

  it("insufficient credits: returns ok:false with insufficient flag, no finalize or release", async () => {
    const { deps, calls } = makeDeps({ reserveResult: false });
    const result = await chargeMarketplaceRunCore(TEMPLATE_ID, RUNNER_ID, deps);

    expect(result).toMatchObject({ ok: false, insufficient: true });
    expect(calls.find((c) => c.name === "finalize_marketplace_run")).toBeUndefined();
    expect(calls.find((c) => c.name === "release_reservation")).toBeUndefined();
  });

  it("reserve_credits RPC error: throws without holding a reservation or calling finalize", async () => {
    const { deps, calls } = makeDeps({ reserveError: { message: "db timeout" } });
    await expect(chargeMarketplaceRunCore(TEMPLATE_ID, RUNNER_ID, deps)).rejects.toThrow(
      "db timeout",
    );
    expect(calls.find((c) => c.name === "finalize_marketplace_run")).toBeUndefined();
    expect(calls.find((c) => c.name === "release_reservation")).toBeUndefined();
  });

  it("finalize_marketplace_run failure: releases reservation (Postgres rolled back — run NOT written, credit NOT committed)", async () => {
    // Task #214 core invariant:
    // When finalize_marketplace_run returns an error, the Postgres transaction
    // aborted. The run record was NOT inserted, the buyer's reservation was NOT
    // committed, and the creator's grant was NOT made. Releasing the reservation
    // here is safe and correct — the user gets their credits back.
    const { deps, calls } = makeDeps({
      finalizeError: { message: "deadlock detected" },
    });
    await expect(chargeMarketplaceRunCore(TEMPLATE_ID, RUNNER_ID, deps)).rejects.toThrow(
      "Marketplace run finalization failed: deadlock detected",
    );

    // Finalize was attempted.
    expect(calls.find((c) => c.name === "finalize_marketplace_run")).toBeDefined();

    // Release fires — Postgres rolled back, no partial state.
    const release = calls.find((c) => c.name === "release_reservation");
    expect(release).toBeDefined();
    expect(release?.args._user).toBe(RUNNER_ID);
    expect(release?.args._amount).toBe(10);

    // No separate commit_reservation call (old pattern gone).
    expect(calls.find((c) => c.name === "commit_reservation")).toBeUndefined();
  });

  it("finalize failure: run-count update is NOT called (charge did not complete)", async () => {
    const { deps, runCountUpdates } = makeDeps({
      finalizeError: { message: "tx rolled back" },
    });
    await expect(chargeMarketplaceRunCore(TEMPLATE_ID, RUNNER_ID, deps)).rejects.toThrow();
    expect(runCountUpdates).toHaveLength(0);
  });

  it("run-count update failure does NOT surface as an error (display counter is best-effort)", async () => {
    const { deps } = makeDeps({
      onUpdateRunCount: () => {
        throw new Error("counter update failed");
      },
    });
    // The charge already committed inside finalize_marketplace_run.
    // A best-effort counter failure must not bubble up.
    const result = await chargeMarketplaceRunCore(TEMPLATE_ID, RUNNER_ID, deps);
    expect(result).toEqual({ ok: true });
  });

  it("creator cut rounds correctly for fractional splits", async () => {
    const { deps, calls } = makeDeps({
      template: {
        ...defaultTemplate,
        run_cost_aura: 7,
        cut_pct: 33, // 33% of 7 = 2.31 → rounds to 2; platform gets 5
      },
    });
    await chargeMarketplaceRunCore(TEMPLATE_ID, RUNNER_ID, deps);

    const finalize = calls.find((c) => c.name === "finalize_marketplace_run");
    expect(finalize?.args._creator_cut_aura).toBe(2);
    expect(finalize?.args._platform_cut_aura).toBe(5);
    // Must sum to exact cost — no credit leakage or double-spend.
    const creator = finalize?.args._creator_cut_aura as number;
    const platform = finalize?.args._platform_cut_aura as number;
    expect(creator + platform).toBe(7);
  });
});
