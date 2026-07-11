import { describe, expect, test } from "bun:test";
import {
  ANIMATE_LOOP_PROMPT,
  COLOR_PRESETS,
  CUSTOM_MIC_OPTIONS,
  CUSTOM_SCENE_FIELD_MAX,
  EMPTY_CUSTOM_SCENE,
  SETUPS,
  buildCompositorPrompt,
  buildCompositorSpec,
  buildCustomCompositorSpec,
} from "./colors.presets";

// GenerateSchema.prompt allows up to 4000 chars server-side; preset prompts hold
// themselves to a stricter 2000 budget. VideoSchema.prompt ≤ 1000.
const IMAGE_PROMPT_CAP = 2000;
const VIDEO_PROMPT_CAP = 1000;

describe("buildCompositorPrompt", () => {
  test("every color × setup combo fits the server prompt cap (all opts on)", () => {
    for (const c of COLOR_PRESETS) {
      for (const s of SETUPS) {
        const prompt = buildCompositorPrompt(c.id, s.id, {
          hasOutfitRef: true,
          hasSceneRef: true,
        });
        expect(prompt.length).toBeLessThanOrEqual(IMAGE_PROMPT_CAP);
        expect(prompt.length).toBeGreaterThan(200);
      }
    }
  });

  test("contains identity lock and color control sections", () => {
    const prompt = buildCompositorPrompt("royal-blue", "performance", {
      hasOutfitRef: true,
      hasSceneRef: true,
    });
    expect(prompt).toContain("IDENTITY LOCK");
    expect(prompt).toContain("SCENE LOCK");
    expect(prompt).toContain("COLOR CONTROL");
    expect(prompt).toContain("CAMERA");
    expect(prompt).toContain("reference photo 2");
  });

  test("omits the reference-image scene lock when no scene reference is attached", () => {
    const prompt = buildCompositorPrompt("royal-blue", "performance", {
      hasOutfitRef: false,
      hasSceneRef: false,
    });
    expect(prompt).not.toContain("SCENE LOCK (reference image)");
    expect(prompt).toContain("SCENE LOCK: use this studio scene EXACTLY");
    expect(prompt).toContain("Keep the outfit they wear in photo 1");
  });

  test("performance setup uses staging fields; other setups embed the scene prompt", () => {
    const perf = buildCompositorPrompt("hot-pink", "performance", { hasSceneRef: true });
    expect(perf).toContain("PERFORMANCE MODE (image input):");
    const other = SETUPS.find((s) => s.id !== "performance");
    if (other) {
      const scene = buildCompositorPrompt("hot-pink", other.id, { hasSceneRef: true });
      expect(scene).toContain("SCENE & STAGING:");
    }
  });

  test("unknown ids fall back instead of throwing", () => {
    const prompt = buildCompositorPrompt("nope", "nope", { hasSceneRef: true });
    expect(prompt.length).toBeGreaterThan(200);
    expect(prompt.length).toBeLessThanOrEqual(IMAGE_PROMPT_CAP);
  });

  test("video input swaps in extraction/reprojection motion rules", () => {
    const prompt = buildCompositorPrompt("royal-blue", "performance", {
      hasSceneRef: true,
      inputKind: "video",
    });
    expect(prompt).toContain("PERFORMANCE MODE (video input)");
    expect(prompt).toContain("Preserve their motion and timing exactly");
    expect(prompt).toContain("feet grounding");
    expect(prompt.length).toBeLessThanOrEqual(IMAGE_PROMPT_CAP);
  });
});

describe("buildCompositorSpec", () => {
  test("returns the full structured output contract", () => {
    const spec = buildCompositorSpec("royal-blue", "performance", {
      hasSceneRef: true,
    });
    expect(spec.type).toBe("ai_performance_compositor");
    expect(spec.scene.length).toBeGreaterThan(0);
    expect(spec.color).toBe("deep royal blue");
    expect(spec.camera).toContain("CAMERA");
    expect(spec.lighting).toContain("deep royal blue");
    expect(spec.motion_description.length).toBeGreaterThan(0);
    expect(spec.final_render_prompt).toBe(
      buildCompositorPrompt("royal-blue", "performance", { hasSceneRef: true }),
    );
  });

  test("motion_description reflects video vs image input", () => {
    const videoSpec = buildCompositorSpec("hot-pink", "performance", {
      inputKind: "video",
    });
    const imageSpec = buildCompositorSpec("hot-pink", "performance", {
      inputKind: "image",
    });
    expect(videoSpec.motion_description).toContain("extracted");
    expect(imageSpec.motion_description).not.toContain("extracted");
  });
});

describe("buildCustomCompositorSpec", () => {
  // Server cap for generatePerformanceShot: GenerateSchema.prompt ≤ 4000.
  const SERVER_PROMPT_CAP = 4000;

  test("worst-case (all fields maxed, every color × mic) fits the server cap", () => {
    const filler = "x".repeat(CUSTOM_SCENE_FIELD_MAX + 50); // over-long → must be clipped
    for (const c of COLOR_PRESETS) {
      for (const m of CUSTOM_MIC_OPTIONS) {
        const spec = buildCustomCompositorSpec(
          c.id,
          { environment: filler, mic: m.id, pose: filler, energy: filler, lighting: filler, props: filler },
          { hasOutfitRef: true },
        );
        expect(spec.final_render_prompt.length).toBeLessThanOrEqual(SERVER_PROMPT_CAP);
      }
    }
  });

  test("carries the user's scene, keeps identity/color locks, prompt-only scene lock", () => {
    const spec = buildCustomCompositorSpec("royal-blue", {
      ...EMPTY_CUSTOM_SCENE,
      environment: "Rain-soaked rooftop helipad at night",
      mic: "handheld",
      pose: "leaning on the railing",
      energy: "brooding",
      props: "haze machine",
    });
    expect(spec.type).toBe("ai_performance_compositor");
    expect(spec.scene).toContain("Rain-soaked rooftop helipad");
    expect(spec.scene).toContain("haze machine");
    expect(spec.color).toBe("deep royal blue");
    expect(spec.final_render_prompt).toContain("IDENTITY LOCK");
    expect(spec.final_render_prompt).toContain("COLOR CONTROL");
    expect(spec.final_render_prompt).toContain("SCENE LOCK: build this exact scene");
    // No bundled scene asset for custom scenes — never reference an attached scene image.
    expect(spec.final_render_prompt).not.toContain("final reference image");
    expect(spec.motion_description).toContain("leaning on the railing");
    expect(spec.motion_description).toContain("brooding");
    expect(spec.motion_description).toContain("Microphone");
  });

  test("optional fields default gracefully", () => {
    const spec = buildCustomCompositorSpec("hot-pink", {
      ...EMPTY_CUSTOM_SCENE,
      environment: "Minimal white gallery space",
    });
    expect(spec.motion_description).toContain("Natural relaxed stance");
    expect(spec.lighting).toContain("hot pink");
    expect(spec.final_render_prompt).not.toContain("Microphone:");
  });

  test("no-outfit-ref keeps photo-1 outfit; outfit ref points at photo 2", () => {
    const base = { ...EMPTY_CUSTOM_SCENE, environment: "Neon-lit alley set" };
    expect(buildCustomCompositorSpec("emerald", base).final_render_prompt).toContain(
      "outfit they wear in photo 1",
    );
    expect(
      buildCustomCompositorSpec("emerald", base, { hasOutfitRef: true }).final_render_prompt,
    ).toContain("reference photo 2");
  });
});

describe("ANIMATE_LOOP_PROMPT", () => {
  test("fits the video prompt cap and asks for a subtle loop", () => {
    expect(ANIMATE_LOOP_PROMPT.length).toBeLessThanOrEqual(VIDEO_PROMPT_CAP);
    expect(ANIMATE_LOOP_PROMPT).toContain("loopable");
    expect(ANIMATE_LOOP_PROMPT).toContain("breathing");
  });
});
