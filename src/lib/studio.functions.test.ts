import { describe, expect, it } from "bun:test";
import { _enqueuePerformanceShot, COST_IMAGE } from "./studio.functions";

// The reference-image ownership guard was moved INTO _enqueuePerformanceShot so
// that every caller — the generatePerformanceShot server fn, runSmokeStudioChain,
// and any future internal path — enforces it. These tests pin that contract:
// a foreign reference must be rejected BEFORE any credits are reserved.

const OWNERSHIP_ERR = "You can only use character images you own.";
const STUDIO = "https://tpzmvbczwahxajujvnrq.supabase.co/storage/v1/object/public/studio/";

type ReserveCall = {
  userId: string;
  kind: string;
  prompt: string;
  amount: number;
  payload: Record<string, unknown>;
};

function makeDeps(over: Partial<Parameters<typeof _enqueuePerformanceShot>[2]> = {}) {
  const reserveCalls: ReserveCall[] = [];
  const trackCalls: string[] = [];
  const deps = {
    assertOwned: async () => {},
    reserve: async (
      userId: string,
      kind: string,
      prompt: string,
      amount: number,
      payload: Record<string, unknown>,
    ) => {
      reserveCalls.push({ userId, kind, prompt, amount, payload });
      return { jobId: "job-1", generationId: "gen-1" };
    },
    track: async (name: string) => {
      trackCalls.push(name);
    },
    ...over,
  } as NonNullable<Parameters<typeof _enqueuePerformanceShot>[2]>;
  return { deps, reserveCalls, trackCalls };
}

describe("_enqueuePerformanceShot — ownership guard (applies to EVERY caller)", () => {
  it("rejects a foreign reference image BEFORE reserving any credits", async () => {
    const { deps, reserveCalls } = makeDeps({
      assertOwned: async () => {
        throw new Error(OWNERSHIP_ERR);
      },
    });
    await expect(
      _enqueuePerformanceShot(
        "user-1",
        {
          prompt: "portrait on stage",
          imageUrls: [`${STUDIO}other-user/face.jpg`],
          model: "google/nano-banana",
          motionVideoUrl: null,
        },
        deps,
      ),
    ).rejects.toThrow(/character images you own/);
    expect(reserveCalls).toHaveLength(0);
  });

  it("checks every reference, then reserves once with the full payload", async () => {
    const seen: string[] = [];
    const { deps, reserveCalls, trackCalls } = makeDeps({
      assertOwned: async (url: string) => {
        seen.push(url);
      },
    });
    const urls = [`${STUDIO}me/a.jpg`, `${STUDIO}me/b.jpg`];
    const out = await _enqueuePerformanceShot(
      "user-1",
      { prompt: "two-reference composite", imageUrls: urls, model: "google/nano-banana", motionVideoUrl: null },
      deps,
    );
    expect(seen).toEqual(urls);
    expect(out).toEqual({ jobId: "job-1", generationId: "gen-1" });
    expect(reserveCalls).toHaveLength(1);
    expect(reserveCalls[0]).toMatchObject({
      userId: "user-1",
      kind: "image",
      amount: COST_IMAGE,
      payload: { kind: "image", imageUrls: urls, motionVideoUrl: null },
    });
    expect(trackCalls).toEqual(["performance_shot_enqueued"]);
  });

  it("skips the guard for pure text-to-image (empty imageUrls) and still reserves", async () => {
    const seen: string[] = [];
    const { deps, reserveCalls } = makeDeps({
      assertOwned: async (url: string) => {
        seen.push(url);
      },
    });
    await _enqueuePerformanceShot(
      "user-1",
      { prompt: "a neon city at dusk", imageUrls: [], model: "google/nano-banana", motionVideoUrl: null },
      deps,
    );
    expect(seen).toHaveLength(0);
    expect(reserveCalls).toHaveLength(1);
  });
});
