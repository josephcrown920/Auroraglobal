// Tests for the shared plan-limit helpers in billing.plans.ts.
//
// These helpers are the single source for BOTH the server guards
// (cost-guardrails.server.ts delegates its throw messages here) and the
// pre-click warning UI (PlanLimitNotice + /api/estimate `warnings`), so the
// exact strings and blocking semantics are pinned deliberately: if a message
// changes here it changes everywhere at once — which is the point.
import { describe, expect, test } from "bun:test";
import {
  DURATION_CAPPED_KINDS,
  DURATION_CAPS,
  durationCapMessage,
  evaluatePlanLimits,
  hdEntitlementMessage,
} from "./billing.plans";

describe("hdEntitlementMessage", () => {
  test("free + 1080p → the exact string assertHdEntitlement throws", () => {
    expect(hdEntitlementMessage("free", "1080p")).toBe(
      "Unsupported resolution for Free plan: HD (1080p) requires Pro. Upgrade to unlock HD and 4K exports.",
    );
  });

  test("free + 2160p uses the 4K label", () => {
    expect(hdEntitlementMessage("free", "2160p")).toBe(
      "Unsupported resolution for Free plan: 4K (2160p) requires Pro. Upgrade to unlock HD and 4K exports.",
    );
  });

  test("allowed cases return null", () => {
    expect(hdEntitlementMessage("pro", "1080p")).toBeNull();
    expect(hdEntitlementMessage("pro", "2160p")).toBeNull();
    expect(hdEntitlementMessage("free", "720p")).toBeNull();
    expect(hdEntitlementMessage("free", "480p")).toBeNull();
    expect(hdEntitlementMessage("free", undefined)).toBeNull();
    expect(hdEntitlementMessage("free", null)).toBeNull();
  });
});

describe("DURATION_CAPPED_KINDS", () => {
  test("covers exactly the kinds the charge paths duration-guard", () => {
    expect(DURATION_CAPPED_KINDS.has("video")).toBe(true);
    expect(DURATION_CAPPED_KINDS.has("motion")).toBe(true);
    expect(DURATION_CAPPED_KINDS.has("lipsync")).toBe(true);
    expect(DURATION_CAPPED_KINDS.has("image")).toBe(false);
    expect(DURATION_CAPPED_KINDS.has("text")).toBe(false);
    expect(DURATION_CAPPED_KINDS.has("audio")).toBe(false);
    expect(DURATION_CAPPED_KINDS.has("upscale")).toBe(false);
  });
});

describe("evaluatePlanLimits — duration cap", () => {
  test("free + 12s video → blocking warning with the server's exact message", () => {
    const w = evaluatePlanLimits({ tier: "free", kind: "video", durationSeconds: 12 });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({
      code: "duration_cap",
      message: durationCapMessage("free", 12),
      limitLabel: `${DURATION_CAPS.free}s`,
      requestedLabel: "12s",
      upgradeTier: "pro",
      // Duration is asserted BEFORE the preview gate — even a preview click fails.
      blocksNextRender: true,
    });
    expect(w[0]!.message).toContain("Upgrade to Pro for up to 15 seconds.");
  });

  test("duration blocks even when the next render is a preview pass", () => {
    const w = evaluatePlanLimits({
      tier: "free",
      kind: "video",
      durationSeconds: 12,
      nextRenderIsPreview: true,
    });
    expect(w[0]?.blocksNextRender).toBe(true);
  });

  test("within-cap durations produce no warning", () => {
    expect(evaluatePlanLimits({ tier: "free", kind: "video", durationSeconds: 10 })).toHaveLength(0);
    expect(evaluatePlanLimits({ tier: "pro", kind: "video", durationSeconds: 12 })).toHaveLength(0);
  });

  test("pro over its own cap warns but offers no upgrade tier", () => {
    const w = evaluatePlanLimits({ tier: "pro", kind: "video", durationSeconds: 18 });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ code: "duration_cap", upgradeTier: null });
  });

  test("lipsync duration is capped; non-temporal kinds are not", () => {
    expect(
      evaluatePlanLimits({ tier: "free", kind: "lipsync", durationSeconds: 12 }),
    ).toHaveLength(1);
    expect(evaluatePlanLimits({ tier: "free", kind: "text", durationSeconds: 12 })).toHaveLength(0);
    expect(evaluatePlanLimits({ tier: "free", kind: "image", durationSeconds: 12 })).toHaveLength(0);
  });
});

describe("evaluatePlanLimits — HD entitlement", () => {
  test("free + 1080p with a preview next → advisory (preview still runs)", () => {
    const w = evaluatePlanLimits({
      tier: "free",
      kind: "video",
      resolution: "1080p",
      nextRenderIsPreview: true,
    });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({
      code: "hd_entitlement",
      message: hdEntitlementMessage("free", "1080p"),
      limitLabel: "720p",
      requestedLabel: "HD (1080p)",
      upgradeTier: "pro",
      blocksNextRender: false,
    });
  });

  test("free + 1080p when the next render is full quality → blocking", () => {
    const w = evaluatePlanLimits({
      tier: "free",
      kind: "video",
      resolution: "1080p",
      nextRenderIsPreview: false,
    });
    expect(w[0]?.blocksNextRender).toBe(true);
  });

  test("non-temporal kinds (no preview pass) default to blocking", () => {
    const w = evaluatePlanLimits({ tier: "free", kind: "image", resolution: "2160p" });
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({
      code: "hd_entitlement",
      requestedLabel: "4K (2160p)",
      blocksNextRender: true,
    });
  });

  test("pro sees no HD warning; SD resolutions never warn", () => {
    expect(
      evaluatePlanLimits({ tier: "pro", kind: "video", resolution: "2160p" }),
    ).toHaveLength(0);
    expect(
      evaluatePlanLimits({ tier: "free", kind: "video", resolution: "720p" }),
    ).toHaveLength(0);
  });
});

describe("evaluatePlanLimits — combined", () => {
  test("over-cap duration + HD on free yields both warnings, duration first", () => {
    const w = evaluatePlanLimits({
      tier: "free",
      kind: "video",
      durationSeconds: 12,
      resolution: "1080p",
      nextRenderIsPreview: true,
    });
    expect(w.map((x) => x.code)).toEqual(["duration_cap", "hd_entitlement"]);
  });

  test("clean pro request yields nothing", () => {
    expect(
      evaluatePlanLimits({
        tier: "pro",
        kind: "video",
        durationSeconds: 15,
        resolution: "2160p",
      }),
    ).toHaveLength(0);
  });
});
