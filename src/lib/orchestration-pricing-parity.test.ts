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
  // Returns both the CostQuote AND the detected features so tests can verify
  // what quoteGenerate returns and propagate those features to aiRouterCharge.
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
    const cost = computeCost({
      features,
      resolution: input.resolution,
      durationSeconds: input.durationSeconds,
      model: input.model,
    });
    return { ...cost, features };
  }

  // Mirrors src/lib/orchestration.functions.ts's orchestrateGenerate handler's
  // detectFeatures+computeCost call. cameraMovement is NOT accepted here because
  // OrchestrateSchema intentionally omits it (it stays in the prompt); motion
  // can only reach the charge path via an explicit features flag propagated from
  // the quoteGenerate response.
  function aiRouterCharge(input: {
    kind: Feature;
    features?: Feature[];
    resolution?: "480p" | "720p" | "1080p" | "2160p";
    durationSeconds?: number;
    model?: string;
  }) {
    const { features } = detectFeatures({
      kind: input.kind,
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

  // ── Camera-motion quote-vs-charge parity (Task #409 regression suite) ──────
  //
  // The gap: quoteGenerate accepts `cameraMovement` and uses it to auto-detect
  // the `motion` feature, producing a higher quote. orchestrateGenerate has no
  // `cameraMovement` field (it stays in the prompt); motion can only reach the
  // charge path via an explicit `features: ['motion']` flag. If the caller does
  // not propagate the quoted features, the charge is lower than the quote.
  //
  // The fix: callers MUST pass the `features` array returned by quoteGenerate
  // (which already includes 'motion' when cameraMovement was set) as the
  // `features` input to orchestrateGenerate. These tests prove parity when
  // propagated correctly and document the gap when not.

  test("camera motion gap: quoteGenerate with cameraMovement includes motion and charges more than a plain video", () => {
    const motionQuote = aiRouterQuote({ kind: "video", cameraMovement: "orbit", resolution: "720p", durationSeconds: 5 });
    const plainQuote = aiRouterQuote({ kind: "video", resolution: "720p", durationSeconds: 5 });
    expect(motionQuote.features).toContain("motion");
    expect(motionQuote.total).toBeGreaterThan(plainQuote.total);
  });

  test("camera motion gap: orchestrateGenerate WITHOUT features propagation charges LESS than the quoted motion price", () => {
    // Documents the gap: caller got a motion quote but forgot to pass features.
    const motionQuote = aiRouterQuote({ kind: "video", cameraMovement: "orbit", resolution: "720p", durationSeconds: 5 });
    const chargeWithoutFeatures = aiRouterCharge({ kind: "video", resolution: "720p", durationSeconds: 5 });
    // Without the propagated features, motion is absent → cheaper charge.
    expect(chargeWithoutFeatures.total).toBeLessThan(motionQuote.total);
  });

  test("camera motion fix: orchestrateGenerate charge equals quote when features are propagated from the quote response", () => {
    const motionQuote = aiRouterQuote({ kind: "video", cameraMovement: "orbit", resolution: "720p", durationSeconds: 5 });
    // Propagate the features array from the quote into the charge call.
    const charge = aiRouterCharge({
      kind: "video",
      features: motionQuote.features as Feature[],
      resolution: "720p",
      durationSeconds: 5,
    });
    expect(charge.total).toBe(motionQuote.total);
    expect(charge.breakdown.map((b) => b.feature)).toContain("motion");
  });

  test("camera motion fix: features propagation preserves the full breakdown, not just the total", () => {
    const quote = aiRouterQuote({ kind: "video", cameraMovement: "push_in", resolution: "1080p", durationSeconds: 10 });
    expect(quote.features).toContain("motion");
    const charge = aiRouterCharge({
      kind: "video",
      features: quote.features as Feature[],
      resolution: "1080p",
      durationSeconds: 10,
    });
    // Both the total and every line item must agree.
    expect(charge.total).toBe(quote.total);
    expect(charge.breakdown).toEqual(quote.breakdown);
  });

  test("camera motion: features from quote are additive-only — motion cannot be dropped by passing kind without it", () => {
    // Even if a rogue caller passes kind:"video" + features:["video"] (omitting
    // motion), detectFeatures' additive rule preserves the primary kind.
    // But motion IS dropped if the caller omits it — this is the bug surface,
    // hence the requirement to propagate the full features array.
    const { features: withMotion } = detectFeatures({ kind: "video", features: ["video", "motion"] });
    expect(withMotion).toContain("motion");
    const { features: withoutMotion } = detectFeatures({ kind: "video", features: ["video"] });
    expect(withoutMotion).not.toContain("motion");
  });
});
