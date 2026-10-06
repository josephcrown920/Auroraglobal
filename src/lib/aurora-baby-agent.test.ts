import { describe, expect, it } from "bun:test";
import {
  BabyPlanSchema,
  buildRevisionCommand,
  chooseProvider,
  scoreBabyShot,
  type AuroraBabyPlan,
  type AuroraBabyShot,
} from "./aurora-baby-agent";

const shot: AuroraBabyShot = {
  id: "s1-shot1",
  scene: 1,
  purpose: "hook",
  durationSeconds: 5,
  framing: "close-up",
  lensMm: 85,
  cameraMove: "slow push-in",
  cameraSpeed: "slow",
  lighting: "soft camera-left key with subtle rim",
  behavior: "subject looks into camera and exhales",
  continuityLocks: ["identity", "wardrobe", "location"],
  prompt: "CLOSE-UP, consistent protagonist, slow push-in, soft practical light, controlled performance",
  negativePrompt: "warped face, identity drift, extra fingers, text, watermark, flicker",
  referenceRoles: ["identity", "wardrobe"],
};

const plan: AuroraBabyPlan = {
  brief: {
    title: "Test",
    intent: "Test production",
    audience: "Creators",
    durationSeconds: 5,
    aspectRatio: "9:16",
    tone: "premium",
    visualLanguage: "editorial realism",
    assumptions: [],
  },
  script: { narration: "", dialogue: [], musicDirection: "", sfxDirection: "" },
  bibles: { identityAnchor: "consistent protagonist", character: [], environment: [], style: [] },
  shots: [shot],
  delivery: { formats: ["9:16"], fps: 24, resolution: "720p", captions: true, dubbing: false },
};

describe("Aurora Baby Agent", () => {
  it("routes identity-heavy shots to Vast when available", () => {
    expect(chooseProvider(shot, { modelark: true, fal: true, replicate: true, vast: true })).toBe("vast");
  });

  it("falls back to FAL when control backends are unavailable", () => {
    expect(chooseProvider(shot, { modelark: false, fal: true, replicate: true, vast: false })).toBe("fal");
  });

  it("scores a clean shot as passing", () => {
    const result = scoreBabyShot({ identity: 95, promptAdherence: 92, temporal: 90, camera: 88, anatomy: 96, continuity: 94 });
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(78);
  });

  it("produces a targeted repair instead of a full-video restart", () => {
    const result = scoreBabyShot({ identity: 55, promptAdherence: 92, temporal: 90, camera: 88, anatomy: 95, continuity: 94 });
    expect(result.pass).toBe(false);
    expect(buildRevisionCommand(shot, result)).toContain("Repair only s1-shot1");
  });

  it("keeps the production plan schema strict", () => {
    expect(BabyPlanSchema.parse(plan).shots[0]?.id).toBe("s1-shot1");
  });
});
