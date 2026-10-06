import { describe, expect, it } from "bun:test";
import {
  FilmPlanAdoptionInputSchema,
  FilmPlanSchema,
  assertVideoAgentSeedanceEntitlement,
  assertSupportedFilmStudioAssembly,
  mapVideoAgentProject,
  mergeVideoAgentSceneEdit,
  resolveVideoAgentScenePrompt,
  videoAgentScriptContentHash,
} from "./video-agent-projects.functions";

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
  it("reloads server-owned script attribution from the existing project envelope", async () => {
    const scenes = [{
      title: "First light",
      script: "The day begins with one deliberate choice.",
      description: "Warm dawn light crosses a quiet kitchen.",
      duration: 8,
    }];
    const scriptHash = await videoAgentScriptContentHash("A Better Morning", scenes);
    const mapped = mapVideoAgentProject({
      id: "script-project",
      prompt: "A sufficiently long script project prompt",
      title: "A Better Morning",
      style: "cinematic",
      voice: "narrator-warm",
      target_duration: 30,
      scenes: [{
        id: "scene-1",
        index: 0,
        ...scenes[0],
        frame: null,
      }],
      status: "editing",
      status_message: "Storyboard ready to render",
      job_id: null,
      generation_id: null,
      export_url: null,
      thumbnail_url: null,
      error: null,
      production: {
        aurora_script_attribution: {
          version: 1,
          provider: "modelark",
          model: "script-model",
          scriptHash,
          generatedAt: "2026-09-09T00:00:00.000Z",
        },
      },
      created_at: "2026-09-09T00:00:00.000Z",
      updated_at: "2026-09-09T00:00:01.000Z",
    });

    expect(mapped.scriptAttribution).toEqual({
      version: 1,
      provider: "modelark",
      model: "script-model",
      scriptHash,
      generatedAt: "2026-09-09T00:00:00.000Z",
    });
  });

  it("requires an active Pro entitlement for every Video Agent Seedance render", () => {
    expect(() => assertVideoAgentSeedanceEntitlement("free")).toThrow(/active Pro subscription/i);
    expect(() => assertVideoAgentSeedanceEntitlement("starter")).toThrow(/active Pro subscription/i);
    expect(() => assertVideoAgentSeedanceEntitlement("pro")).not.toThrow();
  });

  it("exposes a render receipt from an otherwise unknown legacy production object", () => {
    const renderEngine = {
      version: 1 as const,
      scenes: [{
        sceneId: "legacy-scene",
        index: 0,
        image: {
          source: "reused" as const,
          plateQuality: "free" as const,
          generationId: null,
        },
        video: {
          provider: "actual-provider",
          endpoint: "actual/video/endpoint",
        },
      }],
      assembler: {
        provider: "aurora-video-agent" as const,
        endpoint: "local-ffmpeg-assemble" as const,
      },
    };
    const mapped = mapVideoAgentProject({
      id: "p1",
      prompt: "A sufficiently long legacy project prompt",
      title: "Legacy",
      style: "cinematic",
      voice: "narrator-warm",
      target_duration: 30,
      scenes: [],
      status: "succeeded",
      status_message: "ready",
      job_id: "j1",
      generation_id: "g1",
      export_url: "https://example.com/final.mp4",
      thumbnail_url: null,
      error: null,
      production: {
        template: "unknown-legacy-template",
        custom: { untouched: true },
        renderEngine,
      },
      created_at: "2026-09-09T00:00:00.000Z",
      updated_at: "2026-09-09T00:00:01.000Z",
    });
    expect(mapped.production).toBeNull();
    expect(mapped.renderEngine).toEqual(renderEngine);
  });

  it("accepts the fail-closed Seedance 2.5 renderer contract", () => {
    expect(FilmPlanSchema.parse(validPlan).renderPlan.rendererModel).toBe("byteplus/seedance-2.5");
  });

  it("rejects a generic fallback renderer", () => {
    expect(() => FilmPlanSchema.parse({
      ...validPlan,
      renderPlan: { ...validPlan.renderPlan, rendererModel: "seedance-2.5" },
    })).toThrow();
  });

  it("rejects unsupported native resolution and assembly settings explicitly", () => {
    expect(() => FilmPlanSchema.parse({
      ...validPlan,
      renderPlan: { ...validPlan.renderPlan, resolution: "1080p" },
    })).toThrow();
    expect(() => assertSupportedFilmStudioAssembly({
      ...validPlan.renderPlan,
      aspectRatio: "4:3",
    })).toThrow(/supports 16:9, 9:16, or 1:1/i);
    expect(() => assertSupportedFilmStudioAssembly({
      ...validPlan.renderPlan,
      fps: 30,
    })).toThrow(/supports 24fps/i);
    expect(FilmPlanAdoptionInputSchema.safeParse({
      prompt: "Adopt this otherwise valid unsupported film plan.",
      originalPlan: {},
      renderSettings: { ...validPlan.renderPlan, aspectRatio: "4:3" },
    }).success).toBe(false);
  });

  it("uses the edited camera description as the shared plate and provider prompt boundary", () => {
    const adopted = {
      id: "shot-1",
      index: 0,
      title: "Opening",
      script: "Voice-over",
      description: "Original planner shot prompt",
      modelPrompt: "Original planner shot prompt",
      duration: 5,
      frame: "https://example.com/old-generated-plate.png",
      frameStatus: "done" as const,
      plateQuality: "premium" as const,
      plateGenerationId: "old-plate-generation",
    };
    const edited = mergeVideoAgentSceneEdit(adopted, {
      ...adopted,
      description: "Edited low-angle tracking shot at blue hour",
    });

    expect(resolveVideoAgentScenePrompt(edited)).toBe("Edited low-angle tracking shot at blue hour");
    expect(edited).toMatchObject({
      frame: null,
      frameStatus: "idle",
      plateGenerationId: null,
    });
    expect(edited.plateQuality).toBeUndefined();
  });

  it("does not invalidate a generated plate for unrelated narration edits", () => {
    const previous = {
      id: "shot-1",
      index: 0,
      title: "Opening",
      script: "Old narration",
      description: "Stable visual prompt",
      modelPrompt: "Original planner prompt",
      duration: 5,
      frame: "https://example.com/plate.png",
      frameStatus: "done" as const,
      plateQuality: "premium" as const,
      plateGenerationId: "plate-generation",
    };
    const edited = mergeVideoAgentSceneEdit(previous, {
      ...previous,
      script: "New narration only",
    });
    expect(edited).toMatchObject({
      frame: previous.frame,
      plateQuality: "premium",
      plateGenerationId: "plate-generation",
    });
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