import { describe, expect, it } from "bun:test";
import {
  computeCost,
  detectFeatures,
  PRICING,
  VIDEO_TIER_AURA,
  LIPSYNC_TIER_AURA,
  VIDEO_MODEL_TIERS,
  LIPSYNC_MODEL_TIERS,
  LIPSYNC_ENGINE_MODEL,
  tierForModel,
  type Feature,
} from "./pricing";
import { MODEL_REGISTRY } from "./orchestrator.server";
import { VIDEO_MODEL_LIST, LIPSYNC_MODEL_LIST } from "./models";

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
    // Video with no model defaults to the budget tier → historical flat 5.
    expect(computeCost({ features: ["video"], resolution: "720p", durationSeconds: 5 }).total).toBe(
      5,
    );
    // Budget-tier (self-hosted) lip-sync keeps the historical flat 3.
    expect(
      computeCost({ features: ["lipsync"], durationSeconds: 5, model: "latentsync" }).total,
    ).toBe(3);
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
    // Budget-tier lip-sync (3) doubled at 10s.
    expect(
      computeCost({ features: ["lipsync"], durationSeconds: 10, model: "latentsync" }).total,
    ).toBe(6);
    expect(computeCost({ features: ["motion"], durationSeconds: 10 }).total).toBe(30);
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

  it("matches the canonical worked example with tiered defaults", () => {
    // image + video + lip-sync + motion control, 1080p, 10s, no model:
    // video → budget default (5), lip-sync add-on → premium default (9, the
    // real default lip-sync model). Resolution + length stack on top of tiers.
    const q = computeCost({
      features: ["image", "video", "lipsync", "motion"],
      resolution: "1080p",
      durationSeconds: 10,
    });
    const by = Object.fromEntries(q.breakdown.map((b) => [b.feature, b.subtotal]));
    expect(by.image).toBe(1); // base only (source image under a video)
    expect(by.video).toBe(20); // 5 (budget) × 2 × 2
    expect(by.lipsync).toBe(18); // 9 (premium default) × 2 (length)
    expect(by.motion).toBe(60); // 15 × 2 × 2
    expect(q.total).toBe(99);
  });

  it("budget-tier video + motion + lip-sync stacks correctly at 1080p/10s", () => {
    // (Lip-sync's tier is resolved from its own default; a self-hosted video
    // model leaves lip-sync at the premium default, so price each separately.)
    const video = computeCost({
      features: ["image", "video", "motion"],
      resolution: "1080p",
      durationSeconds: 10,
      model: "seedance-2.0-fast",
    });
    const lip = computeCost({
      features: ["lipsync"],
      durationSeconds: 10,
      model: "latentsync",
    });
    // image(1) + video(20) + motion(15×2×2=60) + lipsync(3×2=6) = 87
    expect(video.total + lip.total).toBe(87);
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

// ─── Motion repricing assertions ─────────────────────────────────────────────
describe("motion repricing — new base = 15", () => {
  it("PRICING.base.motion is 15", () => {
    expect(PRICING.base.motion).toBe(15);
  });

  it("Transfer Motion (motion only, 720p/5s) = 15 Aura", () => {
    expect(computeCost({ features: ["motion"], resolution: "720p", durationSeconds: 5 }).total).toBe(15);
  });

  it("Performance Shot (budget video + motion, 720p/5s) = 20 Aura", () => {
    expect(computeCost({ features: ["video", "motion"], resolution: "720p", durationSeconds: 5 }).total).toBe(20);
  });

  it("lipsync UI price equals server charge for all three engines", () => {
    // LIPSYNC_ENGINE_MODEL maps each UI engine key to the same model string that
    // lipsync.server.ts MODEL uses, so both call computeCost with the same model
    // and must produce the same Aura total. This verifies the mapping is correct
    // and that each engine resolves to the expected tier.
    const expectedByModel: Record<string, number> = {
      "fal-ai/sync-lipsync/v2": LIPSYNC_TIER_AURA.premium,  // sync-v2 → 9 Aura
      "fal-ai/wav2lip": LIPSYNC_TIER_AURA.standard,          // wav2lip → 6 Aura
      "latentsync": LIPSYNC_TIER_AURA.budget,                // latentsync → 3 Aura
    };
    for (const [engine, model] of Object.entries(LIPSYNC_ENGINE_MODEL)) {
      const uiCost = computeCost({ features: ["lipsync"], model }).total;
      expect(uiCost, `engine "${engine}" model "${model}"`).toBe(expectedByModel[model]);
    }
  });
});

// ─── Model-tiered video & lip-sync pricing ───────────────────────────────────
// Premium models cost the Aura their real provider cost warrants; cheap models
// stay cheap. The funding pool covers ≈ $0.047 per Aura sold.
const POOL_PER_AURA = 0.047;

describe("computeCost — model tiers", () => {
  it("cheap/self-hosted models keep (near) today's price at the reference", () => {
    // Budget video = Seedance Lite, still 5 Aura at 720p/5s.
    expect(
      computeCost({ features: ["video"], model: "seedance-2.0-fast", durationSeconds: 5 }).total,
    ).toBe(5);
    // Budget lip-sync = self-hosted LatentSync, still 3 Aura at 5s.
    expect(
      computeCost({ features: ["lipsync"], model: "latentsync", durationSeconds: 5 }).total,
    ).toBe(3);
  });

  it("premium/ultra video models cost proportionally more than budget", () => {
    const budget = computeCost({ features: ["video"], model: "seedance-2.0-fast" }).total;
    const standard = computeCost({ features: ["video"], model: "kling-v1" }).total;
    const premium = computeCost({ features: ["video"], model: "wan-2.5" }).total;
    const ultra = computeCost({ features: ["video"], model: "seedance-2.0" }).total;
    expect(budget).toBeLessThan(standard);
    expect(standard).toBeLessThan(premium);
    expect(premium).toBeLessThan(ultra);
    expect(ultra).toBe(VIDEO_TIER_AURA.ultra);
  });

  it("premium/ultra lip-sync models cost more than budget", () => {
    const budget = computeCost({ features: ["lipsync"], model: "latentsync" }).total;
    const premium = computeCost({ features: ["lipsync"], model: "sync/lipsync-2" }).total;
    const ultra = computeCost({ features: ["lipsync"], model: "heygen/lipsync" }).total;
    expect(budget).toBeLessThan(premium);
    expect(premium).toBeLessThanOrEqual(ultra);
    expect(ultra).toBe(LIPSYNC_TIER_AURA.ultra);
  });

  it("an unknown / missing model falls back to the default tier", () => {
    // Unknown video model → budget default (5). Unknown lip-sync → premium default (9).
    expect(computeCost({ features: ["video"], model: "nope/does-not-exist" }).total).toBe(
      VIDEO_TIER_AURA.budget,
    );
    expect(computeCost({ features: ["video"] }).total).toBe(VIDEO_TIER_AURA.budget);
    expect(computeCost({ features: ["lipsync"], model: "nope/does-not-exist" }).total).toBe(
      LIPSYNC_TIER_AURA.premium,
    );
    expect(computeCost({ features: ["lipsync"] }).total).toBe(LIPSYNC_TIER_AURA.premium);
    expect(tierForModel("video", null)).toBe("budget");
    expect(tierForModel("lipsync", null)).toBe("premium");
  });

  it("resolution and length multipliers stack on top of the tier", () => {
    // Ultra video (24) at 1080p (×2) and 10s (×2) = 96.
    expect(
      computeCost({
        features: ["video"],
        model: "seedance-2.0",
        resolution: "1080p",
        durationSeconds: 10,
      }).total,
    ).toBe(96);
    // Premium lip-sync (9) at 10s (×2) = 18 (resolution never applies to lip-sync).
    expect(
      computeCost({
        features: ["lipsync"],
        model: "sync/lipsync-2",
        resolution: "1080p",
        durationSeconds: 10,
      }).total,
    ).toBe(18);
  });

  it("preview / reserve / charge agree for the same model request", () => {
    const req = {
      features: ["video"] as Feature[],
      model: "kling-3.0",
      resolution: "720p" as const,
      durationSeconds: 8,
    };
    expect(computeCost(req).total).toBe(computeCost(req).total);
    // kling-3.0 is ultra (24) × 8/5 length = 38.4 → ceil 39.
    expect(computeCost(req).total).toBe(39);
  });
});

// Margin guard: every tiered model's Aura must cover its real registry cost with
// a safety buffer, so no render in the registry loses money. This is what stops
// the model→tier table in pricing.ts from silently drifting below the registry.
describe("model tiers cover real provider cost (margin guard)", () => {
  const RETRY_BUFFER = 1.15; // pool must beat (cost × buffer) for retries/fallback.

  it("every registry video model is tiered and funds its provider cost", () => {
    for (const [model, entry] of Object.entries(MODEL_REGISTRY)) {
      if (entry.kind !== "video") continue;
      const tier = VIDEO_MODEL_TIERS[model];
      expect(tier, `video model ${model} must be in VIDEO_MODEL_TIERS`).toBeDefined();
      const aura = VIDEO_TIER_AURA[tier];
      const pool = aura * POOL_PER_AURA;
      expect(
        pool,
        `video ${model} ($${entry.cost}) tier ${tier} pool $${pool.toFixed(3)} < cost×buffer`,
      ).toBeGreaterThanOrEqual(entry.cost * RETRY_BUFFER);
    }
  });

  it("every registry lip-sync model is tiered and funds its provider cost", () => {
    for (const [model, entry] of Object.entries(MODEL_REGISTRY)) {
      if (entry.kind !== "lipsync") continue;
      const tier = LIPSYNC_MODEL_TIERS[model];
      expect(tier, `lipsync model ${model} must be in LIPSYNC_MODEL_TIERS`).toBeDefined();
      const aura = LIPSYNC_TIER_AURA[tier];
      const pool = aura * POOL_PER_AURA;
      expect(
        pool,
        `lipsync ${model} ($${entry.cost}) tier ${tier} pool $${pool.toFixed(3)} < cost×buffer`,
      ).toBeGreaterThanOrEqual(entry.cost * RETRY_BUFFER);
    }
  });

  it("every model offered in a UI picker is tiered (no silent fall-through to default)", () => {
    for (const m of VIDEO_MODEL_LIST) {
      expect(VIDEO_MODEL_TIERS[m.value], `video picker model ${m.value} missing a tier`).toBeDefined();
    }
    for (const m of LIPSYNC_MODEL_LIST) {
      expect(
        LIPSYNC_MODEL_TIERS[m.value],
        `lip-sync picker model ${m.value} missing a tier`,
      ).toBeDefined();
    }
  });

  it("the default tiers cover the orchestrator's default model for each kind", () => {
    // The default model that actually runs when none is supplied must be funded.
    const defVideo = MODEL_REGISTRY["seedance-2.0-fast"];
    const defLip = MODEL_REGISTRY["fal-ai/sync-lipsync/v2"];
    expect(VIDEO_TIER_AURA.budget * POOL_PER_AURA).toBeGreaterThanOrEqual(defVideo.cost);
    expect(LIPSYNC_TIER_AURA.premium * POOL_PER_AURA).toBeGreaterThanOrEqual(defLip.cost);
  });
});
