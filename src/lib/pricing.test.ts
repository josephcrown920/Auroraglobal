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
  lipsyncEngineCost,
  XAI_UGC_RELIP_MODEL,
  AURA_VALUE_SCENARIOS,
  auraValueEstimate,
  tierForModel,
  type Feature,
  type LipsyncEngine,
} from "./pricing";
import { MODEL_REGISTRY, FALLBACK_MODELS } from "./orchestrator.server";
import { VIDEO_MODEL_LIST, LIPSYNC_MODEL_LIST } from "./models";

// Pricing is the single source of truth shared by the public API, the AI Router
// server fn, and the UI preview — so a preview can never disagree with the
// charge. These tests pin the model: stacking sums, resolution + length
// multipliers, round-up/min-1, and the canonical 770-Aura worked example.
// 2026-07-19 ×10 rebase: all Aura literals here are the post-rebase scale.
describe("computeCost — single-feature defaults stay unchanged", () => {
  it("keeps the historical flat prices at baseline resolution/length", () => {
    expect(computeCost({ features: ["image"] }).total).toBe(10);
    expect(computeCost({ features: ["upscale"] }).total).toBe(10);
    expect(computeCost({ features: ["text"] }).total).toBe(10);
    expect(computeCost({ features: ["audio"] }).total).toBe(20);
    // Video with no model defaults to the budget tier → 100 (×10 rebase).
    expect(computeCost({ features: ["video"], resolution: "720p", durationSeconds: 5 }).total).toBe(
      100,
    );
    // Budget-tier (self-hosted) lip-sync at the rebased flat 30.
    expect(
      computeCost({ features: ["lipsync"], durationSeconds: 5, model: "latentsync" }).total,
    ).toBe(30);
  });

  it("defaults missing resolution to 720p and missing duration to the reference", () => {
    const q = computeCost({ features: ["video"] });
    expect(q.resolution).toBe("720p");
    expect(q.durationSeconds).toBe(PRICING.referenceSeconds);
    expect(q.total).toBe(100);
  });
});

describe("computeCost — resolution multiplier", () => {
  it("scales a standalone image by resolution", () => {
    expect(computeCost({ features: ["image"], resolution: "480p" }).total).toBe(5); // 10 × 0.5
    expect(computeCost({ features: ["image"], resolution: "720p" }).total).toBe(10);
    expect(computeCost({ features: ["image"], resolution: "1080p" }).total).toBe(20);
  });

  it("scales video by resolution", () => {
    expect(computeCost({ features: ["video"], resolution: "1080p", durationSeconds: 5 }).total).toBe(
      200,
    );
    expect(computeCost({ features: ["video"], resolution: "480p", durationSeconds: 5 }).total).toBe(
      50,
    );
  });

  it("does NOT scale a source image when a temporal output is in the stack", () => {
    // image is a reference input under a video → billed at base 10, not 20.
    const q = computeCost({ features: ["image", "video"], resolution: "1080p", durationSeconds: 5 });
    const image = q.breakdown.find((b) => b.feature === "image")!;
    expect(image.resolutionFactor).toBe(1);
    expect(image.subtotal).toBe(10);
    // video: 100 × 2 = 200 → total 210
    expect(q.total).toBe(210);
  });
});

describe("computeCost — length multiplier", () => {
  it("doubles time-based features at 10s vs 5s", () => {
    expect(computeCost({ features: ["video"], durationSeconds: 10 }).total).toBe(200);
    // Budget-tier lip-sync (30) doubled at 10s.
    expect(
      computeCost({ features: ["lipsync"], durationSeconds: 10, model: "latentsync" }).total,
    ).toBe(60);
    expect(computeCost({ features: ["motion"], durationSeconds: 10 }).total).toBe(600);
  });

  it("does not apply length to non-temporal features", () => {
    const q = computeCost({ features: ["image"], durationSeconds: 10 });
    expect(q.breakdown[0].lengthFactor).toBe(1);
    expect(q.total).toBe(10);
  });
});

describe("computeCost — lyric_video (flat, non-length-scaled)", () => {
  it("charges the flat base cost regardless of song duration", () => {
    expect(computeCost({ features: ["lyric_video"] }).total).toBe(50);
    expect(computeCost({ features: ["lyric_video"], durationSeconds: 5 }).total).toBe(50);
    expect(computeCost({ features: ["lyric_video"], durationSeconds: 180 }).total).toBe(50);
  });

  it("is not scaled by resolution either (no visual resolution to bill)", () => {
    expect(computeCost({ features: ["lyric_video"], resolution: "1080p" }).total).toBe(50);
  });

  it("stacks additively with other features", () => {
    expect(computeCost({ features: ["lyric_video", "image"] }).total).toBe(60);
  });
});

describe("computeCost — rounding & stacking", () => {
  it("rounds the total UP and never charges 0 for a real generation", () => {
    expect(computeCost({ features: ["image"], resolution: "480p" }).total).toBe(5);
    expect(computeCost({ features: [] }).total).toBe(0); // nothing requested
  });

  it("sums each active feature when stacked", () => {
    // image + audio at baseline = 10 + 20 = 30
    expect(computeCost({ features: ["image", "audio"] }).total).toBe(30);
  });

  it("matches the canonical worked example with tiered defaults", () => {
    // image + video + lip-sync + motion control, 1080p, 10s, no model:
    // video → budget default (100), lip-sync add-on → premium default (90, the
    // real default lip-sync model). Resolution + length stack on top of tiers.
    const q = computeCost({
      features: ["image", "video", "lipsync", "motion"],
      resolution: "1080p",
      durationSeconds: 10,
    });
    const by = Object.fromEntries(q.breakdown.map((b) => [b.feature, b.subtotal]));
    expect(by.image).toBe(10); // base only (source image under a video)
    expect(by.video).toBe(400); // 100 (budget) × 2 × 2
    expect(by.lipsync).toBe(180); // 90 (premium default) × 2 (length)
    expect(by.motion).toBe(1200); // 300 × 2 × 2
    expect(q.total).toBe(1790);
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
    // image(10) + video(400) + motion(300×2×2=1200) + lipsync(30×2=60) = 1670
    expect(video.total + lip.total).toBe(1670);
  });

  it("returns the breakdown in canonical feature order", () => {
    const q = computeCost({ features: ["motion", "video", "image"] });
    expect(q.breakdown.map((b) => b.feature)).toEqual(["image", "video", "motion"]);
  });
});

describe("Aura value scenarios", () => {
  it("prices a complete Perform Anywhere render as video plus motion", () => {
    const performance = AURA_VALUE_SCENARIOS.find((scenario) => scenario.id === "performance")!;
    const payablePerformanceShot = computeCost({
      features: ["video", "motion"],
      resolution: "720p",
      durationSeconds: 5,
    }).total;

    expect(performance.cost()).toBe(payablePerformanceShot);
    expect(auraValueEstimate(300, "performance")).toEqual({ cost: payablePerformanceShot, count: 0 });
    expect(auraValueEstimate(400, "performance")).toEqual({ cost: payablePerformanceShot, count: 1 });
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
    // charged for the video they actually run, not 10 Aura.
    const { features } = detectFeatures({ kind: "video", features: ["image"] });
    expect(features).toEqual(["image", "video"]);
    const total = computeCost({ features, resolution: "720p", durationSeconds: 5 }).total;
    expect(total).toBe(110); // image(10) + video(100) — strictly more than video-only's 100
  });
});

// ─── Motion repricing assertions ─────────────────────────────────────────────
describe("motion pricing (×10 rebase) — base = 300", () => {
  it("PRICING.base.motion is 300", () => {
    expect(PRICING.base.motion).toBe(300);
  });

  it("Transfer Motion (motion only, 720p/5s) = 300 Aura", () => {
    expect(computeCost({ features: ["motion"], resolution: "720p", durationSeconds: 5 }).total).toBe(300);
  });

  it("Performance Shot (budget video + motion, 720p/5s) = 400 Aura", () => {
    expect(computeCost({ features: ["video", "motion"], resolution: "720p", durationSeconds: 5 }).total).toBe(400);
  });

  it("lipsync UI price equals server charge for every engine", () => {
    // lipsyncEngineCost is THE shared source for the /lipsync UI quote AND the
    // lipsync.server.ts charge, so parity holds by construction — this test pins
    // the expected Aura per engine so a tier/model change can't slip through.
    const expectedByEngine: Record<string, number> = {
      "sync-v2": LIPSYNC_TIER_AURA.premium, // 90 Aura
      "wav2lip": LIPSYNC_TIER_AURA.standard, // 60 Aura
      "latentsync": LIPSYNC_TIER_AURA.budget, // 30 Aura
      // xai-ugc is a TWO-stage chain: xAI video (standard video tier, 200) +
      // mandatory relip to the user's audio (premium lipsync, 90) = 290 Aura.
      // Covers real cost ~$0.60 (xAI ~$0.30 + Sync.so ~$0.30).
      "xai-ugc": VIDEO_TIER_AURA.standard + LIPSYNC_TIER_AURA.premium,
      // heygen-photo: single-stage photo→talking-head via HeyGen's own audio-driven
      // API (no relip stage) — priced at the ultra lipsync tier (100 Aura).
      "heygen-photo": LIPSYNC_TIER_AURA.ultra,
    };
    for (const engine of Object.keys(LIPSYNC_ENGINE_MODEL) as LipsyncEngine[]) {
      expect(lipsyncEngineCost(engine), `engine "${engine}"`).toBe(expectedByEngine[engine]);
    }
  });

  it("xai-ugc two-stage price decomposes as video(xai) + lipsync(relip model)", () => {
    const video = computeCost({
      features: ["video"],
      model: LIPSYNC_ENGINE_MODEL["xai-ugc"],
    }).total;
    const relip = computeCost({ features: ["lipsync"], model: XAI_UGC_RELIP_MODEL }).total;
    expect(lipsyncEngineCost("xai-ugc")).toBe(video + relip);
  });
});

// ─── Model-tiered video & lip-sync pricing ───────────────────────────────────
// Premium models cost the Aura their real provider cost warrants; cheap models
// stay cheap. After the 2026-07-19 ×10 rebase the funding pool covers
// ≈ $0.0047 per Aura sold (Aura amounts ×10, USD prices unchanged).
const POOL_PER_AURA = 0.0047;

describe("computeCost — model tiers", () => {
  it("cheap/self-hosted models sit at the budget tier at the reference", () => {
    // Budget video = Seedance Lite, 100 Aura at 720p/5s (×10 rebase).
    expect(
      computeCost({ features: ["video"], model: "seedance-2.0-fast", durationSeconds: 5 }).total,
    ).toBe(100);
    // Budget lip-sync = self-hosted LatentSync, 30 Aura at 5s.
    expect(
      computeCost({ features: ["lipsync"], model: "latentsync", durationSeconds: 5 }).total,
    ).toBe(30);
  });

  it("premium/ultra video models cost proportionally more than budget", () => {
    const budget = computeCost({ features: ["video"], model: "seedance-2.0-fast" }).total;
    const standard = computeCost({ features: ["video"], model: "kling-v1" }).total;
    const premium = computeCost({ features: ["video"], model: "veo-3-fast" }).total;
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
    // Unknown video model → budget default (100). Unknown lip-sync → premium default (90).
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
    // Ultra video (480) at 1080p (×2) and 10s (×2) = 1920.
    expect(
      computeCost({
        features: ["video"],
        model: "seedance-2.0",
        resolution: "1080p",
        durationSeconds: 10,
      }).total,
    ).toBe(1920);
    // Premium lip-sync (90) at 10s (×2) = 180 (resolution never applies to lip-sync).
    expect(
      computeCost({
        features: ["lipsync"],
        model: "sync/lipsync-2",
        resolution: "1080p",
        durationSeconds: 10,
      }).total,
    ).toBe(180);
  });

  it("preview / reserve / charge agree for the same model request", () => {
    const req = {
      features: ["video"] as Feature[],
      model: "kling-3.0",
      resolution: "720p" as const,
      durationSeconds: 8,
    };
    expect(computeCost(req).total).toBe(computeCost(req).total);
    // kling-3.0 is ultra (480) × 8/5 length = 768 exactly.
    expect(computeCost(req).total).toBe(768);
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

  // The two "every registry model is tiered" tests above only see models that
  // ARE in MODEL_REGISTRY. A model added straight to FALLBACK_MODELS (what the
  // orchestrator actually dispatches) but never added to MODEL_REGISTRY would
  // silently evade both the tier guard AND cost tracking. Close that loophole
  // by asserting every dispatchable video/lipsync candidate is registered.
  it("every video/lipsync fallback candidate is registered in MODEL_REGISTRY", () => {
    for (const model of FALLBACK_MODELS.video) {
      expect(MODEL_REGISTRY[model], `video fallback candidate ${model} missing from MODEL_REGISTRY`).toBeDefined();
      expect(MODEL_REGISTRY[model].kind, `video fallback candidate ${model} has wrong kind`).toBe("video");
    }
    for (const model of FALLBACK_MODELS.lipsync) {
      expect(MODEL_REGISTRY[model], `lipsync fallback candidate ${model} missing from MODEL_REGISTRY`).toBeDefined();
      expect(MODEL_REGISTRY[model].kind, `lipsync fallback candidate ${model} has wrong kind`).toBe("lipsync");
    }
  });
});
