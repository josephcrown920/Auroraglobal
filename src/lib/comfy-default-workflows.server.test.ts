import { describe, expect, it } from "bun:test";
import type { GenerateRequest } from "./orchestrator.server";
import {
  ANIMATEDIFF_T2V_WORKFLOW,
  SDXL_IMAGE_WORKFLOW,
  SVD_I2V_WORKFLOW,
  buildComfyImageRequest,
  buildComfyVideoRequest,
  buildDefaultComfyWorkflow,
} from "./comfy-default-workflows.server";

// ─── buildComfyImageRequest ───────────────────────────────────────────────────

describe("buildComfyImageRequest", () => {
  it("targets the SDXL graph and patches prompt / negative / dims / sampler", () => {
    const parts = buildComfyImageRequest({
      prompt: "a red fox",
      negativePrompt: "blurry",
      width: 768,
      height: 512,
      steps: 28,
      cfg: 6,
      seed: 42,
    });
    expect(parts.comfyWorkflow).toBe(SDXL_IMAGE_WORKFLOW);
    expect(parts.comfyInputs["2.text"]).toBe("a red fox");
    expect(parts.comfyInputs["3.text"]).toBe("blurry");
    expect(parts.comfyInputs["4.width"]).toBe(768);
    expect(parts.comfyInputs["4.height"]).toBe(512);
    expect(parts.comfyInputs["5.seed"]).toBe(42);
    expect(parts.comfyInputs["5.steps"]).toBe(28);
    expect(parts.comfyInputs["5.cfg"]).toBe(6);
  });

  it("clamps out-of-range steps / cfg / dims to safe bounds and defaults the seed", () => {
    const parts = buildComfyImageRequest({ prompt: "x", steps: 999, cfg: 99, width: 9, height: 9 });
    expect(parts.comfyInputs["5.steps"]).toBe(50);
    expect(parts.comfyInputs["5.cfg"]).toBe(20);
    expect(parts.comfyInputs["4.width"]).toBe(256);
    expect(parts.comfyInputs["4.height"]).toBe(256);
    expect(typeof parts.comfyInputs["5.seed"]).toBe("number");
    // Missing negative prompt becomes an empty string, never undefined.
    expect(parts.comfyInputs["3.text"]).toBe("");
  });
});

// ─── buildComfyVideoRequest ───────────────────────────────────────────────────

describe("buildComfyVideoRequest", () => {
  it("uses the SVD image-to-video graph when an input image is supplied", () => {
    const parts = buildComfyVideoRequest({
      imageUrl: "https://cdn.example.com/still.png",
      frames: 30,
      fps: 12,
      seed: 7,
    });
    expect(parts.comfyWorkflow).toBe(SVD_I2V_WORKFLOW);
    expect(parts.comfyInputs["2.url"]).toBe("https://cdn.example.com/still.png");
    expect(parts.comfyInputs["3.video_frames"]).toBe(30);
    expect(parts.comfyInputs["3.fps"]).toBe(12);
    expect(parts.comfyInputs["7.frame_rate"]).toBe(12);
    expect(parts.comfyInputs["5.seed"]).toBe(7);
  });

  it("uses the AnimateDiff text-to-video graph when there is no input image", () => {
    const parts = buildComfyVideoRequest({ prompt: "a dragon", negativePrompt: "low quality" });
    expect(parts.comfyWorkflow).toBe(ANIMATEDIFF_T2V_WORKFLOW);
    expect(parts.comfyInputs["3.text"]).toBe("a dragon");
    expect(parts.comfyInputs["4.text"]).toBe("low quality");
    // batch_size carries the frame count for the latent in t2v.
    expect(parts.comfyInputs["5.batch_size"]).toBe(16);
    expect(parts.comfyInputs["8.frame_rate"]).toBe(8);
  });
});

// ─── buildDefaultComfyWorkflow (kind dispatcher) ──────────────────────────────

describe("buildDefaultComfyWorkflow", () => {
  it("image: maps resolution → dims and patches the prompt", () => {
    const r: GenerateRequest = { kind: "image", prompt: "a cat", resolution: "720p" };
    const def = buildDefaultComfyWorkflow(r);
    expect(def?.comfyWorkflow).toBe(SDXL_IMAGE_WORKFLOW);
    expect(def?.comfyInputs["2.text"]).toBe("a cat");
    expect(def?.comfyInputs["4.width"]).toBe(1024);
  });

  it("image: explicit params.width / negative_prompt override the resolution default", () => {
    const r: GenerateRequest = {
      kind: "image",
      prompt: "a cat",
      resolution: "1080p",
      params: { width: 640, negative_prompt: "ugly" },
    };
    const def = buildDefaultComfyWorkflow(r);
    expect(def?.comfyInputs["4.width"]).toBe(640);
    expect(def?.comfyInputs["3.text"]).toBe("ugly");
  });

  it("video: routes to image-to-video when an input still is present", () => {
    const r: GenerateRequest = {
      kind: "video",
      prompt: "pan across",
      imageUrls: ["https://cdn.example.com/a.png"],
    };
    const def = buildDefaultComfyWorkflow(r);
    expect(def?.comfyWorkflow).toBe(SVD_I2V_WORKFLOW);
    expect(def?.comfyInputs["2.url"]).toBe("https://cdn.example.com/a.png");
  });

  it("video: maps a camera-movement preset to a motion_bucket_id when none is explicitly set", () => {
    const push: GenerateRequest = {
      kind: "video",
      imageUrls: ["https://cdn.example.com/a.png"],
      cameraMovement: "push_in",
    };
    expect(buildDefaultComfyWorkflow(push)?.comfyInputs["3.motion_bucket_id"]).toBe(140);

    const still: GenerateRequest = {
      kind: "video",
      imageUrls: ["https://cdn.example.com/a.png"],
      cameraMovement: "static",
    };
    expect(buildDefaultComfyWorkflow(still)?.comfyInputs["3.motion_bucket_id"]).toBe(20);
  });

  it("video: an explicit params.motion_bucket_id wins over the camera-movement preset", () => {
    const r: GenerateRequest = {
      kind: "video",
      imageUrls: ["https://cdn.example.com/a.png"],
      cameraMovement: "orbit_cw",
      params: { motion_bucket_id: 200 },
    };
    expect(buildDefaultComfyWorkflow(r)?.comfyInputs["3.motion_bucket_id"]).toBe(200);
  });

  it("video: routes to text-to-video and derives frames from duration × fps", () => {
    const r: GenerateRequest = { kind: "video", prompt: "a comet", duration: 3 };
    const def = buildDefaultComfyWorkflow(r);
    expect(def?.comfyWorkflow).toBe(ANIMATEDIFF_T2V_WORKFLOW);
    // 3s × default 8fps = 24 frames → t2v batch_size.
    expect(def?.comfyInputs["5.batch_size"]).toBe(24);
  });

  it("lipsync: delegates to LatentSync only when both media URLs are present", () => {
    const ok: GenerateRequest = {
      kind: "lipsync",
      videoUrl: "https://cdn.example.com/face.mp4",
      audioUrl: "https://cdn.example.com/voice.wav",
    };
    const def = buildDefaultComfyWorkflow(ok);
    expect(def).not.toBeNull();
    expect(def?.comfyInputs["1.url"]).toBe("https://cdn.example.com/face.mp4");
    expect(def?.comfyInputs["2.url"]).toBe("https://cdn.example.com/voice.wav");

    // Missing audio → no default graph (explicit failure upstream, no silent guess).
    expect(
      buildDefaultComfyWorkflow({ kind: "lipsync", videoUrl: "https://x/face.mp4" }),
    ).toBeNull();
  });

  it("motion: delegates to MimicMotion only when image + driving video are present", () => {
    const ok: GenerateRequest = {
      kind: "motion",
      imageUrls: ["https://cdn.example.com/ref.png"],
      videoUrl: "https://cdn.example.com/drive.mp4",
    };
    const def = buildDefaultComfyWorkflow(ok);
    expect(def).not.toBeNull();
    expect(def?.comfyInputs["1.url"]).toBe("https://cdn.example.com/ref.png");
    expect(def?.comfyInputs["2.url"]).toBe("https://cdn.example.com/drive.mp4");

    // Missing driving video → null.
    expect(
      buildDefaultComfyWorkflow({ kind: "motion", imageUrls: ["https://x/ref.png"] }),
    ).toBeNull();
  });

  it("returns null for kinds with no default graph (upscale / text / audio)", () => {
    expect(buildDefaultComfyWorkflow({ kind: "upscale", prompt: "x" })).toBeNull();
    expect(buildDefaultComfyWorkflow({ kind: "text", prompt: "x" })).toBeNull();
    expect(buildDefaultComfyWorkflow({ kind: "audio", prompt: "x" })).toBeNull();
  });
});
