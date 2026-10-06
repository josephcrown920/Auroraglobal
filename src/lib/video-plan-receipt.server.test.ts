import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { VideoPlan } from "./video-agent-skills";
import { createPlanReceipt, verifyPlanReceipt } from "./video-plan-receipt.server";

const plan: VideoPlan = {
  brief: {
    title: "Receipt",
    logline: "A signed plan stays attributable.",
    genre: "documentary",
    mood: "measured",
    palette: [
      { hex: "#000000", role: "dominant" },
      { hex: "#FFFFFF", role: "highlight" },
      { hex: "#777777", role: "secondary" },
    ],
    references: ["Reference One", "Reference Two"],
    motion_language: "Documentary Realism",
    format: "16:9",
  },
  shots: [
    {
      id: "shot-1",
      purpose: "establishing",
      shot_type: "WIDE",
      duration_s: 4,
      action: "A subject enters.",
      prompt: "WIDE, subject enters",
      negative_prompt: "warped face",
    },
  ],
};

const saved = process.env.SESSION_SECRET;
describe("video plan provenance receipt", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "receipt-test-secret";
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = saved;
  });

  it("verifies the canonical plan only for its authenticated owner", () => {
    const now = Date.parse("2026-09-08T12:00:00.000Z");
    const receipt = createPlanReceipt(plan, "user-a", now);
    expect(verifyPlanReceipt(plan, receipt, "user-a", now)).toMatchObject({ valid: true, version: "1" });
    expect(verifyPlanReceipt(plan, receipt, "user-b", now)).toEqual({
      valid: false,
      reason: "bad-signature",
    });
  });

  it("rejects tampering and expiry", () => {
    const now = Date.parse("2026-09-08T12:00:00.000Z");
    const receipt = createPlanReceipt(plan, "user-a", now);
    const tampered = { ...plan, brief: { ...plan.brief!, title: "Forged provider plan" } };
    expect(verifyPlanReceipt(tampered, receipt, "user-a", now)).toEqual({
      valid: false,
      reason: "bad-signature",
    });
    expect(verifyPlanReceipt(plan, receipt, "user-a", now + 10 * 60_000)).toEqual({
      valid: false,
      reason: "expired",
    });
  });

  it("accepts canonical key reordering and excludes an embedded receipt", () => {
    const now = Date.parse("2026-09-08T12:00:00.000Z");
    const receipt = createPlanReceipt(plan, "user-a", now);
    const reordered = JSON.parse(JSON.stringify({ shots: plan.shots, brief: plan.brief, receipt }));
    expect(verifyPlanReceipt(reordered, receipt, "user-a", now)).toMatchObject({ valid: true });
  });
});