import { describe, expect, it } from "bun:test";
import {
  _enqueuePerformanceShot,
  _enqueueVideoFromImage,
  COST_IMAGE,
  isDemoSelfieUrl,
  isSubscriberGatedVideoModel,
} from "./studio.functions";
import { assertOwnedReferenceImage } from "./url-guard";

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

describe("demo-selfie labelling — persists a 'demo' marker for gallery badges", () => {
  it("isDemoSelfieUrl matches only the caller's own demo path", () => {
    expect(isDemoSelfieUrl(`${STUDIO}user-1/demo/selfie.jpg`, "user-1")).toBe(true);
    // URL-encoded path segments still match after decoding
    expect(isDemoSelfieUrl(`${STUDIO}user-1%2Fdemo%2Fselfie.jpg`, "user-1")).toBe(true);
    // Someone else's demo path is NOT the caller's demo
    expect(isDemoSelfieUrl(`${STUDIO}user-2/demo/selfie.jpg`, "user-1")).toBe(false);
    // A regular selfie upload is not a demo
    expect(isDemoSelfieUrl(`${STUDIO}user-1/uploads/selfie.jpg`, "user-1")).toBe(false);
    // Garbage input never throws
    expect(isDemoSelfieUrl("not a url", "user-1")).toBe(false);
  });

  it("marks the generation as demo when the demo selfie is a reference", async () => {
    const demoMarked: string[] = [];
    const { deps, reserveCalls } = makeDeps({
      markDemo: async (generationId: string) => {
        demoMarked.push(generationId);
      },
    });
    await _enqueuePerformanceShot(
      "user-1",
      {
        prompt: "demo shot",
        imageUrls: [`${STUDIO}user-1/demo/selfie.jpg`],
        model: "google/nano-banana",
        motionVideoUrl: null,
      },
      deps,
    );
    expect(reserveCalls).toHaveLength(1);
    expect(demoMarked).toEqual(["gen-1"]);
  });

  it("does NOT mark normal uploads as demo", async () => {
    const demoMarked: string[] = [];
    const { deps } = makeDeps({
      markDemo: async (generationId: string) => {
        demoMarked.push(generationId);
      },
    });
    await _enqueuePerformanceShot(
      "user-1",
      {
        prompt: "own selfie shot",
        imageUrls: [`${STUDIO}user-1/uploads/face.jpg`],
        model: "google/nano-banana",
        motionVideoUrl: null,
      },
      deps,
    );
    expect(demoMarked).toHaveLength(0);
  });
});

describe("_enqueueVideoFromImage — reference ownership guard runs before any gate or charge", () => {
  const base = {
    prompt: "animate this still",
    duration: 5,
    resolution: "720p" as const,
    modelKey: "seedance-2.0-fast",
    cameraMovement: null,
    endFrameUrl: null,
    confirmPreviewId: null,
    templateId: null,
  };

  it("rejects a foreign start frame with the ownership error and never proceeds", async () => {
    const checked: string[] = [];
    await expect(
      _enqueueVideoFromImage(
        "user-1",
        { ...base, imageUrl: `${STUDIO}user-2/uploads/portrait.jpg` },
        {
          assertOwned: async (url) => {
            checked.push(url);
            throw new Error(OWNERSHIP_ERR);
          },
        },
      ),
    ).rejects.toThrow(OWNERSHIP_ERR);
    expect(checked).toEqual([`${STUDIO}user-2/uploads/portrait.jpg`]);
  });

  it("checks the end frame too, after the start frame", async () => {
    const checked: string[] = [];
    await expect(
      _enqueueVideoFromImage(
        "user-1",
        {
          ...base,
          imageUrl: `${STUDIO}user-1/uploads/start.jpg`,
          endFrameUrl: `${STUDIO}user-2/uploads/end.jpg`,
        },
        {
          assertOwned: async (url) => {
            checked.push(url);
            if (url.includes("user-2")) throw new Error(OWNERSHIP_ERR);
          },
        },
      ),
    ).rejects.toThrow(OWNERSHIP_ERR);
    expect(checked).toEqual([`${STUDIO}user-1/uploads/start.jpg`, `${STUDIO}user-2/uploads/end.jpg`]);
  });

  it("accepts caller-owned start and end frames before entering billing", async () => {
    const startFrame = `${STUDIO}user-1/uploads/start.jpg`;
    const endFrame = `${STUDIO}user-1/uploads/end.jpg`;
    const data = { ...base, imageUrl: startFrame, endFrameUrl: endFrame };

    // Stop immediately after the two ownership checks. This keeps the positive
    // path free of preview, credit, and provider calls while proving the real
    // guard accepts both caller-owned references.
    Object.defineProperty(data, "prompt", {
      get: () => {
        throw new Error("guard-only test stop");
      },
    });
    data.modelKey = "veo-3-fast";
    await expect(
      _enqueueVideoFromImage(
        "user-1",
        data,
        { assertOwned: assertOwnedReferenceImage },
      ),
    ).rejects.toThrow("guard-only test stop");
  });
});

describe("subscriber-gated video routing", () => {
  const seedanceBase = {
    prompt: "animate this still",
    duration: 5,
    resolution: "720p" as const,
    modelKey: "seedance-2.0-fast",
    cameraMovement: null,
    endFrameUrl: null,
    confirmPreviewId: null,
    templateId: null,
  };

  it("recognizes Seedance, Kling, and native Seedance keys", () => {
    expect(isSubscriberGatedVideoModel("seedance-2.0-fast")).toBe(true);
    expect(isSubscriberGatedVideoModel("kling-3.0")).toBe(true);
    expect(isSubscriberGatedVideoModel("byteplus/seedance-2.5")).toBe(true);
    expect(isSubscriberGatedVideoModel("veo-3-fast")).toBe(false);
  });

  it("persists the subscriber and pinned fences for a Pro Seedance preview", async () => {
    const reserveCalls: Array<Record<string, unknown>> = [];
    const out = await _enqueueVideoFromImage(
      "user-1",
      {
        ...seedanceBase,
        imageUrl: `${STUDIO}user-1/uploads/start.jpg`,
      },
      {
        assertOwned: async () => {},
        getTier: async () => "pro",
        resolveGate: async () => ({ confirmed: false }),
        reserve: async (_userId, _kind, _prompt, _amount, payload) => {
          reserveCalls.push(payload);
          return { jobId: "job-video", generationId: "gen-video" };
        },
        markPreview: async () => {},
        track: async () => {},
      },
    );

    expect(out).toEqual({
      jobId: "job-video",
      generationId: "gen-video",
      preview: true,
    });
    expect(reserveCalls[0]).toMatchObject({
      model: "seedance-2.0-fast",
      forSubscriber: true,
      pinnedModelOnly: true,
      previewOnly: true,
    });
  });
});
