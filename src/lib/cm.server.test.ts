import { describe, expect, it } from "bun:test";
import {
  COST_PER_VIDEO,
  MAX_BATCH_VIDEOS,
  batchItemCount,
  batchEstimate,
  buildContentMachinePayload,
} from "./cm.server";
import { COST_UGC_AD } from "./ugc.server";

describe("content machine cost source", () => {
  it("stays DELIBERATELY cheaper than the avatar UGC ad price", () => {
    // Since the voice-lock upgrade, COST_UGC_AD (28) covers the avatar-only
    // xAI talking-head + mandatory relip chain. Faceless Content Machine videos
    // never run that chain (no avatarImageUrl → no xAI fast path), so they keep
    // the historical cheaper flat price. This guard documents the decoupling —
    // if COST_PER_VIDEO ever meets or exceeds the avatar price, re-check both.
    expect(COST_PER_VIDEO).toBe(16);
    expect(COST_PER_VIDEO).toBeLessThan(COST_UGC_AD);
  });
});

describe("content machine batch estimate", () => {
  it("counts items as templates × videos-per-template", () => {
    expect(batchItemCount(3, 4)).toBe(12);
    expect(batchItemCount(1, 1)).toBe(1);
    expect(batchItemCount(2, 0)).toBe(0);
  });

  it("estimates credits at the flat per-video reservation (preview == charge)", () => {
    const e = batchEstimate(3, 2);
    expect(e.totalItems).toBe(6);
    expect(e.creditsPerVideo).toBe(COST_PER_VIDEO);
    expect(e.totalCredits).toBe(6 * COST_PER_VIDEO);
    expect(e.overCap).toBe(false);
  });

  it("flags batches over the hard cap", () => {
    expect(batchEstimate(MAX_BATCH_VIDEOS + 1, 1).overCap).toBe(true);
    expect(batchEstimate(MAX_BATCH_VIDEOS, 1).overCap).toBe(false);
  });
});

describe("buildContentMachinePayload", () => {
  const product = {
    name: "GlowSerum",
    description: "a vitamin-C face serum",
    brandVoice: "warm and confident",
    audience: "skincare beginners",
    cta: "Tap the link",
  };
  const template = {
    name: "Honest review",
    sceneHint: "close-up in soft window light",
    motionHint: "slow push-in",
    scriptFormula: "problem -> result -> CTA",
    aspect: "9:16",
    duration: 8,
  };

  it("folds product + template into one faceless payload", () => {
    const p = buildContentMachinePayload({ product, template });
    expect(p.productPrompt).toContain("GlowSerum");
    expect(p.productPrompt).toContain("vitamin-C");
    expect(p.productPrompt).toContain("Call to action: Tap the link");
    expect(p.sceneHint).toContain("close-up");
    expect(p.sceneHint).toContain("Script approach: problem -> result -> CTA");
    expect(p.sceneHint).toContain("Brand voice: warm and confident");
    expect(p.sceneHint).toContain("Audience: skincare beginners");
    expect(p.sceneName).toBe("Honest review: slow push-in");
    expect(p.aspect).toBe("9:16");
    expect(p.duration).toBe(8);
    // Faceless: the payload never carries an avatar.
    expect(p).not.toHaveProperty("avatarImageUrl");
    expect(p).not.toHaveProperty("avatarName");
  });

  it("clamps duration to the worker's 3-12s range and defaults the aspect", () => {
    expect(buildContentMachinePayload({ product, template: { ...template, duration: 20 } }).duration).toBe(12);
    expect(buildContentMachinePayload({ product, template: { ...template, duration: 1 } }).duration).toBe(3);
    expect(buildContentMachinePayload({ product, template: { ...template, aspect: null } }).aspect).toBe("9:16");
  });

  it("falls back to the product name with no description, CTA or motion", () => {
    const p = buildContentMachinePayload({
      product: { name: "JustName" },
      template: { name: "Plain", sceneHint: "scene" },
    });
    expect(p.productPrompt).toBe("JustName");
    expect(p.sceneName).toBe("Plain");
    expect(p.sceneHint).toBe("scene");
  });
});
