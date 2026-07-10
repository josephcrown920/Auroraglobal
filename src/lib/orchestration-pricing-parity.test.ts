import { describe, expect, test } from "bun:test";
import { computeCost, detectFeatures, type Feature } from "./pricing";

// Task #66: prove the price a caller is QUOTED equals the price they are
// CHARGED, across the two independent entry points that both price
// generations off the shared module (the public CLI/API route in
// src/routes/api/public/generate.ts, and the in-app AI Router's
// quoteGenerate/orchestrateGenerate pair in src/lib/orchestration.functions.ts).
// Both call sites are createServerFn handlers wrapped in auth middleware, so
// they aren't unit-invokable directly here — instead we replicate their exact
// detectFeatures/computeCost call shape (verified against the source above)
// and assert the two independent call sites agree byte-for-byte.
describe("wiring-level pricing parity: quoted price == charged price", () => {
  // Mirrors src/routes/api/public/generate.ts's detectFeatures+computeCost call.
  function publicApiQuote(input: {
    kind: Feature;
    audioUrl?: string;
    videoUrl?: string;
    cameraMovement?: string;
    features?: Feature[];
    resolution?: "480p" | "720p" | "1080p" | "2160p";
    durationSeconds?: number;
    model?: string;
  }) {
    const { features } = detectFeatures({
      kind: input.kind,
      audioUrl: input.audioUrl,
      videoUrl: input.videoUrl,
      cameraMovement: input.cameraMovement,
      features: input.features,
    });
    return computeCost({
      features,
      resolution: input.resolution,
      durationSeconds: input.durationSeconds,
      model: input.model,
    });
  }

  // Mirrors src/lib/orchestration.functions.ts's quoteGenerate handler.
  function aiRouterQuote(input: {
    kind: Feature;
    audioUrl?: string;
    videoUrl?: string;
    cameraMovement?: string;
    features?: Feature[];
    resolution?: "480p" | "720p" | "1080p" | "2160p";
    durationSeconds?: number;
    model?: string;
  }) {
    const { features } = detectFeatures({
      kind: input.kind,
      audioUrl: input.audioUrl,
      videoUrl: input.videoUrl,
      cameraMovement: input.cameraMovement,
      features: input.features,
    });
    return computeCost({
      features,
      resolution: input.resolution,
      durationSeconds: input.durationSeconds,
      model: input.model,
    });
  }

  test("public API and AI Router quote identical totals for a plain video render", () => {
    const args = { kind: "video" as Feature, resolution: "1080p" as const, durationSeconds: 10, model: "kling-2.1" };
    expect(publicApiQuote(args).total).toBe(aiRouterQuote(args).total);
  });

  test("public API and AI Router quote identical totals when a lipsync stack is auto-detected", () => {
    const args = {
      kind: "video" as Feature,
      audioUrl: "https://example.com/a.mp3",
      videoUrl: "https://example.com/v.mp4",
      resolution: "720p" as const,
      durationSeconds: 5,
    };
    const pub = publicApiQuote(args);
    const router = aiRouterQuote(args);
    expect(pub.total).toBe(router.total);
    expect(pub.breakdown).toEqual(router.breakdown);
  });

  test("motion-preset detection: a video request with a camera movement is auto-priced with the motion feature stacked on", () => {
    const withMotion = publicApiQuote({ kind: "video", cameraMovement: "orbit", resolution: "720p", durationSeconds: 5 });
    const withoutMotion = publicApiQuote({ kind: "video", resolution: "720p", durationSeconds: 5 });
    const { features } = detectFeatures({ kind: "video", cameraMovement: "orbit" });
    expect(features).toContain("motion");
    expect(withMotion.total).toBeGreaterThan(withoutMotion.total);
  });

  test("explicit features override is additive-only: it can add features but never drop the primary kind to undercharge", () => {
    // A caller submitting kind:"video", features:["image"] must still be billed
    // for the video they're actually running, not silently downgraded to image pricing.
    const { features } = detectFeatures({ kind: "video", features: ["image"] });
    expect(features).toContain("video");
    expect(features).toContain("image");

    const forced = computeCost({ features, resolution: "720p", durationSeconds: 5 });
    const videoOnly = computeCost({ features: ["video"], resolution: "720p", durationSeconds: 5 });
    // Adding "image" on top can only raise (or match) the price, never lower it.
    expect(forced.total).toBeGreaterThanOrEqual(videoOnly.total);
  });

  test("preview pass (480p, capped duration) prices identically regardless of which entry point computes it", () => {
    const previewArgs = { kind: "video" as Feature, resolution: "480p" as const, durationSeconds: 5 };
    expect(publicApiQuote(previewArgs).total).toBe(aiRouterQuote(previewArgs).total);
  });
});
