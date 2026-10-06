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
//   - image  : Flux.2 Dev (with a Flux.2 edit graph when an input image is present).
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

// Modern Flux.2 Dev prompt graphs converted from the reference blueprints.
export const FLUX2_IMAGE_WORKFLOW = {
  "1": { class_type: "UNETLoader", inputs: { unet_name: "flux2_dev_fp8mixed.safetensors", weight_dtype: "default" } },
  "2": { class_type: "CLIPLoader", inputs: { clip_name: "mistral_3_small_flux2_bf16.safetensors", type: "flux2", device: "default" } },
  "3": { class_type: "VAELoader", inputs: { vae_name: "full_encoder_small_decoder.safetensors" } },
  "4": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["2", 0] } },
  "5": { class_type: "FluxGuidance", inputs: { conditioning: ["4", 0], guidance: 4 } },
  "6": { class_type: "BasicGuider", inputs: { model: ["1", 0], conditioning: ["5", 0] } },
  "7": { class_type: "KSamplerSelect", inputs: { sampler_name: "euler" } },
  "8": { class_type: "Flux2Scheduler", inputs: { steps: 20, width: 1024, height: 1024 } },
  "9": { class_type: "EmptyFlux2LatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
  "10": { class_type: "RandomNoise", inputs: { noise_seed: 0 } },
  "11": { class_type: "SamplerCustomAdvanced", inputs: { noise: ["10", 0], guider: ["6", 0], sampler: ["7", 0], sigmas: ["8", 0], latent_image: ["9", 0] } },
  "12": { class_type: "VAEDecode", inputs: { samples: ["11", 0], vae: ["3", 0] } },
  "13": { class_type: "SaveImage", inputs: { images: ["12", 0] } },
} as const;

export const FLUX2_EDIT_WORKFLOW = {
  "1": { class_type: "LoadImageFromUrl", inputs: { url: "" } },
  "2": { class_type: "UNETLoader", inputs: { unet_name: "flux2_dev_fp8mixed.safetensors", weight_dtype: "default" } },
  "3": { class_type: "CLIPLoader", inputs: { clip_name: "mistral_3_small_flux2_bf16.safetensors", type: "flux2", device: "default" } },
  "4": { class_type: "VAELoader", inputs: { vae_name: "full_encoder_small_decoder.safetensors" } },
  "5": { class_type: "VAEEncode", inputs: { pixels: ["1", 0], vae: ["4", 0] } },
  "6": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["3", 0] } },
  "7": { class_type: "FluxGuidance", inputs: { conditioning: ["6", 0], guidance: 4 } },
  "8": { class_type: "ReferenceLatent", inputs: { conditioning: ["7", 0], latent: ["5", 0] } },
  "9": { class_type: "BasicGuider", inputs: { model: ["2", 0], conditioning: ["8", 0] } },
  "10": { class_type: "KSamplerSelect", inputs: { sampler_name: "euler" } },
  "11": { class_type: "Flux2Scheduler", inputs: { steps: 20, width: 1024, height: 1024 } },
  "12": { class_type: "EmptyFlux2LatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
  "13": { class_type: "RandomNoise", inputs: { noise_seed: 0 } },
  "14": { class_type: "SamplerCustomAdvanced", inputs: { noise: ["13", 0], guider: ["9", 0], sampler: ["10", 0], sigmas: ["11", 0], latent_image: ["12", 0] } },
  "15": { class_type: "VAEDecode", inputs: { samples: ["14", 0], vae: ["4", 0] } },
  "16": { class_type: "SaveImage", inputs: { images: ["15", 0] } },
} as const;

function ltxWorkflow(imageToVideo: boolean) {
  const imageNodes = imageToVideo
    ? {
        "19": { class_type: "LoadImageFromUrl", inputs: { url: "" } },
        "20": { class_type: "ResizeImagesByLongerEdge", inputs: { images: ["19", 0], longer_edge: 1536 } },
        "21": { class_type: "LTXVPreprocess", inputs: { image: ["20", 0], img_compression: 18 } },
        "22": { class_type: "LTXVImgToVideoInplace", inputs: { vae: ["1", 2], image: ["21", 0], latent: ["8", 0], strength: 0.7, bypass: false } },
      }
    : {};
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "ltx-2.3-22b-dev-fp8.safetensors" } },
    "2": { class_type: "LTXAVTextEncoderLoader", inputs: { text_encoder: "gemma_3_12B_it_fp4_mixed.safetensors", ckpt_name: "ltx-2.3-22b-dev-fp8.safetensors", device: "default" } },
    "3": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["2", 0] } },
    "4": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["2", 0] } },
    "5": { class_type: "LTXVConditioning", inputs: { positive: ["3", 0], negative: ["4", 0], frame_rate: 24 } },
    "6": { class_type: "LTXVAudioVAELoader", inputs: { ckpt_name: "ltx-2.3-22b-dev-fp8.safetensors" } },
    "7": { class_type: "LTXVEmptyLatentAudio", inputs: { audio_vae: ["6", 0], frames_number: 97, frame_rate: 24, batch_size: 1 } },
    "8": { class_type: "EmptyLTXVLatentVideo", inputs: { width: 768, height: 512, length: 97, batch_size: 1 } },
    "9": { class_type: "LTXVConcatAVLatent", inputs: { video_latent: [imageToVideo ? "22" : "8", 0], audio_latent: ["7", 0] } },
    "10": { class_type: "KSamplerSelect", inputs: { sampler_name: "euler_cfg_pp" } },
    "11": { class_type: "ManualSigmas", inputs: { sigmas: "0.85, 0.7250, 0.4219, 0.0" } },
    "12": { class_type: "CFGGuider", inputs: { model: ["1", 0], positive: ["5", 0], negative: ["5", 1], cfg: 1 } },
    "13": { class_type: "RandomNoise", inputs: { noise_seed: 0 } },
    "14": { class_type: "SamplerCustomAdvanced", inputs: { noise: ["13", 0], guider: ["12", 0], sampler: ["10", 0], sigmas: ["11", 0], latent_image: ["9", 0] } },
    "15": { class_type: "LTXVSeparateAVLatent", inputs: { av_latent: ["14", 0] } },
    "16": { class_type: "VAEDecodeTiled", inputs: { samples: ["15", 0], vae: ["1", 2], tile_size: 768, overlap: 64, temporal_size: 4096, temporal_overlap: 4 } },
    "17": { class_type: "LTXVAudioVAEDecode", inputs: { samples: ["15", 1], audio_vae: ["6", 0] } },
    "18": { class_type: "CreateVideo", inputs: { images: ["16", 0], audio: ["17", 0], fps: 24 } },
    ...imageNodes,
  };
}

export const LTX23_T2V_WORKFLOW = ltxWorkflow(false);
export const LTX23_I2V_WORKFLOW = ltxWorkflow(true);

function wanWorkflow(imageToVideo: boolean) {
  const imageNodes = imageToVideo
    ? {
        "11": { class_type: "LoadImageFromUrl", inputs: { url: "" } },
        "12": { class_type: "WanImageToVideo", inputs: { positive: ["9", 0], negative: ["10", 0], vae: ["2", 0], start_image: ["11", 0], width: 640, height: 640, length: 81, batch_size: 1 } },
      }
    : {
        "11": { class_type: "EmptyHunyuanLatentVideo", inputs: { width: 640, height: 640, length: 81, batch_size: 1 } },
      };
  const latent = imageToVideo ? "12" : "11";
  return {
    "1": { class_type: "CLIPLoader", inputs: { clip_name: "umt5_xxl_fp8_e4m3fn_scaled.safetensors", type: "wan", device: "default" } },
    "2": { class_type: "VAELoader", inputs: { vae_name: "wan_2.1_vae.safetensors" } },
    "3": { class_type: "UNETLoader", inputs: { unet_name: imageToVideo ? "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors" : "wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors", weight_dtype: "default" } },
    "4": { class_type: "UNETLoader", inputs: { unet_name: imageToVideo ? "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors" : "wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors", weight_dtype: "default" } },
    "5": { class_type: "ModelSamplingSD3", inputs: { model: ["3", 0], shift: 5 } },
    "6": { class_type: "ModelSamplingSD3", inputs: { model: ["4", 0], shift: 5 } },
    "7": { class_type: "LoraLoaderModelOnly", inputs: { model: ["5", 0], lora_name: imageToVideo ? "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors" : "wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors", strength_model: 1 } },
    "8": { class_type: "LoraLoaderModelOnly", inputs: { model: ["6", 0], lora_name: imageToVideo ? "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors" : "wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors", strength_model: 1 } },
    "9": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["1", 0] } },
    "10": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["1", 0] } },
    ...imageNodes,
    "13": { class_type: "KSamplerAdvanced", inputs: { model: ["7", 0], positive: ["9", 0], negative: ["10", 0], latent_image: [latent, 0], add_noise: "enable", noise_seed: 0, steps: 4, cfg: 1, sampler_name: "euler", scheduler: "simple", start_at_step: 0, end_at_step: 2, return_with_leftover_noise: "enable" } },
    "14": { class_type: "KSamplerAdvanced", inputs: { model: ["8", 0], positive: ["9", 0], negative: ["10", 0], latent_image: ["13", 0], add_noise: "disable", noise_seed: 0, steps: 4, cfg: 1, sampler_name: "euler", scheduler: "simple", start_at_step: 2, end_at_step: 4, return_with_leftover_noise: "disable" } },
    "15": { class_type: "VAEDecode", inputs: { samples: ["14", 0], vae: ["2", 0] } },
    "16": { class_type: "CreateVideo", inputs: { images: ["15", 0], fps: 16 } },
  };
}

export const WAN22_T2V_WORKFLOW = wanWorkflow(false);
export const WAN22_I2V_WORKFLOW = wanWorkflow(true);

// ─── Camera-movement preset → SVD motion strength ─────────────────────────────
// SVD has no notion of camera direction, only a single "motion_bucket_id"
// intensity knob (1-255, higher = more motion). When the caller picked a
// camera-movement preset (see studio.functions.ts CAMERA_HINTS) but didn't
// explicitly override motion_bucket_id, translate the preset into a sane
// default intensity so self-hosted SVD workers actually react to the user's
// choice instead of always rendering the flat 127 default.
const CAMERA_MOVEMENT_MOTION_BUCKET: Record<string, number> = {
  static: 20,
  zoom_in: 110,
  zoom_out: 110,
  push_in: 140,
  pull_out: 140,
  pan_left: 100,
  pan_right: 100,
  tilt_up: 90,
  tilt_down: 90,
  orbit_cw: 160,
  orbit_ccw: 160,
};

function motionBucketForCameraMovement(cameraMovement: string | null | undefined): number | undefined {
  if (!cameraMovement) return undefined;
  return CAMERA_MOVEMENT_MOTION_BUCKET[cameraMovement];
}

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
  imageUrl?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  model?: string;
}): ComfyRequestParts {
  const width = clampInt(opts.width, 256, 2048, 1024);
  const height = clampInt(opts.height, 256, 2048, 1024);
  const steps = clampInt(opts.steps, 10, 50, 30);
  const seed = intOr(opts.seed, randSeed());
  if (opts.model === "legacy") {
    return {
      comfyWorkflow: SDXL_IMAGE_WORKFLOW,
      comfyInputs: {
        "2.text": opts.prompt ?? "",
        "3.text": opts.negativePrompt ?? "",
        "4.width": width,
        "4.height": height,
        "5.seed": seed,
        "5.steps": steps,
        "5.cfg": clampNum(opts.cfg, 1, 20, 7),
      },
    };
  }
  if (opts.imageUrl) {
    if (isLegacyModel(opts.model)) {
      return { comfyWorkflow: SVD_I2V_WORKFLOW, comfyInputs: { "2.url": opts.imageUrl } };
    }
    return {
      comfyWorkflow: FLUX2_EDIT_WORKFLOW,
      comfyInputs: {
        "1.url": opts.imageUrl,
        "6.text": opts.prompt ?? "",
        "11.width": width,
        "11.height": height,
        "12.width": width,
        "12.height": height,
        "13.noise_seed": seed,
      },
    };
  }
  return {
    comfyWorkflow: FLUX2_IMAGE_WORKFLOW,
    comfyInputs: {
      "4.text": opts.prompt ?? "",
      "8.width": width,
      "8.height": height,
      "8.steps": steps,
      "9.width": width,
      "9.height": height,
      "10.noise_seed": seed,
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
  model?: string;
}): ComfyRequestParts {
  const fps = clampInt(opts.fps, 4, 30, 8);
  const seed = intOr(opts.seed, randSeed());

  if (opts.imageUrl) {
    if (isLegacyModel(opts.model)) {
      const width = clampInt(opts.width, 256, 2048, 1024);
      const height = clampInt(opts.height, 256, 2048, 576);
      const frames = clampInt(opts.frames, 8, 120, 25);
      return {
        comfyWorkflow: SVD_I2V_WORKFLOW,
        comfyInputs: {
          "2.url": opts.imageUrl,
          "3.width": width,
          "3.height": height,
          "3.video_frames": frames,
          "3.motion_bucket_id": clampInt(opts.motionBucketId, 1, 255, 127),
          "3.fps": fps,
          "5.seed": seed,
          "5.steps": clampInt(opts.steps, 10, 50, 20),
        },
      };
    }
    const width = clampInt(opts.width, 256, 2048, 1024);
    const height = clampInt(opts.height, 256, 2048, 576);
    const frames = clampInt(opts.frames, 8, 120, 25);
    return {
      comfyWorkflow: isWanModel(opts.model) ? WAN22_I2V_WORKFLOW : LTX23_I2V_WORKFLOW,
      comfyInputs: {
        ...(isWanModel(opts.model)
          ? {
              "11.url": opts.imageUrl,
              "12.width": width,
              "12.height": height,
              "12.length": frames,
              "13.noise_seed": seed,
              "14.noise_seed": seed,
              "16.fps": fps,
            }
          : {
              "19.url": opts.imageUrl,
              "8.width": width,
              "8.height": height,
              "8.length": frames,
              "13.noise_seed": seed,
              "18.fps": fps,
            }),
      },
    };
  }

  if (opts.model === "legacy") {
    return {
      comfyWorkflow: ANIMATEDIFF_T2V_WORKFLOW,
      comfyInputs: { "3.text": opts.prompt ?? "", "4.text": opts.negativePrompt ?? "", "6.seed": seed },
    };
  }

  const width = clampInt(opts.width, 256, 1280, 512);
  const height = clampInt(opts.height, 256, 1280, 512);
  const frames = clampInt(opts.frames, 8, 120, 16);
  return {
    comfyWorkflow: isWanModel(opts.model) ? WAN22_T2V_WORKFLOW : LTX23_T2V_WORKFLOW,
    comfyInputs: {
      ...(isWanModel(opts.model)
        ? {
            "9.text": opts.prompt ?? "",
            "10.text": opts.negativePrompt ?? "",
            "11.width": width,
            "11.height": height,
            "11.length": frames,
            "13.noise_seed": seed,
            "14.noise_seed": seed,
            "16.fps": fps,
          }
        : {
            "3.text": opts.prompt ?? "",
            "4.text": opts.negativePrompt ?? "",
            "8.width": width,
            "8.height": height,
            "8.length": frames,
            "13.noise_seed": seed,
            "18.fps": fps,
          }),
    },
  };
}

function isWanModel(model: string | undefined): boolean {
  return !!model && /wan(?:[-_. ]?2\.2)?/i.test(model);
}

function isLegacyModel(model: string | undefined): boolean {
  return model === "legacy" || model === "sdxl" || model === "svd" || model === "animatediff";
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
        imageUrl: r.imageUrls?.[0],
        negativePrompt: pStr(params, ["negativePrompt", "negative_prompt"]),
        width,
        height,
        steps: pInt(params, ["steps"]),
        cfg: pNum(params, ["cfg", "guidanceScale", "guidance_scale"]),
        seed: pInt(params, ["seed"]),
        model: pStr(params, ["comfyModel", "comfy_model", "model"]) ?? r.model,
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
        motionBucketId:
          pInt(params, ["motionBucketId", "motion_bucket_id"]) ??
          motionBucketForCameraMovement(r.cameraMovement),
        model: pStr(params, ["comfyModel", "comfy_model", "model"]) ?? r.model,
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
