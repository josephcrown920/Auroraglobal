import { describe, expect, it, mock } from "bun:test";
import type { RenderDeps } from "./generate-core.server";

// ── Module stubs ──────────────────────────────────────────────────────────────
// Mock result-store.server BEFORE dynamically importing generate-core.server.
// generate-core.server calls persistResultUrl() on EVERY happy-path render; without
// this stub the happy-path tests fail with "connection refused" trying to re-host
// the provider URL. Using mock.module + dynamic import is required because Bun
// processes static `import` declarations before any code runs, so a mock placed
// after a static import would be too late. (See bun-mock-module-leakage.md.)
mock.module("./result-store.server", () => ({
  persistResultUrl: async (args: { url: string }) => ({
    url: args.url,
    persisted: false,
    compressed: false,
  }),
  resultMediaTypeForKind: (kind: string) => {
    if (
      ["video", "lipsync", "lyric_video", "assemble", "caption_burn"].includes(kind)
    )
      return "video";
    if (kind === "audio") return "audio";
    return "image";
  },
}));

const { reserveOrchestrateRecord } = await import("./generate-core.server");

// ── Test helpers ──────────────────────────────────────────────────────────────

type RpcCall = { name: string; args: Record<string, unknown> };

/**
 * Build a dependency-injected RenderDeps whose RPC log, inserted-generation
 * rows, and behaviour are all controllable per-test.
 *
 * Returns:
 *   deps       — the RenderDeps to pass to reserveOrchestrateRecord
 *   calls      — RPC calls recorded in order (reserve / commit / release / …)
 *   insertedRows — every row passed to insertGeneration, in order
 */
function makeDeps(overrides: {
  reserveResult?: { data: unknown; error: { message: string } | null };
  commitError?: { message: string } | null;
  releaseError?: { message: string } | null;
  orchestrateImpl?: RenderDeps["orchestrate"];
  insertImpl?: RenderDeps["insertGeneration"];
}) {
  const calls: RpcCall[] = [];
  const insertedRows: unknown[] = [];

  const deps: RenderDeps = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "reserve_credits")
        return overrides.reserveResult ?? { data: true, error: null };
      if (name === "commit_reservation")
        return { data: null, error: overrides.commitError ?? null };
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
    insertGeneration:
      overrides.insertImpl ??
      (async (row) => {
        insertedRows.push(row);
        return { id: "gen_1" };
      }),
  };

  return { deps, calls, insertedRows };
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
// Existing image credit-flow tests (preserved)
// ─────────────────────────────────────────────────────────────────────────────

describe("reserveOrchestrateRecord credit flow", () => {
  it("reserves, renders, records, and commits on the happy path (no release)", async () => {
    const { deps, calls } = makeDeps({});
    const outcome = await reserveOrchestrateRecord(baseInput, deps);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.generationId).toBe("gen_1");
      expect(outcome.url).toBe("https://cdn.example/out.png");
    }
    expect(calls.map((c) => c.name)).toEqual([
      "reserve_credits",
      "commit_reservation",
    ]);
  });

  it("returns insufficient (402-style) without orchestrating, committing, or releasing", async () => {
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

  it("releases the reservation when orchestrate fails, then rethrows", async () => {
    const { deps, calls } = makeDeps({
      orchestrateImpl: (async () => {
        throw new Error("No provider can serve image");
      }) as RenderDeps["orchestrate"],
    });
    await expect(
      reserveOrchestrateRecord(baseInput, deps),
    ).rejects.toThrow("No provider can serve image");
    expect(calls.map((c) => c.name)).toEqual([
      "reserve_credits",
      "release_reservation",
    ]);
  });

  it("releases the reservation when the generations insert fails", async () => {
    const { deps, calls } = makeDeps({
      insertImpl: async () => {
        throw new Error("insert failed");
      },
    });
    await expect(
      reserveOrchestrateRecord(baseInput, deps),
    ).rejects.toThrow("insert failed");
    expect(calls.map((c) => c.name)).toEqual([
      "reserve_credits",
      "release_reservation",
    ]);
  });

  it("surfaces a commit failure WITHOUT releasing (a delivered render must not be refunded)", async () => {
    const { deps, calls } = makeDeps({
      commitError: { message: "commit boom" },
    });
    await expect(
      reserveOrchestrateRecord(baseInput, deps),
    ).rejects.toThrow(/credit commit failed/);
    expect(calls.map((c) => c.name)).toEqual([
      "reserve_credits",
      "commit_reservation",
    ]);
    expect(calls.some((c) => c.name === "release_reservation")).toBe(false);
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
});

// ─────────────────────────────────────────────────────────────────────────────
// Premium video/lipsync — no-double-refund guarantee
//
// For expensive renders (video ~$0.05–$0.65/s, lipsync ~$0.30/clip) the
// credit contract is strict:
//   SUCCESS → reserve_credits + commit_reservation (NO release)
//   FAILURE → reserve_credits + release_reservation (NO commit)
//   COMMIT FAILS after delivered render → NO release (render already shipped,
//     refunding would drain revenue for a result the user received)
//
// These tests prove that invariant holds for both kind:"video" and
// kind:"lipsync" without touching a live provider or the live DB.
// The provider HTTP call is replaced by a controlled orchestrateImpl; the
// credit RPCs are stubbed to record every call in order.
// ─────────────────────────────────────────────────────────────────────────────

describe("premium video/lipsync renders: no-double-refund guarantee", () => {
  // ── kind: "video" ──────────────────────────────────────────────────────────

  it("video: happy path reserves then commits EXACTLY ONCE — never releases", async () => {
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
    // Must be EXACTLY this sequence — nothing extra, nothing missing.
    expect(rpcNames).toEqual(["reserve_credits", "commit_reservation"]);
    // Zero release calls — a successful render must NEVER trigger a refund.
    expect(rpcNames.filter((n) => n === "release_reservation")).toHaveLength(0);
  });

  it("video: records result_video_url (not result_image_url) in the generations row", async () => {
    const VIDEO_URL = "https://cdn.example/seedance-out.mp4";
    const { deps, insertedRows } = makeDeps({
      orchestrateImpl: async () => ({
        url: VIDEO_URL,
        provider: "replicate",
        endpoint: "seedance-2.0-fast",
        latencyMs: 3200,
        costUsd: 0.05,
      }),
    });

    await reserveOrchestrateRecord(baseVideoInput, deps);

    expect(insertedRows).toHaveLength(1);
    const row = insertedRows[0] as Record<string, unknown>;
    // result_video_url carries the output; result_image_url MUST be null so the
    // gallery renders the correct media type and the admin tools show the right URL.
    expect(row.result_video_url).toBe(VIDEO_URL);
    expect(row.result_image_url).toBeNull();
    expect(row.kind).toBe("video");
  });

  it("video: releases EXACTLY ONCE on provider failure — no double-refund", async () => {
    const { deps, calls } = makeDeps({
      orchestrateImpl: (async () => {
        throw new Error("Replicate: prediction failed — safety filter");
      }) as RenderDeps["orchestrate"],
    });

    await expect(
      reserveOrchestrateRecord(baseVideoInput, deps),
    ).rejects.toThrow();

    const rpcNames = calls.map((c) => c.name);
    // Credits must come back — exactly one release, never two.
    expect(rpcNames.filter((n) => n === "release_reservation")).toHaveLength(1);
    // No commit on a failed render.
    expect(rpcNames.filter((n) => n === "commit_reservation")).toHaveLength(0);
  });

  it("video: commit failure after delivered render NEVER releases (no refund of delivered output)", async () => {
    // The provider returned the video URL; the generations row was inserted.
    // Now the commit RPC fails (e.g. transient DB error). Releasing credits
    // at this point would refund a render the user already has — a revenue
    // loss with no recovery path. The error must surface for manual
    // reconciliation, but release_reservation must NEVER be called.
    const { deps, calls } = makeDeps({
      orchestrateImpl: async () => ({
        url: "https://cdn.example/seedance-out.mp4",
        provider: "replicate",
        endpoint: "seedance-2.0-fast",
        latencyMs: 3200,
        costUsd: 0.05,
      }),
      commitError: { message: "pg: connection reset by peer" },
    });

    await expect(
      reserveOrchestrateRecord(baseVideoInput, deps),
    ).rejects.toThrow(/credit commit failed/);

    const rpcNames = calls.map((c) => c.name);
    // Commit was attempted — not silently skipped.
    expect(rpcNames.filter((n) => n === "commit_reservation")).toHaveLength(1);
    // Release was NOT called — the render was delivered; no refund.
    expect(rpcNames.filter((n) => n === "release_reservation")).toHaveLength(0);
  });

  it("video: reserve_credits receives the exact cost amount passed to the function", async () => {
    // The amount charged must be exactly what the caller computed (via
    // computeCost). This proves the credit ledger debit matches the
    // displayed price — no silent rounding or substitution in the flow.
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
    const commit = calls.find((c) => c.name === "commit_reservation");
    expect(commit?.args._amount).toBe(baseVideoInput.cost);
  });

  // ── kind: "lipsync" ────────────────────────────────────────────────────────

  it("lipsync: happy path reserves then commits EXACTLY ONCE — never releases", async () => {
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
    expect(rpcNames).toEqual(["reserve_credits", "commit_reservation"]);
    expect(rpcNames.filter((n) => n === "release_reservation")).toHaveLength(0);
  });

  it("lipsync: records result_video_url (not result_image_url) in the generations row", async () => {
    const LIPSYNC_URL = "https://cdn.example/lipsync-out.mp4";
    const { deps, insertedRows } = makeDeps({
      orchestrateImpl: async () => ({
        url: LIPSYNC_URL,
        provider: "fal",
        endpoint: "fal-ai/sync-lipsync/v2",
        latencyMs: 8200,
        costUsd: 0.30,
      }),
    });

    await reserveOrchestrateRecord(baseLipsyncInput, deps);

    expect(insertedRows).toHaveLength(1);
    const row = insertedRows[0] as Record<string, unknown>;
    expect(row.result_video_url).toBe(LIPSYNC_URL);
    expect(row.result_image_url).toBeNull();
    expect(row.kind).toBe("lipsync");
    // The driving audio URL is stored as audio_url, not as the result.
    expect(row.audio_url).toBe(baseLipsyncInput.audioUrl);
  });

  it("lipsync: releases EXACTLY ONCE on provider failure — no double-refund", async () => {
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
    expect(rpcNames.filter((n) => n === "commit_reservation")).toHaveLength(0);
  });

  it("lipsync: commit failure after delivered render NEVER releases (no refund of delivered output)", async () => {
    // Same contract as video: a delivered lip-sync must not be refunded even
    // if the credit-commit RPC fails after the provider returns the URL.
    const { deps, calls } = makeDeps({
      orchestrateImpl: async () => ({
        url: "https://cdn.example/lipsync-out.mp4",
        provider: "fal",
        endpoint: "fal-ai/sync-lipsync/v2",
        latencyMs: 8200,
        costUsd: 0.30,
      }),
      commitError: { message: "network: connection reset" },
    });

    await expect(
      reserveOrchestrateRecord(baseLipsyncInput, deps),
    ).rejects.toThrow(/credit commit failed/);

    const rpcNames = calls.map((c) => c.name);
    expect(rpcNames.filter((n) => n === "commit_reservation")).toHaveLength(1);
    // No release — the render was delivered; refunding would be incorrect.
    expect(rpcNames.filter((n) => n === "release_reservation")).toHaveLength(0);
  });

  it("lipsync: reserve_credits receives the exact cost amount passed to the function", async () => {
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
    const commit = calls.find((c) => c.name === "commit_reservation");
    expect(commit?.args._amount).toBe(baseLipsyncInput.cost);
  });

  // ── Cross-kind: insufficient-credits path ──────────────────────────────────

  it("video + lipsync: returns insufficient without orchestrating when balance is low", async () => {
    // A user below the cost threshold must never reach the provider call —
    // there should be zero spent provider credits and zero DB side-effects.
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
      // Exactly one RPC: the balance check. Nothing else.
      expect(calls.map((c) => c.name)).toEqual(["reserve_credits"]);
    }
  });
});
