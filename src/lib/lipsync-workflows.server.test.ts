import { describe, expect, it } from "bun:test";
import {
  buildLatentSyncRequest,
  LATENTSYNC_MODEL,
  LATENTSYNC_WORKFLOW,
} from "./lipsync-workflows.server";

const VIDEO = "http://example.com/face.mp4";
const AUDIO = "http://example.com/voice.wav";

describe("buildLatentSyncRequest", () => {
  it("emits flat params for custom/runpod/hfspace workers", () => {
    const parts = buildLatentSyncRequest({
      videoUrl: VIDEO,
      audioUrl: AUDIO,
      params: { inferenceSteps: 30, guidanceScale: 2, seed: 7 },
    });
    expect(parts.params).toEqual({ inference_steps: 30, guidance_scale: 2, seed: 7 });
  });

  it("emits a ComfyUI graph + per-node input patches", () => {
    const parts = buildLatentSyncRequest({
      videoUrl: VIDEO,
      audioUrl: AUDIO,
      params: { inferenceSteps: 25, guidanceScale: 1.8, seed: 99 },
    });
    expect(parts.comfyWorkflow).toBe(LATENTSYNC_WORKFLOW);
    expect(parts.comfyInputs).toEqual({
      "1.url": VIDEO,
      "2.url": AUDIO,
      "3.inference_steps": 25,
      "3.guidance_scale": 1.8,
      "3.seed": 99,
    });
  });

  it("keeps the flat params and the comfy patches in lock-step", () => {
    const parts = buildLatentSyncRequest({
      videoUrl: VIDEO,
      audioUrl: AUDIO,
      params: { inferenceSteps: 18, guidanceScale: 1.2, seed: 3 },
    });
    const p = parts.params as Record<string, number>;
    const c = parts.comfyInputs as Record<string, number>;
    expect(c["3.inference_steps"]).toBe(p.inference_steps);
    expect(c["3.guidance_scale"]).toBe(p.guidance_scale);
    expect(c["3.seed"]).toBe(p.seed);
  });

  it("clamps inference steps into [10, 50]", () => {
    const lo = buildLatentSyncRequest({ videoUrl: VIDEO, audioUrl: AUDIO, params: { inferenceSteps: 1 } });
    const hi = buildLatentSyncRequest({ videoUrl: VIDEO, audioUrl: AUDIO, params: { inferenceSteps: 999 } });
    expect((lo.params as Record<string, number>).inference_steps).toBe(10);
    expect((hi.params as Record<string, number>).inference_steps).toBe(50);
  });

  it("clamps guidance scale into [1, 5]", () => {
    const lo = buildLatentSyncRequest({ videoUrl: VIDEO, audioUrl: AUDIO, params: { guidanceScale: 0.1 } });
    const hi = buildLatentSyncRequest({ videoUrl: VIDEO, audioUrl: AUDIO, params: { guidanceScale: 50 } });
    expect((lo.params as Record<string, number>).guidance_scale).toBe(1);
    expect((hi.params as Record<string, number>).guidance_scale).toBe(5);
  });

  it("falls back to defaults when params are omitted", () => {
    const parts = buildLatentSyncRequest({ videoUrl: VIDEO, audioUrl: AUDIO });
    const p = parts.params as Record<string, number>;
    expect(p.inference_steps).toBe(20);
    expect(p.guidance_scale).toBe(1.5);
    expect(Number.isInteger(p.seed)).toBe(true);
  });

  it("generates a deterministic-shape seed when none is provided", () => {
    const parts = buildLatentSyncRequest({ videoUrl: VIDEO, audioUrl: AUDIO });
    const seed = (parts.params as Record<string, number>).seed;
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(2_147_483_647);
  });

  it("exposes the canonical model key", () => {
    expect(LATENTSYNC_MODEL).toBe("latentsync");
  });
});
