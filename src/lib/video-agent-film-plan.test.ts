import { describe, expect, it } from "bun:test";
import { FilmPlanAdoptionInputSchema, FilmPlanSchema } from "./video-agent-projects.functions";

const validPlan = {
  schemaVersion: 1 as const,
  brief: {
    title: "Night Crossing",
    logline: "A courier follows a signal through a rain-dark city.",
    genre: "thriller",
    mood: "restrained",
    format: "16:9" as const,
    assumptions: [],
  },
  script: "The signal returns.",
  continuity: {
    identityAnchor: "the same courier in a charcoal raincoat",
    wardrobe: "charcoal raincoat",
    environment: "wet sodium-lit streets",
    cameraRules: "measured lateral tracking",
    colorRules: "amber practicals and cyan shadows",
  },
  continuityLedger: {
    identity: ["the same courier"],
    wardrobe: ["charcoal raincoat"],
    props: ["signal receiver"],
    location: ["wet city streets"],
    time: ["night"],
    lighting: ["sodium practicals"],
    screen_direction: ["courier moves frame-left to frame-right"],
    audio: ["receiver pulse"],
  },
  renderPlan: {
    rendererModel: "byteplus/seedance-2.5" as const,
    aspectRatio: "16:9" as const,
    resolution: "720p" as const,
    fps: 24 as const,
    generateAudio: true,
    watermark: false,
  },
  planner: {
    planner: "film-planner",
    provider: "byteplus",
    model: "planner-model",
    provenanceTrust: "client-supplied" as const,
  },
  adoptedAt: "2026-09-08T12:00:00.000Z",
  renderApproval: null,
};

describe("durable Film Studio plan contract", () => {
  it("accepts the fail-closed Seedance 2.5 renderer contract", () => {
    expect(FilmPlanSchema.parse(validPlan).renderPlan.rendererModel).toBe("byteplus/seedance-2.5");
  });

  it("rejects a generic fallback renderer", () => {
    expect(() => FilmPlanSchema.parse({
      ...validPlan,
      renderPlan: { ...validPlan.renderPlan, rendererModel: "seedance-2.5" },
    })).toThrow();
  });

  it("rejects an unsupported native resolution or cinema ratio", () => {
    expect(() => FilmPlanSchema.parse({
      ...validPlan,
      renderPlan: { ...validPlan.renderPlan, resolution: "1080p" },
    })).toThrow();
    expect(() => FilmPlanSchema.parse({
      ...validPlan,
      renderPlan: { ...validPlan.renderPlan, aspectRatio: "2.39:1" },
    })).toThrow();
  });

  it("requires authentic planner provenance", () => {
    expect(() => FilmPlanSchema.parse({
      ...validPlan,
      planner: { planner: "", provider: "", model: "" },
    })).toThrow();
  });

  it("rejects independently forged scenes or script beside a signed original plan", () => {
    const input = {
      prompt: "Create the verified courier film plan.",
      originalPlan: {
        receipt: {
          version: "1",
          expires_at: "2026-09-08T12:10:00.000Z",
          signature: "a".repeat(43),
        },
      },
      renderSettings: validPlan.renderPlan,
    };
    expect(FilmPlanAdoptionInputSchema.safeParse(input).success).toBe(true);
    expect(FilmPlanAdoptionInputSchema.safeParse({
      ...input,
      scenes: [{ title: "Forged scene", script: "Not in signed plan" }],
      filmPlan: { script: "Forged screenplay" },
    }).success).toBe(false);
  });
});