import { describe, expect, it } from "bun:test";
import {
  NBA_JOSH_DURATION_SECONDS,
  defaultNbaJoshProduction,
  nbaJoshPlanHash,
  resetNbaJoshOutfit,
  validateNbaJoshProduction,
} from "./nba-josh-production";

describe("NBA Josh Looping Officers production contract", () => {
  it("locks the delivery to a 15-second 16:9 two-layer production", () => {
    const plan = validateNbaJoshProduction(defaultNbaJoshProduction());

    expect(plan.delivery.durationSeconds).toBe(NBA_JOSH_DURATION_SECONDS);
    expect(plan.delivery.aspectRatio).toBe("16:9");
    expect(plan.layers[0].durationSeconds).toBe(10);
    expect(plan.layers[1].durationSeconds).toBe(15);
    expect(plan.layers[1].status).toBe("missing");
    expect(plan.outfits).toHaveLength(3);
  });

  it("does not let approvals or generated results alter the creative-plan hash", () => {
    const plan = defaultNbaJoshProduction();
    const original = nbaJoshPlanHash(plan);
    const changedResult = structuredClone(plan);
    changedResult.outfits[0].stillUrls = ["https://example.com/still.png"];
    changedResult.outfits[0].approvals.still = {
      approved: true,
      planHash: original,
      approvedAt: "2026-08-25T00:00:00.000Z",
    };

    expect(nbaJoshPlanHash(changedResult)).toBe(original);

    changedResult.outfits[0].variationCount = 3;
    expect(nbaJoshPlanHash(changedResult)).not.toBe(original);
  });

  it("clears dependent approvals and generated media when an outfit plan changes", () => {
    const plan = defaultNbaJoshProduction();
    const changed = resetNbaJoshOutfit({
      ...plan.outfits[0],
      stillUrls: ["https://example.com/still.png"],
      selectedStillUrl: "https://example.com/still.png",
      videoUrl: "https://example.com/video.mp4",
      stillStatus: "succeeded",
      videoStatus: "succeeded",
      approvals: {
        still: { approved: true, planHash: "old" },
        motion: { approved: true, planHash: "old" },
      },
    });

    expect(changed.stillUrls).toEqual([]);
    expect(changed.selectedStillUrl).toBeUndefined();
    expect(changed.videoUrl).toBeUndefined();
    expect(changed.stillStatus).toBe("awaiting_approval");
    expect(changed.videoStatus).toBe("idle");
    expect(changed.approvals.still.approved).toBe(false);
    expect(changed.approvals.motion.approved).toBe(false);
  });
});