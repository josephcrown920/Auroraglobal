// Default ComfyUI prompt-graph builders for text-to-image and text/image-to-video.
//
// ComfyUI is a first-class worker protocol in Aurora: the orchestrator submits a
// prompt graph to a worker's /prompt, polls /history and resolves a /view URL
// (see inference/protocols.ts). Lip-sync (LatentSync) and motion (MimicMotion)
// already ship default graphs; this module adds the two missing free-GPU swarm
// modalities — image and video — so a plain `image`/`video` request (which never
// carries its own `comfyWorkflow`) can still run on a ComfyUI worker.
//
// Mirrors lipsync-/motion-workflows.server.ts: stable node IDs so the builder can
// patch them via "nodeId.inputName" (protocols.patchComfyInputs), exported graph
// constants for the workers/comfyui/*.json references, and clamped tuning knobs.
// A worker may ship its own graph; these are the contracts we target by default.
//
// Node-class requirements (documented in workers/comfyui/README.md):
//   - image  : stock ComfyUI core nodes only (CheckpointLoaderSimple, …, SaveImage).
//   - video  : image-to-video uses core SVD nodes + LoadImageFromUrl + VHS_VideoCombine;
//              text-to-video uses AnimateDiff-Evolved (ADE_AnimateDiffLoaderGen1) + VHS_VideoCombine.

import type { GenerateRequest } from "./orchestrator.server";
import { buildLatentSyncRequest } from "./lipsync-workflows.server";
import { buildMimicMotionRequest } from "./motion-workflows.server";

/** A ComfyUI graph + the per-node "nodeId.inputName" patches to apply to it. */
export type ComfyRequestParts = {
  comfyWorkflow: unknown;
  comfyInputs: Record<string, unknown>;
};

// ─── Image: SDXL text-to-image (stock ComfyUI core nodes) ─────────────────────
export const SDXL_IMAGE_WORKFLOW = {
  "1": {
    class_type: "CheckpointLoaderSimple",
    inputs: { ckpt_name: "sd_xl_base_1.0.safetensors" },
  },
  "2": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["1", 1] } },
  "3": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["1", 1] } },
  "4": { class_type: "EmptyLatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
  "5": {
    class_type: "KSampler",
    inputs: {
      seed: 0,
      steps: 30,
      cfg: 7,
      sampler_name: "dpmpp_2m",
      scheduler: "karras",
      denoise: 1,
      model: ["1", 0],
      positive: ["2", 0],
      negative: ["3", 0],
      latent_image: ["4", 0],
    },
  },
  "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
  "7": { class_type: "SaveImage", inputs: { images: ["6", 0] } },
} as const;

// ─── Video: Stable Video Diffusion image-to-video (core nodes + URL loader) ───
export const SVD_I2V_WORKFLOW = {
  "1": { class_type: "ImageOnlyCheckpointLoader", inputs: { ckpt_name: "svd_xt_1_1.safetensors" } },
  "2": { class_type: "LoadImageFromUrl", inputs: { url: "" } },
  "3": {
    class_type: "SVD_img2vid_Conditioning",
    inputs: {
      clip_vision: ["1", 1],
      init_image: ["2", 0],
      vae: ["1", 2],
      width: 1024,
      height: 576,
      video_frames: 25,
      motion_bucket_id: 127,
      fps: 8,
      augmentation_level: 0,
    },
  },
  "4": { class_type: "VideoLinearCFGGuidance", inputs: { model: ["1", 0], min_cfg: 1 } },
  "5": {
    class_type: "KSampler",
    inputs: {
      seed: 0,
      steps: 20,
      cfg: 2.5,
      sampler_name: "euler",
      scheduler: "karras",
      denoise: 1,
      model: ["4", 0],
      positive: ["3", 0],
      negative: ["3", 1],
      latent_image: ["3", 2],
    },
  },
  "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
  "7": {
    class_type: "VHS_VideoCombine",
    inputs: { images: ["6", 0], frame_rate: 8, format: "video/h264-mp4" },
  },
} as const;

// ─── Video: AnimateDiff text-to-video (AnimateDiff-Evolved + core SD1.5) ───────
export const ANIMATEDIFF_T2V_WORKFLOW = {
  "1": {
    class_type: "CheckpointLoaderSimple",
    inputs: { ckpt_name: "v1-5-pruned-emaonly.safetensors" },
  },
  "2": {
    class_type: "ADE_AnimateDiffLoaderGen1",
    inputs: {
      model: ["1", 0],
      model_name: "mm_sd_v15_v2.ckpt",
      beta_schedule: "sqrt_linear (AnimateDiff)",
    },
  },
  "3": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["1", 1] } },
  "4": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["1", 1] } },
  "5": { class_type: "EmptyLatentImage", inputs: { width: 512, height: 512, batch_size: 16 } },
  "6": {
    class_type: "KSampler",
    inputs: {
      seed: 0,
      steps: 25,
      cfg: 8,
      sampler_name: "euler",
      scheduler: "normal",
      denoise: 1,
      model: ["2", 0],
      positive: ["3", 0],
      negative: ["4", 0],
      latent_image: ["5", 0],
    },
  },
  "7": { class_type: "VAEDecode", inputs: { samples: ["6", 0], vae: ["1", 2] } },
  "8": {
    class_type: "VHS_VideoCombine",
    inputs: { images: ["7", 0], frame_rate: 8, format: "video/h264-mp4" },
  },
} as const;

// ─── Resolution → pixel maps ──────────────────────────────────────────────────
const IMAGE_RES: Record<NonNullable<GenerateRequest["resolution"]>, number> = {
  "480p": 768,
  "720p": 1024,
  "1080p": 1024,
  "2160p": 2048,
};
const VIDEO_RES: Record<NonNullable<GenerateRequest["resolution"]>, [number, number]> = {
  "480p": [768, 432],
  "720p": [1024, 576],
  "1080p": [1280, 720],
  "2160p": [3840, 2160],
};

// ─── Builders ─────────────────────────────────────────────────────────────────
export function buildComfyImageRequest(opts: {
  prompt?: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
}): ComfyRequestParts {
  const width = clampInt(opts.width, 256, 2048, 1024);
  const height = clampInt(opts.height, 256, 2048, 1024);
  const steps = clampInt(opts.steps, 10, 50, 30);
  const cfg = clampNum(opts.cfg, 1, 20, 7);
  const seed = intOr(opts.seed, randSeed());
  return {
    comfyWorkflow: SDXL_IMAGE_WORKFLOW,
    comfyInputs: {
      "2.text": opts.prompt ?? "",
      "3.text": opts.negativePrompt ?? "",
      "4.width": width,
      "4.height": height,
      "5.seed": seed,
      "5.steps": steps,
      "5.cfg": cfg,
    },
  };
}

export function buildComfyVideoRequest(opts: {
  prompt?: string;
  negativePrompt?: string;
  /** When present → image-to-video (SVD); otherwise text-to-video (AnimateDiff). */
  imageUrl?: string;
  width?: number;
  height?: number;
  frames?: number;
  fps?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  motionBucketId?: number;
}): ComfyRequestParts {
  const fps = clampInt(opts.fps, 4, 30, 8);
  const seed = intOr(opts.seed, randSeed());

  if (opts.imageUrl) {
    const width = clampInt(opts.width, 256, 2048, 1024);
    const height = clampInt(opts.height, 256, 2048, 576);
    const frames = clampInt(opts.frames, 8, 120, 25);
    const steps = clampInt(opts.steps, 10, 50, 20);
    const cfg = clampNum(opts.cfg, 1, 20, 2.5);
    const motionBucketId = clampInt(opts.motionBucketId, 1, 255, 127);
    return {
      comfyWorkflow: SVD_I2V_WORKFLOW,
      comfyInputs: {
        "2.url": opts.imageUrl,
        "3.width": width,
        "3.height": height,
        "3.video_frames": frames,
        "3.fps": fps,
        "3.motion_bucket_id": motionBucketId,
        "5.seed": seed,
        "5.steps": steps,
        "5.cfg": cfg,
        "7.frame_rate": fps,
      },
    };
  }

  const width = clampInt(opts.width, 256, 1280, 512);
  const height = clampInt(opts.height, 256, 1280, 512);
  const frames = clampInt(opts.frames, 8, 120, 16);
  const steps = clampInt(opts.steps, 10, 50, 25);
  const cfg = clampNum(opts.cfg, 1, 20, 8);
  return {
    comfyWorkflow: ANIMATEDIFF_T2V_WORKFLOW,
    comfyInputs: {
      "3.text": opts.prompt ?? "",
      "4.text": opts.negativePrompt ?? "",
      "5.width": width,
      "5.height": height,
      "5.batch_size": frames,
      "6.seed": seed,
      "6.steps": steps,
      "6.cfg": cfg,
      "8.frame_rate": fps,
    },
  };
}

/**
 * Pick the default ComfyUI graph for a generalized request by `kind`. Returns
 * `null` for kinds that have no default graph (so the caller can fail explicitly):
 *  - image / video : always buildable from the prompt (+ optional input image).
 *  - lipsync / motion : delegate to the existing builders, but only when the
 *    required media URLs are present — otherwise null keeps the "explicit failure,
 *    no silent fallback" contract for these self-hosted-only kinds.
 *  - upscale / text / audio : no default graph.
 */
export function buildDefaultComfyWorkflow(r: GenerateRequest): ComfyRequestParts | null {
  const params = r.params ?? {};
  switch (r.kind) {
    case "image": {
      const [width, height] = imageDims(r.resolution, params);
      return buildComfyImageRequest({
        prompt: r.prompt,
        negativePrompt: pStr(params, ["negativePrompt", "negative_prompt"]),
        width,
        height,
        steps: pInt(params, ["steps"]),
        cfg: pNum(params, ["cfg", "guidanceScale", "guidance_scale"]),
        seed: pInt(params, ["seed"]),
      });
    }
    case "video": {
      const imageUrl = r.imageUrls?.[0];
      const [width, height] = videoDims(r.resolution, params);
      const fps = pInt(params, ["fps"]) ?? 8;
      const frames =
        pInt(params, ["frames", "num_frames", "video_frames"]) ??
        (r.duration ? Math.round(r.duration * fps) : undefined);
      return buildComfyVideoRequest({
        prompt: r.prompt,
        negativePrompt: pStr(params, ["negativePrompt", "negative_prompt"]),
        imageUrl,
        width,
        height,
        frames,
        fps,
        steps: pInt(params, ["steps"]),
        cfg: pNum(params, ["cfg", "guidanceScale", "guidance_scale"]),
        seed: pInt(params, ["seed"]),
        motionBucketId: pInt(params, ["motionBucketId", "motion_bucket_id"]),
      });
    }
    case "lipsync": {
      if (!r.videoUrl || !r.audioUrl) return null;
      const parts = buildLatentSyncRequest({
        videoUrl: r.videoUrl,
        audioUrl: r.audioUrl,
        params: {
          inferenceSteps: pInt(params, ["inferenceSteps", "inference_steps"]),
          guidanceScale: pNum(params, ["guidanceScale", "guidance_scale"]),
          seed: pInt(params, ["seed"]),
        },
      });
      return { comfyWorkflow: parts.comfyWorkflow, comfyInputs: parts.comfyInputs ?? {} };
    }
    case "motion": {
      const imageUrl = r.imageUrls?.[0];
      if (!imageUrl || !r.videoUrl) return null;
      const parts = buildMimicMotionRequest({
        imageUrl,
        drivingVideoUrl: r.videoUrl,
        prompt: r.prompt,
        params: {
          fps: pInt(params, ["fps"]),
          steps: pInt(params, ["steps"]),
          cfg: pNum(params, ["cfg"]),
          seed: pInt(params, ["seed"]),
          frames: pInt(params, ["frames"]),
        },
      });
      return { comfyWorkflow: parts.comfyWorkflow, comfyInputs: parts.comfyInputs ?? {} };
    }
    default:
      return null;
  }
}

// ─── Param helpers ────────────────────────────────────────────────────────────
function imageDims(
  resolution: GenerateRequest["resolution"],
  params: Record<string, unknown>,
): [number, number] {
  const fromRes = resolution ? IMAGE_RES[resolution] : 1024;
  const width = pInt(params, ["width"]) ?? fromRes;
  const height = pInt(params, ["height"]) ?? fromRes;
  return [width, height];
}

function videoDims(
  resolution: GenerateRequest["resolution"],
  params: Record<string, unknown>,
): [number, number] {
  const [rw, rh] = resolution ? VIDEO_RES[resolution] : [1024, 576];
  const width = pInt(params, ["width"]) ?? rw;
  const height = pInt(params, ["height"]) ?? rh;
  return [width, height];
}

function pInt(params: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = params[k];
    if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  }
  return undefined;
}

function pNum(params: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = params[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

function pStr(params: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = params[k];
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

function clampInt(v: number | undefined, lo: number, hi: number, dflt: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return dflt;
  return Math.max(lo, Math.min(hi, Math.trunc(v)));
}

function clampNum(v: number | undefined, lo: number, hi: number, dflt: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return dflt;
  return Math.max(lo, Math.min(hi, v));
}

function intOr(v: number | undefined, dflt: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : dflt;
}

function randSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647);
}
