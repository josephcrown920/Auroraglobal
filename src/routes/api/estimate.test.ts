import { describe, expect, it } from "bun:test";
import { estimateFromParams, checkGuardrails } from "./estimate";

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
    // kling-3.0 is "ultra" tier (48 Aura @ 5s/720p) × 2 (1080p) × 2 (10s/5s ref).
    expect(result.credits).toBe(192);
    expect(result.resolution).toBe("1080p");
    expect(result.durationSeconds).toBe(10);
  });

  it("falls back to the default (budget) video tier when no model is given", () => {
    const result = estimateFromParams({ kind: "video" });
    expect(result.credits).toBe(10);
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

  // Duration bounds must exactly match the executable charge paths
  // (OrchestrateSchema in orchestration.functions.ts, Schema in
  // api/public/generate.ts: both min(3).max(15)) — a quote for a length the
  // render path would reject is a divergence, which is the exact bug class
  // Task #177 exists to close.
  it("rejects a duration below the shared 3s floor", () => {
    expect(() => estimateFromParams({ kind: "video", duration: "1" })).toThrow();
  });

  it("rejects a duration above the shared 15s ceiling (even for Pro)", () => {
    expect(() => estimateFromParams({ kind: "video", duration: "20" }, "pro")).toThrow();
  });

  it("does not block when no tier is supplied (unauthenticated caller)", () => {
    const result = estimateFromParams({ kind: "video", duration: "12" });
    expect(result.blocked).toBeNull();
  });

  it("blocks a Free-tier quote for a duration only Pro can render", () => {
    const result = estimateFromParams({ kind: "video", duration: "12" }, "free");
    expect(result.blocked?.message).toMatch(/Unsupported duration/);
  });

  it("allows a Pro-tier quote for the same duration a Free tier would block", () => {
    const result = estimateFromParams({ kind: "video", duration: "12" }, "pro");
    expect(result.blocked).toBeNull();
  });

  it("blocks a Free-tier quote for HD resolution", () => {
    const result = estimateFromParams({ kind: "video", resolution: "1080p" }, "free");
    expect(result.blocked?.message).toMatch(/Unsupported resolution/);
  });

  it("allows a Pro-tier quote for HD resolution", () => {
    const result = estimateFromParams({ kind: "video", resolution: "1080p" }, "pro");
    expect(result.blocked).toBeNull();
  });

  it("does not apply the duration cap to non-temporal kinds (e.g. lipsync has its own model-based cost, not the video cap)", () => {
    const result = checkGuardrails("free", 12, undefined, false);
    expect(result).toBeNull();
  });

  it("checkGuardrails matches assertDurationCap's exact terminal message text", async () => {
    const { durationCapMessage } = await import("@/lib/billing.plans");
    const expected = durationCapMessage("free", 12);
    const result = checkGuardrails("free", 12, undefined, true);
    expect(result?.message).toBe(expected);
  });
});
