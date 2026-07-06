import { describe, expect, it } from "bun:test";
import { estimateFromParams } from "./estimate";

// GET /api/estimate is a pure, side-effect-free quote — no auth, no credit
// reservation, no DB writes. These tests pin its request→quote mapping so it
// can never silently drift from the pricing module it wraps (computeCost /
// detectFeatures), which is exactly what a "Render Full Quality" server
// round-trip is supposed to guarantee.
describe("estimateFromParams", () => {
  it("quotes a plain image request using the historical flat price", () => {
    const result = estimateFromParams({ kind: "image" });
    expect(result.credits).toBe(1);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].feature).toBe("image");
    expect(result.primaryKind).toBe("image");
  });

  it("scales a video quote by resolution and duration, model-tiered", () => {
    const result = estimateFromParams({
      kind: "video",
      resolution: "1080p",
      duration: "10",
      model: "kling-3.0",
    });
    // kling-3.0 is "ultra" tier (24 Aura @ 5s/720p) × 2 (1080p) × 2 (10s/5s ref).
    expect(result.credits).toBe(96);
    expect(result.resolution).toBe("1080p");
    expect(result.durationSeconds).toBe(10);
  });

  it("falls back to the default (budget) video tier when no model is given", () => {
    const result = estimateFromParams({ kind: "video" });
    expect(result.credits).toBe(5);
  });

  it("never returns a different total than computeCost would for the same inputs", async () => {
    const { computeCost, detectFeatures } = await import("@/lib/pricing");
    const { features } = detectFeatures({ kind: "lipsync" });
    const direct = computeCost({ features, resolution: "720p", durationSeconds: 8, model: "sync/lipsync-2" });
    const viaEndpoint = estimateFromParams({
      kind: "lipsync",
      resolution: "720p",
      duration: "8",
      model: "sync/lipsync-2",
    });
    expect(viaEndpoint.credits).toBe(direct.total);
    expect(viaEndpoint.breakdown).toEqual(direct.breakdown);
  });

  it("additively applies a features override without dropping the primary kind", () => {
    const result = estimateFromParams({ kind: "video", features: "motion" });
    expect(result.features).toEqual(["video", "motion"]);
  });

  it("parses a comma-separated features query param", () => {
    const result = estimateFromParams({ kind: "text", features: "text,audio" });
    expect(result.features).toEqual(["text", "audio"]);
  });

  it("rejects an unknown kind rather than silently defaulting", () => {
    expect(() => estimateFromParams({ kind: "not-a-kind" })).toThrow();
  });

  it("rejects a missing kind", () => {
    expect(() => estimateFromParams({})).toThrow();
  });

  it("never charges 0 for a real request (minimum 1)", () => {
    const result = estimateFromParams({ kind: "text" });
    expect(result.credits).toBeGreaterThanOrEqual(1);
  });
});
