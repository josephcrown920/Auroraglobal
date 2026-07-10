import { describe, expect, test } from "bun:test";
import { creditCost } from "./jobs.functions";
import { COST_IMAGE } from "./studio.functions";
import { computeCost, type Feature } from "./pricing";

// Task #65: jobs.functions.ts and studio.functions.ts must never keep their
// own literal price tables — every number they charge has to trace back to
// the shared price list in pricing.ts, or a repricing there silently drifts
// out of sync with what these two paths actually reserve/charge.
describe("jobs.functions/studio.functions pricing parity", () => {
  const kinds: Feature[] = ["image", "video", "lipsync", "upscale"];

  test("creditCost(kind) matches the shared computeCost default for every enqueueable kind", () => {
    for (const kind of kinds) {
      expect(creditCost(kind)).toBe(computeCost({ features: [kind] }).total);
    }
  });

  test("creditCost honors model/resolution/duration overrides identically to computeCost", () => {
    expect(
      creditCost("video", { model: "kling-2.1", resolution: "1080p", durationSeconds: 10 }),
    ).toBe(
      computeCost({
        features: ["video"],
        model: "kling-2.1",
        resolution: "1080p",
        durationSeconds: 10,
      }).total,
    );
  });

  test("studio.functions' COST_IMAGE constant matches the shared computeCost image price", () => {
    expect(COST_IMAGE).toBe(computeCost({ features: ["image"] }).total);
  });
});
