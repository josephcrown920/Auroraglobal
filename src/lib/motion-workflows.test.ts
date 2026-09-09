import { describe, expect, it } from "bun:test";
import {
  buildMimicMotionRequest,
  MIMIC_MOTION_MODEL,
  MIMIC_MOTION_WORKFLOW,
  normalizeMotionParams,
  type MotionParams,
} from "./motion-workflows.server";

const imageUrl = "https://media.example.test/reference.jpg";
const drivingVideoUrl = "https://media.example.test/driving.mp4";

describe("MimicMotion request contract", () => {
  it("preserves the driving video, reference still, sentinel model and prompt", () => {
    const request = buildMimicMotionRequest({
      imageUrl, drivingVideoUrl, prompt: "Follow the dancer", params: { seed: 42 },
    });
    expect(request).toMatchObject({
      kind: "motion",
      model: MIMIC_MOTION_MODEL,
      prompt: "Follow the dancer",
      videoUrl: drivingVideoUrl,
      imageUrls: [imageUrl],
    });
    expect(request.model).toBe("mimic-motion");
    expect(request.params).toEqual({
      motion_type: "faithful", camera_movement: "static", fps: 16,
      steps: 25, cfg: 2, frames: 72, preserve_face: true, seed: 42,
    });
    expect(request.comfyWorkflow).toEqual(MIMIC_MOTION_WORKFLOW);
    expect(request.comfyInputs).toEqual({
      "1.url": imageUrl,
      "2.url": drivingVideoUrl,
      "3.motion_type": "faithful",
      "3.camera_movement": "static",
      "3.steps": 25,
      "3.cfg": 2,
      "3.fps": 16,
      "3.frames": 72,
      "3.preserve_face": true,
      "3.seed": 42,
      "4.fps": 16,
    });
  });

  it("keeps custom-worker params and ComfyUI patches in sync, including false and zero", () => {
    const request = buildMimicMotionRequest({
      imageUrl, drivingVideoUrl,
      params: {
        motionType: "expressive", cameraMovement: "orbit",
        fps: 24, steps: 40, cfg: 3.5, frames: 120, preserveFace: false, seed: 0,
      },
    });
    expect(request.params).toEqual({
      motion_type: "expressive", camera_movement: "orbit",
      fps: 24, steps: 40, cfg: 3.5, frames: 120, preserve_face: false, seed: 0,
    });
    for (const [key, value] of Object.entries(request.params!)) {
      expect(request.comfyInputs?.[`3.${key}`]).toBe(value);
    }
    expect(request.comfyInputs?.["4.fps"]).toBe(24);
    expect(request.prompt).toBeUndefined();
  });

  it("clamps numeric budgets and defaults invalid options before serializing", () => {
    const params = {
      motionType: "invalid", cameraMovement: "invalid",
      fps: 100, steps: 1, cfg: NaN, frames: 999, seed: 12.9,
    } as unknown as MotionParams;
    const request = buildMimicMotionRequest({ imageUrl, drivingVideoUrl, params });
    expect(request.params).toEqual({
      motion_type: "faithful", camera_movement: "static",
      fps: 30, steps: 10, cfg: 2, frames: 240, preserve_face: true, seed: 12,
    });
    expect(normalizeMotionParams({ fps: NaN, steps: Infinity, frames: -1, cfg: 100 }))
      .toMatchObject({ fps: 16, steps: 25, frames: 16, cfg: 10 });
  });

  it("uses one generated seed across both contracts and never mutates the graph template", () => {
    const originalGraph = JSON.stringify(MIMIC_MOTION_WORKFLOW);
    const first = buildMimicMotionRequest({ imageUrl, drivingVideoUrl, params: { fps: 30 } });
    const second = buildMimicMotionRequest({
      imageUrl: "https://media.example.test/other.jpg", drivingVideoUrl,
    });
    const seed = first.params?.seed as number;
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2_147_483_647);
    expect(first.comfyInputs?.["3.seed"]).toBe(seed);
    expect(second.params?.fps).toBe(16);
    expect(first.comfyInputs?.["1.url"]).toBe(imageUrl);
    expect(JSON.stringify(MIMIC_MOTION_WORKFLOW)).toBe(originalGraph);
  });
});