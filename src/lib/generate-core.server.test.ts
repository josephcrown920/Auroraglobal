import { describe, expect, it } from "bun:test";
import { reserveOrchestrateRecord, type RenderDeps } from "./generate-core.server";

// ── Test helpers ──────────────────────────────────────────────────────────────
//
// Task #214: generate-core now calls finalize_sync_render (one atomic Postgres
// transaction that folds the generations INSERT + commit_reservation together)
// instead of calling insertGeneration + commit_reservation as two separate steps.
//
// The new credit-flow invariants are:
//   SUCCESS  → reserve_credits + finalize_sync_render  (atomic commit inside the RPC)
//   FAILURE  → reserve_credits + release_reservation   (if finalize_sync_render
//               returned an error the Postgres tx rolled back — safe to release)
//   INSUFFICIENT → reserve_credits only, ok:false returned immediately
//
// There is no longer a scenario where a generation row exists but the credit
// commit has not happened, because both writes are in one transaction.

type RpcCall = { name: string; args: Record<string, unknown> };

/**
 * Build injectable RenderDeps whose RPC log and behaviour are controllable per-test.
 *
 * Returns:
 *   deps  — the RenderDeps to pass to reserveOrchestrateRecord
 *   calls — RPC calls recorded in order
 */
function makeDeps(overrides: {
  reserveResult?: { data: unknown; error: { message: string } | null };
  finalizeResult?: { data: unknown; error: { message: string } | null };
  releaseError?: { message: string } | null;
  orchestrateImpl?: RenderDeps["orchestrate"];
}) {
  const calls: RpcCall[] = [];

  const deps: RenderDeps = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "reserve_credits")
        return overrides.reserveResult ?? { data: true, error: null };
      if (name === "finalize_sync_render")
        return overrides.finalizeResult ?? { data: "gen_1", error: null };
      if (name === "release_reservation")
        return { data: null, error: overrides.releaseError ?? null };
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
    persistUrl: async ({ url }) => ({
      url,
      persisted: false,
      compressed: false,
    }),
  };

  return { deps, calls };
}

// ── Base inputs ───────────────────────────────────────────────────────────────

const baseInput = {
  userId: "user_1",
  kind: "image" as const,
  cost: 1,
  reason: "agent_shot_render",
  prompt: "a cat",
};

// Premium video: Seedance 2.0 fast (budget tier, cheapest paid video model)
const baseVideoInput = {
  userId: "user_1",
  kind: "video" as const,
  cost: 10,
  reason: "premium_video_render",
  prompt: "cinematic zoom into a cityscape",
  model: "seedance-2.0-fast",
};

// Premium lipsync: fal-ai/sync-lipsync/v2 (premium tier, the real default)
const baseLipsyncInput = {
  userId: "user_1",
  kind: "lipsync" as const,
  cost: 20,
  reason: "lipsync_render",
  prompt: "speaking directly to camera",
  model: "fal-ai/sync-lipsync/v2",
  audioUrl: "https://storage.example/speech.mp3",
  videoUrl: "https://storage.example/avatar.mp4",
};

// ─────────────────────────────────────────────────────────────────────────────
// Core credit-flow tests
// ─────────────────────────────────────────────────────────────────────────────

describe("reserveOrchestrateRecord credit flow", () => {
  it("reserves then calls finalize_sync_render atomically on the happy path — no separate commit or release", async () => {
    const { deps, calls } = makeDeps({});
    const outcome = await reserveOrchestrateRecord(baseInput, deps);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.generationId).toBe("gen_1");
      expect(outcome.url).toBe("https://cdn.example/out.png");
    }
    // Only two RPC calls in the success path — reserve + finalize (atomic).
    // No separate commit_reservation and no release_reservation.
    const rpcNames = calls.map((c) => c.name);
    expect(rpcNames).toEqual(["reserve_credits", "finalize_sync_render"]);
  });

  it("returns insufficient (402-style) without orchestrating, calling finalize, or releasing", async () => {
    const { deps, calls } = makeDeps({
      reserveResult: { data: false, error: null },
    });
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
    const { deps, calls } = makeDeps({
      reserveResult: { data: null, error: { message: "db down" } },
    });
    await expect(
      reserveOrchestrateRecord(baseInput, deps),
    ).rejects.toThrow("db down");
    expect(calls.map((c) => c.name)).toEqual(["reserve_credits"]);
  });

  it("releases the reservation when orchestrate fails, never calling finalize_sync_render", async () => {
    const { deps, calls } = makeDeps({
      orchestrateImpl: (async () => {
        throw new Error("No provider can serve image");
      }) as RenderDeps["orchestrate"],
    });
    await expect(
      reserveOrchestrateRecord(baseInput, deps),
    ).rejects.toThrow("No provider can serve image");
    // finalize_sync_render must NOT be called — orchestrate failed before we got a result.
    expect(calls.find((c) => c.name === "finalize_sync_render")).toBeUndefined();
    expect(calls.map((c) => c.name)).toEqual([
      "reserve_credits",
      "release_reservation",
    ]);
  });

  it("releases the reservation when finalize_sync_render returns an error (Postgres rolled back — safe to release)", async () => {
    // Task #214 crash-window fix:
    // The old pattern (insertGeneration then commit_reservation) had a crash
    // window: if the process died between them, the generation row existed with
    // status=succeeded but credits_reserved was never committed — stranded.
    //
    // With finalize_sync_render, both the INSERT and the commit happen in one
    // Postgres transaction. An error response from the RPC means the transaction
    // aborted — the generation row was NOT written and the reservation was NOT
    // committed. It is therefore safe (and correct) to release the reservation
    // in the catch block so the user gets their credits back.
    const { deps, calls } = makeDeps({
      finalizeResult: { data: null, error: { message: "connection reset by peer" } },
    });
    await expect(
      reserveOrchestrateRecord(baseInput, deps),
    ).rejects.toThrow("Failed to record render result and commit credits");

    // Release must fire — the Postgres tx rolled back, no generation was written.
    const release = calls.find((c) => c.name === "release_reservation");
    expect(release).toBeDefined();
    expect(release?.args._amount).toBe(1);
    // No separate commit_reservation — the old two-step pattern is gone.
    expect(calls.find((c) => c.name === "commit_reservation")).toBeUndefined();
  });

  it("surfaces BOTH the original error and a release failure (credit leak must not be swallowed)", async () => {
    const { deps } = makeDeps({
      orchestrateImpl: (async () => {
        throw new Error("orchestrate boom");
      }) as RenderDeps["orchestrate"],
      releaseError: { message: "release boom" },
    });
    await expect(
      reserveOrchestrateRecord(baseInput, deps),
    ).rejects.toThrow(
      /orchestrate boom; additionally failed to release reservation .* release boom/,
    );
  });

  it("never calls finalize_sync_render more than once on any path (no double-finalize)", async () => {
    const { deps, calls } = makeDeps({
      finalizeResult: { data: null, error: { message: "boom" } },
    });
    await expect(reserveOrchestrateRecord(baseInput, deps)).rejects.toThrow();
    expect(calls.filter((c) => c.name === "finalize_sync_render")).toHaveLength(1);
  });

  it("passes session_id and agent_shot_id through to finalize_sync_render", async () => {
    const { deps, calls } = makeDeps({});
    await reserveOrchestrateRecord(
      { ...baseInput, sessionId: "sess-abc", agentShotId: "shot-7" },
      deps,
    );
    const finalize = calls.find((c) => c.name === "finalize_sync_render");
    expect(finalize?.args._session_id).toBe("sess-abc");
    expect(finalize?.args._agent_shot_id).toBe("shot-7");
  });

  it("passes null session_id and agent_shot_id when not provided", async () => {
    const { deps, calls } = makeDeps({});
    await reserveOrchestrateRecord(baseInput, deps);
    const finalize = calls.find((c) => c.name === "finalize_sync_render");
    expect(finalize?.args._session_id).toBeNull();
    expect(finalize?.args._agent_shot_id).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Premium video/lipsync — atomic finalize + no-double-refund guarantee
//
// For expensive renders (video ~$0.05–$0.65/s, lipsync ~$0.30/clip) the
// credit contract with the atomic finalize_sync_render is:
//   SUCCESS  → reserve_credits + finalize_sync_render  (commit inside the RPC)
//   FAILURE  → reserve_credits + release_reservation   (finalize_sync_render
//               aborted its Postgres tx — safe to release, nothing was committed)
//   INSUFFICIENT → reserve_credits only, ok:false
//
// There is no "render delivered, commit failed, can't release" scenario any
// more — the commit is inside finalize_sync_render and either the whole
// transaction succeeds or it fully rolls back.
// ─────────────────────────────────────────────────────────────────────────────

describe("premium video/lipsync renders: atomic finalize + no-double-refund guarantee", () => {
  // ── kind: "video" ──────────────────────────────────────────────────────────

  it("video: happy path reserve + finalize EXACTLY ONCE — never releases", async () => {
    const { deps, calls } = makeDeps({
      orchestrateImpl: async () => ({
        url: "https://cdn.example/seedance-out.mp4",
        provider: "replicate",
        endpoint: "seedance-2.0-fast",
        latencyMs: 3200,
        costUsd: 0.05,
      }),
    });

    const outcome = await reserveOrchestrateRecord(baseVideoInput, deps);

    expect(outcome.ok).toBe(true);
    const rpcNames = calls.map((c) => c.name);
    expect(rpcNames).toEqual(["reserve_credits", "finalize_sync_render"]);
    expect(rpcNames.filter((n) => n === "release_reservation")).toHaveLength(0);
  });

  it("video: routes result_video_url in finalize_sync_render args (not result_image_url)", async () => {
    const VIDEO_URL = "https://cdn.example/seedance-out.mp4";
    const { deps, calls } = makeDeps({
      orchestrateImpl: async () => ({
        url: VIDEO_URL,
        provider: "replicate",
        endpoint: "seedance-2.0-fast",
        latencyMs: 3200,
        costUsd: 0.05,
      }),
    });

    await reserveOrchestrateRecord(baseVideoInput, deps);

    const finalize = calls.find((c) => c.name === "finalize_sync_render");
    expect(finalize?.args._result_video_url).toBe(VIDEO_URL);
    expect(finalize?.args._result_image_url).toBeNull();
    expect(finalize?.args._kind).toBe("video");
  });

  it("video: releases EXACTLY ONCE on provider failure — no double-refund, finalize never called", async () => {
    const { deps, calls } = makeDeps({
      orchestrateImpl: (async () => {
        throw new Error("Replicate: prediction failed — safety filter");
      }) as RenderDeps["orchestrate"],
    });

    await expect(
      reserveOrchestrateRecord(baseVideoInput, deps),
    ).rejects.toThrow();

    const rpcNames = calls.map((c) => c.name);
    expect(rpcNames.filter((n) => n === "release_reservation")).toHaveLength(1);
    expect(rpcNames.filter((n) => n === "finalize_sync_render")).toHaveLength(0);
  });

  it("video: finalize_sync_render failure releases reservation (Postgres rolled back — safe to release)", async () => {
    // Unlike the old two-step commit, when finalize_sync_render returns an error
    // the video was NOT written to generations AND the credit was NOT committed.
    // Releasing is correct — the user gets their credits back.
    const { deps, calls } = makeDeps({
      orchestrateImpl: async () => ({
        url: "https://cdn.example/seedance-out.mp4",
        provider: "replicate",
        endpoint: "seedance-2.0-fast",
        latencyMs: 3200,
        costUsd: 0.05,
      }),
      finalizeResult: { data: null, error: { message: "pg: connection reset by peer" } },
    });

    await expect(
      reserveOrchestrateRecord(baseVideoInput, deps),
    ).rejects.toThrow("Failed to record render result and commit credits");

    const rpcNames = calls.map((c) => c.name);
    expect(rpcNames.filter((n) => n === "finalize_sync_render")).toHaveLength(1);
    // Release fires — Postgres transaction rolled back, nothing was committed.
    expect(rpcNames.filter((n) => n === "release_reservation")).toHaveLength(1);
  });

  it("video: reserve_credits and finalize_sync_render both receive the exact cost amount", async () => {
    const { deps, calls } = makeDeps({
      orchestrateImpl: async () => ({
        url: "u",
        provider: "replicate",
        endpoint: "seedance-2.0-fast",
        latencyMs: 1,
        costUsd: 0,
      }),
    });

    await reserveOrchestrateRecord(baseVideoInput, deps);

    const reserve = calls.find((c) => c.name === "reserve_credits");
    expect(reserve?.args._amount).toBe(baseVideoInput.cost);
    const finalize = calls.find((c) => c.name === "finalize_sync_render");
    expect(finalize?.args._amount).toBe(baseVideoInput.cost);
  });

  // ── kind: "lipsync" ────────────────────────────────────────────────────────

  it("lipsync: happy path reserve + finalize EXACTLY ONCE — never releases", async () => {
    const { deps, calls } = makeDeps({
      orchestrateImpl: async () => ({
        url: "https://cdn.example/lipsync-out.mp4",
        provider: "fal",
        endpoint: "fal-ai/sync-lipsync/v2",
        latencyMs: 8200,
        costUsd: 0.30,
      }),
    });

    const outcome = await reserveOrchestrateRecord(baseLipsyncInput, deps);

    expect(outcome.ok).toBe(true);
    const rpcNames = calls.map((c) => c.name);
    expect(rpcNames).toEqual(["reserve_credits", "finalize_sync_render"]);
    expect(rpcNames.filter((n) => n === "release_reservation")).toHaveLength(0);
  });

  it("lipsync: routes result_video_url and audio_url correctly in finalize_sync_render", async () => {
    const LIPSYNC_URL = "https://cdn.example/lipsync-out.mp4";
    const { deps, calls } = makeDeps({
      orchestrateImpl: async () => ({
        url: LIPSYNC_URL,
        provider: "fal",
        endpoint: "fal-ai/sync-lipsync/v2",
        latencyMs: 8200,
        costUsd: 0.30,
      }),
    });

    await reserveOrchestrateRecord(baseLipsyncInput, deps);

    const finalize = calls.find((c) => c.name === "finalize_sync_render");
    expect(finalize?.args._result_video_url).toBe(LIPSYNC_URL);
    expect(finalize?.args._result_image_url).toBeNull();
    expect(finalize?.args._kind).toBe("lipsync");
    // Driving audio is preserved as _audio_url, not collapsed into the result.
    expect(finalize?.args._audio_url).toBe(baseLipsyncInput.audioUrl);
  });

  it("lipsync: releases EXACTLY ONCE on provider failure — finalize never called", async () => {
    const { deps, calls } = makeDeps({
      orchestrateImpl: (async () => {
        throw new Error("fal: lipsync inference failed — out of memory");
      }) as RenderDeps["orchestrate"],
    });

    await expect(
      reserveOrchestrateRecord(baseLipsyncInput, deps),
    ).rejects.toThrow();

    const rpcNames = calls.map((c) => c.name);
    expect(rpcNames.filter((n) => n === "release_reservation")).toHaveLength(1);
    expect(rpcNames.filter((n) => n === "finalize_sync_render")).toHaveLength(0);
  });

  it("lipsync: finalize_sync_render failure releases reservation (Postgres rolled back — safe to release)", async () => {
    const { deps, calls } = makeDeps({
      orchestrateImpl: async () => ({
        url: "https://cdn.example/lipsync-out.mp4",
        provider: "fal",
        endpoint: "fal-ai/sync-lipsync/v2",
        latencyMs: 8200,
        costUsd: 0.30,
      }),
      finalizeResult: { data: null, error: { message: "network: connection reset" } },
    });

    await expect(
      reserveOrchestrateRecord(baseLipsyncInput, deps),
    ).rejects.toThrow("Failed to record render result and commit credits");

    const rpcNames = calls.map((c) => c.name);
    expect(rpcNames.filter((n) => n === "finalize_sync_render")).toHaveLength(1);
    expect(rpcNames.filter((n) => n === "release_reservation")).toHaveLength(1);
  });

  it("lipsync: reserve_credits and finalize_sync_render both receive the exact cost amount", async () => {
    const { deps, calls } = makeDeps({
      orchestrateImpl: async () => ({
        url: "u",
        provider: "fal",
        endpoint: "fal-ai/sync-lipsync/v2",
        latencyMs: 1,
        costUsd: 0,
      }),
    });

    await reserveOrchestrateRecord(baseLipsyncInput, deps);

    const reserve = calls.find((c) => c.name === "reserve_credits");
    expect(reserve?.args._amount).toBe(baseLipsyncInput.cost);
    const finalize = calls.find((c) => c.name === "finalize_sync_render");
    expect(finalize?.args._amount).toBe(baseLipsyncInput.cost);
  });

  // ── Cross-kind: insufficient-credits path ──────────────────────────────────

  it("video + lipsync: returns insufficient without orchestrating when balance is low", async () => {
    for (const input of [baseVideoInput, baseLipsyncInput]) {
      let reached = false;
      const { deps, calls } = makeDeps({
        reserveResult: { data: false, error: null },
        orchestrateImpl: (async () => {
          reached = true;
          return { url: "", provider: "", endpoint: "", latencyMs: 0, costUsd: 0 };
        }) as RenderDeps["orchestrate"],
      });

      const outcome = await reserveOrchestrateRecord(input, deps);

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.insufficient).toBe(true);
      expect(reached).toBe(false);
      expect(calls.map((c) => c.name)).toEqual(["reserve_credits"]);
    }
  });
});
