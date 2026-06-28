import { describe, expect, it } from "bun:test";
import { computeCost, detectFeatures, PRICING, type Feature } from "./pricing";

// Pricing is the single source of truth shared by the public API, the AI Router
// server fn, and the UI preview — so a preview can never disagree with the
// charge. These tests pin the model: stacking sums, resolution + length
// multipliers, round-up/min-1, and the canonical 39-Aura worked example.
describe("computeCost — single-feature defaults stay unchanged", () => {
  it("keeps the historical flat prices at baseline resolution/length", () => {
    expect(computeCost({ features: ["image"] }).total).toBe(1);
    expect(computeCost({ features: ["upscale"] }).total).toBe(1);
    expect(computeCost({ features: ["text"] }).total).toBe(1);
    expect(computeCost({ features: ["audio"] }).total).toBe(2);
    expect(computeCost({ features: ["video"], resolution: "720p", durationSeconds: 5 }).total).toBe(
      5,
    );
    expect(computeCost({ features: ["lipsync"], durationSeconds: 5 }).total).toBe(3);
  });

  it("defaults missing resolution to 720p and missing duration to the reference", () => {
    const q = computeCost({ features: ["video"] });
    expect(q.resolution).toBe("720p");
    expect(q.durationSeconds).toBe(PRICING.referenceSeconds);
    expect(q.total).toBe(5);
  });
});

describe("computeCost — resolution multiplier", () => {
  it("scales a standalone image by resolution", () => {
    expect(computeCost({ features: ["image"], resolution: "480p" }).total).toBe(1); // 0.5 → ceil 1
    expect(computeCost({ features: ["image"], resolution: "720p" }).total).toBe(1);
    expect(computeCost({ features: ["image"], resolution: "1080p" }).total).toBe(2);
  });

  it("scales video by resolution", () => {
    expect(computeCost({ features: ["video"], resolution: "1080p", durationSeconds: 5 }).total).toBe(
      10,
    );
    expect(computeCost({ features: ["video"], resolution: "480p", durationSeconds: 5 }).total).toBe(
      3,
    ); // 2.5 → ceil 3
  });

  it("does NOT scale a source image when a temporal output is in the stack", () => {
    // image is a reference input under a video → billed at base 1, not 2.
    const q = computeCost({ features: ["image", "video"], resolution: "1080p", durationSeconds: 5 });
    const image = q.breakdown.find((b) => b.feature === "image")!;
    expect(image.resolutionFactor).toBe(1);
    expect(image.subtotal).toBe(1);
    // video: 5 × 2 = 10 → total 11
    expect(q.total).toBe(11);
  });
});

describe("computeCost — length multiplier", () => {
  it("doubles time-based features at 10s vs 5s", () => {
    expect(computeCost({ features: ["video"], durationSeconds: 10 }).total).toBe(10);
    expect(computeCost({ features: ["lipsync"], durationSeconds: 10 }).total).toBe(6);
    expect(computeCost({ features: ["motion"], durationSeconds: 10 }).total).toBe(6);
  });

  it("does not apply length to non-temporal features", () => {
    const q = computeCost({ features: ["image"], durationSeconds: 10 });
    expect(q.breakdown[0].lengthFactor).toBe(1);
    expect(q.total).toBe(1);
  });
});

describe("computeCost — rounding & stacking", () => {
  it("rounds the total UP and never charges 0 for a real generation", () => {
    expect(computeCost({ features: ["image"], resolution: "480p" }).total).toBe(1);
    expect(computeCost({ features: [] }).total).toBe(0); // nothing requested
  });

  it("sums each active feature when stacked", () => {
    // image + audio at baseline = 1 + 2 = 3
    expect(computeCost({ features: ["image", "audio"] }).total).toBe(3);
  });

  it("matches the canonical 39-Aura worked example", () => {
    // image + video + lip-sync + motion control, 1080p, 10s
    const q = computeCost({
      features: ["image", "video", "lipsync", "motion"],
      resolution: "1080p",
      durationSeconds: 10,
    });
    const by = Object.fromEntries(q.breakdown.map((b) => [b.feature, b.subtotal]));
    expect(by.image).toBe(1); // base only (source image under a video)
    expect(by.video).toBe(20); // 5 × 2 × 2
    expect(by.lipsync).toBe(6); // 3 × 2 (length)
    expect(by.motion).toBe(12); // 3 × 2 × 2
    expect(q.total).toBe(39);
  });

  it("returns the breakdown in canonical feature order", () => {
    const q = computeCost({ features: ["motion", "video", "image"] });
    expect(q.breakdown.map((b) => b.feature)).toEqual(["image", "video", "motion"]);
  });
});

describe("detectFeatures — conservative, deterministic", () => {
  it("returns just the primary feature for a plain request", () => {
    expect(detectFeatures({ kind: "image" }).features).toEqual(["image"]);
    expect(detectFeatures({ kind: "video" }).features).toEqual(["video"]);
    expect(detectFeatures({ kind: "lipsync" }).features).toEqual(["lipsync"]);
  });

  it("does not over-detect from an incidental driving audio alone", () => {
    expect(detectFeatures({ kind: "video", audioUrl: "https://x/a.mp3" }).features).toEqual([
      "video",
    ]);
  });

  it("adds the motion-control add-on when a camera preset is supplied to a video", () => {
    expect(
      detectFeatures({ kind: "video", cameraMovement: "orbit" }).features,
    ).toEqual(["video", "motion"]);
    // but not on a non-video primary
    expect(detectFeatures({ kind: "image", cameraMovement: "orbit" }).features).toEqual(["image"]);
  });

  it("adds lip-sync only for an unambiguous audio+video pair", () => {
    expect(
      detectFeatures({
        kind: "video",
        audioUrl: "https://x/a.mp3",
        videoUrl: "https://x/v.mp4",
      }).features,
    ).toEqual(["video", "lipsync"]);
  });

  it("applies an explicit features override (additive, canonical order)", () => {
    const forced: Feature[] = ["motion", "lipsync", "video", "image"];
    expect(detectFeatures({ kind: "video", features: forced }).features).toEqual([
      "image",
      "video",
      "lipsync",
      "motion",
    ]);
  });

  it("override is additive only — the primary kind is always billed (no undercharge)", () => {
    // A caller submitting a video but forcing features:["image"] must still be
    // charged for the video they actually run, not 1 Aura.
    const { features } = detectFeatures({ kind: "video", features: ["image"] });
    expect(features).toEqual(["image", "video"]);
    const total = computeCost({ features, resolution: "720p", durationSeconds: 5 }).total;
    expect(total).toBe(6); // image(1) + video(5) — strictly more than video-only's 5
  });
});
