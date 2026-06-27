import { describe, expect, it } from "bun:test";
import { reserveOrchestrateRecord, type RenderDeps } from "./generate-core.server";

type RpcCall = { name: string; args: Record<string, unknown> };

function makeDeps(overrides: {
  reserveResult?: { data: unknown; error: { message: string } | null };
  commitError?: { message: string } | null;
  releaseError?: { message: string } | null;
  orchestrateImpl?: RenderDeps["orchestrate"];
  insertImpl?: RenderDeps["insertGeneration"];
}) {
  const calls: RpcCall[] = [];
  const deps: RenderDeps = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "reserve_credits") return overrides.reserveResult ?? { data: true, error: null };
      if (name === "commit_reservation") return { data: null, error: overrides.commitError ?? null };
      if (name === "release_reservation") return { data: null, error: overrides.releaseError ?? null };
      return { data: null, error: null };
    },
    orchestrate:
      overrides.orchestrateImpl ??
      (async () => ({
        url: "https://cdn.example/out.png",
        provider: "replicate",
        endpoint: "flux",
        latencyMs: 100,
        costUsd: 0.01,
      })),
    insertGeneration: overrides.insertImpl ?? (async () => ({ id: "gen_1" })),
  };
  return { deps, calls };
}

const baseInput = {
  userId: "user_1",
  kind: "image" as const,
  cost: 1,
  reason: "agent_shot_render",
  prompt: "a cat",
};

describe("reserveOrchestrateRecord credit flow", () => {
  it("reserves, renders, records, and commits on the happy path (no release)", async () => {
    const { deps, calls } = makeDeps({});
    const outcome = await reserveOrchestrateRecord(baseInput, deps);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.generationId).toBe("gen_1");
      expect(outcome.url).toBe("https://cdn.example/out.png");
    }
    expect(calls.map((c) => c.name)).toEqual(["reserve_credits", "commit_reservation"]);
  });

  it("returns insufficient (402-style) without orchestrating, committing, or releasing", async () => {
    const { deps, calls } = makeDeps({ reserveResult: { data: false, error: null } });
    let orchestrated = false;
    deps.orchestrate = (async () => {
      orchestrated = true;
      throw new Error("should not run");
    }) as RenderDeps["orchestrate"];

    const outcome = await reserveOrchestrateRecord(baseInput, deps);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.insufficient).toBe(true);
    expect(orchestrated).toBe(false);
    expect(calls.map((c) => c.name)).toEqual(["reserve_credits"]);
  });

  it("throws when reserve_credits itself errors, never holding a reservation", async () => {
    const { deps, calls } = makeDeps({ reserveResult: { data: null, error: { message: "db down" } } });
    await expect(reserveOrchestrateRecord(baseInput, deps)).rejects.toThrow("db down");
    expect(calls.map((c) => c.name)).toEqual(["reserve_credits"]);
  });

  it("releases the reservation when orchestrate fails, then rethrows", async () => {
    const { deps, calls } = makeDeps({
      orchestrateImpl: (async () => {
        throw new Error("No provider can serve image");
      }) as RenderDeps["orchestrate"],
    });
    await expect(reserveOrchestrateRecord(baseInput, deps)).rejects.toThrow("No provider can serve image");
    expect(calls.map((c) => c.name)).toEqual(["reserve_credits", "release_reservation"]);
  });

  it("releases the reservation when the generations insert fails", async () => {
    const { deps, calls } = makeDeps({
      insertImpl: async () => {
        throw new Error("insert failed");
      },
    });
    await expect(reserveOrchestrateRecord(baseInput, deps)).rejects.toThrow("insert failed");
    expect(calls.map((c) => c.name)).toEqual(["reserve_credits", "release_reservation"]);
  });

  it("surfaces a commit failure WITHOUT releasing (a delivered render must not be refunded)", async () => {
    const { deps, calls } = makeDeps({ commitError: { message: "commit boom" } });
    await expect(reserveOrchestrateRecord(baseInput, deps)).rejects.toThrow(/credit commit failed/);
    expect(calls.map((c) => c.name)).toEqual(["reserve_credits", "commit_reservation"]);
    expect(calls.some((c) => c.name === "release_reservation")).toBe(false);
  });

  it("surfaces BOTH the original error and a release failure (credit leak must not be swallowed)", async () => {
    const { deps } = makeDeps({
      orchestrateImpl: (async () => {
        throw new Error("orchestrate boom");
      }) as RenderDeps["orchestrate"],
      releaseError: { message: "release boom" },
    });
    await expect(reserveOrchestrateRecord(baseInput, deps)).rejects.toThrow(
      /orchestrate boom; additionally failed to release reservation .* release boom/,
    );
  });
});
