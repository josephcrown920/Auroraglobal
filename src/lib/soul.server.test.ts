import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  isStaleTraining,
  extractJsonObject,
  coerceVibeResult,
  VIBE_FALLBACK,
  trainSoul,
  type SoulRow,
  type TrainSoulDeps,
} from "./soul.server";
import { SOUL_TRAINING_COST } from "@/lib/pricing";

function makeSoul(overrides: Partial<SoulRow> = {}): SoulRow {
  return {
    id: "soul_1",
    user_id: "user_1",
    name: "Test Soul",
    description: null,
    trigger_word: "sks-abc123",
    status: "training",
    progress: 10,
    error_message: null,
    training_image_paths: [],
    reference_image_paths: [],
    fal_training_id: "req_1",
    lora_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("isStaleTraining", () => {
  it("is false for a fresh training run", () => {
    expect(isStaleTraining(makeSoul({ status: "training", updated_at: new Date().toISOString() }))).toBe(false);
  });

  it("is true once a training run exceeds the stale threshold", () => {
    const stale = new Date(Date.now() - 46 * 60_000).toISOString();
    expect(isStaleTraining(makeSoul({ status: "training", updated_at: stale }))).toBe(true);
  });

  it("is false for non-training statuses regardless of age", () => {
    const stale = new Date(Date.now() - 60 * 60_000).toISOString();
    expect(isStaleTraining(makeSoul({ status: "ready", updated_at: stale }))).toBe(false);
    expect(isStaleTraining(makeSoul({ status: "pending", updated_at: stale }))).toBe(false);
    expect(isStaleTraining(makeSoul({ status: "failed", updated_at: stale }))).toBe(false);
  });
});

describe("extractJsonObject", () => {
  it("parses a bare JSON object", () => {
    expect(extractJsonObject('{"name":"Moody Noir"}')).toEqual({ name: "Moody Noir" });
  });

  it("extracts JSON from a fenced code block", () => {
    const text = 'Here you go:\n```json\n{"name":"Golden Hour"}\n```\nEnjoy.';
    expect(extractJsonObject(text)).toEqual({ name: "Golden Hour" });
  });

  it("extracts JSON embedded in surrounding prose without fences", () => {
    const text = 'Sure! {"name":"Neon Dusk","moodTags":["cyberpunk"]} — hope that helps.';
    expect(extractJsonObject(text)).toEqual({ name: "Neon Dusk", moodTags: ["cyberpunk"] });
  });

  it("throws when no JSON object is present", () => {
    expect(() => extractJsonObject("no json here at all")).toThrow();
  });
});

describe("coerceVibeResult", () => {
  it("passes through a well-formed vibe object", () => {
    const input = {
      name: "Golden Hour",
      description: "Warm backlit glow with soft film grain.",
      moodTags: ["warm", "nostalgic"],
      colorPalette: ["#f4a261", "#e76f51"],
      lightingStyle: "golden hour backlight",
      cameraStyle: "35mm eye-level",
    };
    expect(coerceVibeResult(input)).toEqual(input);
  });

  it("falls back to VIBE_FALLBACK for a non-object value", () => {
    expect(coerceVibeResult("not an object")).toEqual(VIBE_FALLBACK);
    expect(coerceVibeResult(null)).toEqual(VIBE_FALLBACK);
    expect(coerceVibeResult(42)).toEqual(VIBE_FALLBACK);
  });

  it("fills missing/invalid fields with fallback defaults instead of throwing", () => {
    const result = coerceVibeResult({ name: "Only A Name" });
    expect(result.name).toBe("Only A Name");
    expect(result.description).toBe(VIBE_FALLBACK.description);
    expect(result.moodTags).toEqual([]);
    expect(result.colorPalette).toEqual([]);
    expect(result.lightingStyle).toBe(VIBE_FALLBACK.lightingStyle);
    expect(result.cameraStyle).toBe(VIBE_FALLBACK.cameraStyle);
  });

  it("drops non-string entries from array fields and caps length at 8", () => {
    const result = coerceVibeResult({
      name: "Test",
      moodTags: ["a", 2, "b", null, "c", "d", "e", "f", "g", "h", "i"],
    });
    expect(result.moodTags).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
  });

  it("truncates overlong name/description rather than rejecting them", () => {
    const longName = "x".repeat(200);
    const longDesc = "y".repeat(1000);
    const result = coerceVibeResult({ name: longName, description: longDesc });
    expect(result.name.length).toBe(60);
    expect(result.description.length).toBe(400);
  });
});

describe("trainSoul", () => {
  const TEN_PATHS = Array.from({ length: 10 }, (_, i) => `img_${i}.jpg`);
  let originalFalKey: string | undefined;

  beforeEach(() => {
    originalFalKey = process.env.FAL_KEY;
    process.env.FAL_KEY = "test-fal-key";
  });
  afterEach(() => {
    if (originalFalKey === undefined) delete process.env.FAL_KEY;
    else process.env.FAL_KEY = originalFalKey;
  });

  // Records every reserve/commit/release call so a test can assert exactly
  // what the credit ledger saw, without touching a live Supabase connection.
  function makeLedger() {
    const calls: { reserved: unknown[]; committed: unknown[]; released: unknown[] } = {
      reserved: [],
      committed: [],
      released: [],
    };
    return {
      calls,
      reserveCredits: async (userId: string, amount: number, reason: string, ref: string) => {
        calls.reserved.push({ userId, amount, reason, ref });
        return true;
      },
      commitReservation: async (ref: string) => {
        calls.committed.push({ ref });
      },
      releaseReservation: async (userId: string, amount: number, reason: string, ref: string) => {
        calls.released.push({ userId, amount, reason, ref });
      },
    };
  }

  function baseDeps(soul: SoulRow, overrides: Partial<TrainSoulDeps> = {}): TrainSoulDeps {
    const ledger = makeLedger();
    return {
      getOwnedSoul: async () => soul,
      claimSoulForTraining: async () => soul,
      reserveCredits: ledger.reserveCredits,
      commitReservation: ledger.commitReservation,
      releaseReservation: ledger.releaseReservation,
      downloadTrainingImage: async () => new ArrayBuffer(8),
      uploadZip: async () => {},
      signZipUrl: async () => "https://signed.example/archive.zip",
      updateSoul: async (soulId, patch) => ({ ...soul, ...patch } as SoulRow),
      markSoulFailed: async () => {},
      ...overrides,
    };
  }

  it("reserves credits before calling fal, sends the soul's trigger_word, and commits on success", async () => {
    const soul = makeSoul({ status: "pending", training_image_paths: TEN_PATHS, trigger_word: "sks-unique-tok" });
    const ledger = makeLedger();
    let capturedBody: Record<string, unknown> | undefined;
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      capturedBody = JSON.parse(init!.body as string);
      return new Response(JSON.stringify({ request_id: "req_123" }), { status: 200 });
    };

    const result = await trainSoul(
      soul.id,
      soul.user_id,
      baseDeps(soul, {
        reserveCredits: ledger.reserveCredits,
        commitReservation: ledger.commitReservation,
        releaseReservation: ledger.releaseReservation,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.soul.fal_training_id).toBe("req_123");
    expect(result.soul.status).toBe("training");

    // Trigger word must reach the trainer, or the LoRA never learns the token.
    expect(capturedBody?.trigger_word).toBe("sks-unique-tok");

    // Credits reserved before the paid fal call, then committed (not released)
    // once fal accepted the job.
    expect(ledger.calls.reserved).toHaveLength(1);
    expect(ledger.calls.reserved[0]).toMatchObject({ amount: SOUL_TRAINING_COST, userId: soul.user_id });
    expect(ledger.calls.committed).toHaveLength(1);
    expect(ledger.calls.released).toHaveLength(0);
  });

  it("does not call fal and returns insufficient when credits can't be reserved", async () => {
    const soul = makeSoul({ status: "pending", training_image_paths: TEN_PATHS });
    let fetchCalled = false;
    const result = await trainSoul(
      soul.id,
      soul.user_id,
      baseDeps(soul, {
        reserveCredits: async () => false,
        fetchImpl: (async () => {
          fetchCalled = true;
          return new Response("{}", { status: 200 });
        }) as unknown as typeof fetch,
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure result");
    expect(result.insufficient).toBe(true);
    expect(fetchCalled).toBe(false);
  });

  it("releases the reservation (not commits it) when fal rejects the training request", async () => {
    const soul = makeSoul({ status: "pending", training_image_paths: TEN_PATHS });
    const ledger = makeLedger();
    const result = await trainSoul(
      soul.id,
      soul.user_id,
      baseDeps(soul, {
        reserveCredits: ledger.reserveCredits,
        commitReservation: ledger.commitReservation,
        releaseReservation: ledger.releaseReservation,
        fetchImpl: (async () => new Response("provider error", { status: 500 })) as unknown as typeof fetch,
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure result");
    expect(result.error).toContain("Training request failed");
    expect(ledger.calls.released).toHaveLength(1);
    expect(ledger.calls.released[0]).toMatchObject({ amount: SOUL_TRAINING_COST, reason: "release_soul_training" });
    expect(ledger.calls.committed).toHaveLength(0);
  });

  it("releases the reservation when too few training photos can be read from storage", async () => {
    const soul = makeSoul({ status: "pending", training_image_paths: TEN_PATHS });
    const ledger = makeLedger();
    const result = await trainSoul(
      soul.id,
      soul.user_id,
      baseDeps(soul, {
        reserveCredits: ledger.reserveCredits,
        releaseReservation: ledger.releaseReservation,
        downloadTrainingImage: async () => null, // every download "fails"
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure result");
    expect(result.error).toContain("could be read from storage");
    expect(ledger.calls.released).toHaveLength(1);
  });

  it("does NOT release an already-committed reservation, but still marks the soul failed, when the post-commit DB update throws", async () => {
    const soul = makeSoul({ status: "pending", training_image_paths: TEN_PATHS });
    const ledger = makeLedger();
    let markedFailedWith: string | undefined;
    const result = await trainSoul(
      soul.id,
      soul.user_id,
      baseDeps(soul, {
        reserveCredits: ledger.reserveCredits,
        commitReservation: ledger.commitReservation,
        releaseReservation: ledger.releaseReservation,
        updateSoul: async () => {
          throw new Error("db unavailable");
        },
        markSoulFailed: async (_soulId, message) => {
          markedFailedWith = message;
        },
        fetchImpl: (async () =>
          new Response(JSON.stringify({ request_id: "req_999" }), { status: 200 })) as unknown as typeof fetch,
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure result");
    expect(result.error).toBe("db unavailable");
    // The fal job was already accepted (and committed) before the DB write
    // failed — the real spend already happened, so releasing here would be
    // an incorrect refund. Reconciling the Soul's status is still required.
    expect(ledger.calls.committed).toHaveLength(1);
    expect(ledger.calls.released).toHaveLength(0);
    expect(markedFailedWith).toBe("db unavailable");
  });

  it("refuses to start a second training run while one is already in progress (pre-check fast path)", async () => {
    const soul = makeSoul({ status: "training", training_image_paths: TEN_PATHS, updated_at: new Date().toISOString() });
    let reserveCalled = false;
    const result = await trainSoul(
      soul.id,
      soul.user_id,
      baseDeps(soul, {
        reserveCredits: async () => {
          reserveCalled = true;
          return true;
        },
      }),
    );
    expect(result.ok).toBe(false);
    expect(reserveCalled).toBe(false);
  });

  it("never reserves credits or calls fal when a concurrent request already claimed the soul", async () => {
    // Simulates the real race: the atomic claim UPDATE loses because another
    // in-flight request already transitioned this soul to "training".
    const soul = makeSoul({ status: "pending", training_image_paths: TEN_PATHS });
    let reserveCalled = false;
    let fetchCalled = false;
    const result = await trainSoul(
      soul.id,
      soul.user_id,
      baseDeps(soul, {
        claimSoulForTraining: async () => null,
        reserveCredits: async () => {
          reserveCalled = true;
          return true;
        },
        fetchImpl: (async () => {
          fetchCalled = true;
          return new Response(JSON.stringify({ request_id: "req_1" }), { status: 200 });
        }) as unknown as typeof fetch,
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure result");
    expect(result.error).toContain("already training");
    expect(reserveCalled).toBe(false);
    expect(fetchCalled).toBe(false);
  });
});
