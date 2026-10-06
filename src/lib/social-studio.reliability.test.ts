import { describe, expect, it } from "bun:test";
import {
  applyVisualGenerationResults,
  CAMPAIGN_PLANNER_OPERATION,
  createOperationFence,
  planVisualGeneration,
} from "./social-studio.reliability";
import { parseGeneratedCampaign, parseStoredCampaign } from "./social-studio.schema";

describe("Marketing Studio operation fencing", () => {
  it("rejects duplicate planner operations and invalidates stale completions", () => {
    const fence = createOperationFence();
    const first = fence.begin(CAMPAIGN_PLANNER_OPERATION);

    expect(first).not.toBeNull();
    expect(fence.begin(CAMPAIGN_PLANNER_OPERATION)).toBeNull();
    expect(fence.isCurrent(first!)).toBe(true);

    fence.invalidate();
    expect(fence.isCurrent(first!)).toBe(false);
    expect(fence.begin(CAMPAIGN_PLANNER_OPERATION)).not.toBeNull();
  });

  it("allows one operation per item while keeping other items independent", () => {
    const fence = createOperationFence();
    const first = fence.begin("campaign-a:item-1");

    expect(first).not.toBeNull();
    expect(fence.begin("campaign-a:item-1")).toBeNull();
    expect(fence.begin("campaign-a:item-2")).not.toBeNull();
  });

  it("invalidates every old campaign item synchronously on replacement", () => {
    const fence = createOperationFence();
    const oldItem = fence.begin("campaign-old:day-1-reel")!;

    fence.invalidate();

    expect(fence.isCurrent(oldItem)).toBe(false);
    expect(fence.begin("campaign-new:day-1-reel")).not.toBeNull();
  });
});

describe("Marketing Studio carousel slot reliability", () => {
  it("preserves successful slots when an explicit regeneration partly fails", () => {
    const plan = planVisualGeneration(["old-a", "old-b", "old-c"], 3);

    expect(plan.targets).toEqual([0, 1, 2]);
    expect(applyVisualGenerationResults(plan, [null, "new-b", null])).toEqual([
      "old-a",
      "new-b",
      "old-c",
    ]);
  });

  it("keeps prior successes when every regeneration request fails", () => {
    const plan = planVisualGeneration(["old-a", "old-b"], 2);

    expect(applyVisualGenerationResults(plan, [null, null])).toEqual(["old-a", "old-b"]);
  });

  it("persists null slots after a total first failure and retries only missing slots", () => {
    const firstPlan = planVisualGeneration([], 3);
    const failed = applyVisualGenerationResults(firstPlan, [null, null, null]);

    expect(failed).toEqual([null, null, null]);
    expect(planVisualGeneration(failed, 3).targets).toEqual([0, 1, 2]);

    const partial = applyVisualGenerationResults(
      planVisualGeneration(failed, 3),
      ["slide-a", null, "slide-c"],
    );
    expect(partial).toEqual(["slide-a", null, "slide-c"]);
    expect(planVisualGeneration(partial, 3).targets).toEqual([1]);
  });

  it("renders all slots when the stored slot count is stale", () => {
    const plan = planVisualGeneration(["old-only"], 3);
    expect(plan.targets).toEqual([0, 1, 2]);
    expect(applyVisualGenerationResults(plan, [null, "new-b", "new-c"])).toEqual([
      null,
      "new-b",
      "new-c",
    ]);
  });
});

describe("Marketing Studio stored campaign validation", () => {
  const fixture = {
    id: "legacy-campaign-key",
    featureId: "video-agent",
    featureName: "Video Agent",
    createdAt: "2026-09-10T12:00:00.000Z",
    provider: "fixture",
    name: "A valid stored campaign",
    strategy: "A sufficiently long strategy that explains the campaign review flow.",
    items: [
      {
        id: "day-1-reel",
        day: 1,
        format: "reel",
        title: "A reviewed Reel",
        hook: "Start with the brief",
        caption: "A caption that is long enough to pass the client-safe stored schema.",
        hashtags: ["Aurora", "Creative", "Video"],
        cta: "Review the shot",
        visualPrompt: "A premium Aurora creative workspace with a clear visual treatment.",
        reelPrompt: "A slow camera move across the workspace.",
        recommendedTime: "6:30 PM",
        slides: [],
        assetUrls: [],
        videoUrl: "https://cdn.example.test/reel.mp4",
        status: "draft",
        scheduledDate: "",
      },
    ],
  };

  it("validates a planner result before it can become stored campaign state", () => {
    const generated = {
      name: fixture.name,
      strategy: fixture.strategy,
      items: fixture.items.map(({ assetUrls, videoUrl, status, scheduledDate, ...item }) => item),
    };
    expect(parseGeneratedCampaign(generated)).not.toBeNull();
    expect(
      parseGeneratedCampaign({
        ...generated,
        items: [{ ...generated.items[0], id: generated.items[0].id }, { ...generated.items[0] }],
      }),
    ).toBeNull();
    expect(
      parseGeneratedCampaign({
        ...generated,
        items: [{ ...generated.items[0], day: 31 }],
      }),
    ).toBeNull();
  });

  it("normalizes legacy missing preview metadata to unknown, not full quality", () => {
    const parsed = parseStoredCampaign(fixture);

    expect(parsed?.items[0].videoGenerationId).toBeNull();
    expect(parsed?.items[0].reelPreviewId).toBeNull();
    expect(parsed?.items[0].reelPreviewUrl).toBeNull();
  });

  it("keeps short intermediate caption edits reloadable", () => {
    const parsed = parseStoredCampaign({
      ...fixture,
      items: [{ ...fixture.items[0], caption: "" }],
    });

    expect(parsed?.items[0].caption).toBe("");
  });

  it("rejects incoherent preview metadata and duplicate planner ids", () => {
    const id = "00000000-0000-0000-0000-000000000001";
    expect(
      parseStoredCampaign({
        ...fixture,
        items: [
          {
            ...fixture.items[0],
            videoGenerationId: id,
            reelPreviewId: id,
            reelPreviewUrl: "https://cdn.example.test/other-preview.mp4",
          },
        ],
      }),
    ).toBeNull();

    expect(
      parseStoredCampaign({
        ...fixture,
        items: [fixture.items[0], { ...fixture.items[0], id: fixture.items[0].id }],
      }),
    ).toBeNull();
  });

  it("rejects non-HTTPS rendered URLs", () => {
    expect(
      parseStoredCampaign({
        ...fixture,
        items: [{ ...fixture.items[0], videoUrl: "data:video/mp4;base64,AAAA" }],
      }),
    ).toBeNull();
  });

  it("rejects unknown stored fields instead of trusting localStorage", () => {
    expect(parseStoredCampaign({ ...fixture, unexpected: true })).toBeNull();
    expect(
      parseStoredCampaign({
        ...fixture,
        items: [{ ...fixture.items[0], unexpected: true }],
      }),
    ).toBeNull();
  });
});