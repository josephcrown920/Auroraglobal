// MimicMotion (video-driven pose transfer) request builder.
//
// MimicMotion takes a single reference image + a driving video and produces an
// animated clip of the reference subject following the driving motion. There is
// no hosted API for it — it runs only on a GPU/ComfyUI worker registered in
// `gpu_workers` with the "motion" capability (see orchestrator gpuWorker adapter).
//
// This module owns:
//  - the structured option vocabularies (motion presets + camera moves) so the UI,
//    MCP tools and the worker payload all agree on the SAME enum values, and
//  - a default ComfyUI graph template + a builder that maps those structured
//    options onto BOTH wire contracts at once:
//      * custom / runpod workers read the flat `params` / `video_url` / `image_urls`
//        fields that orchestrator.workerInput() forwards, and
//      * comfyui workers read `comfyWorkflow` + `comfyInputs` ("nodeId.inputName").
//
// Motion/camera intent is carried as STRUCTURED params, never baked into the prompt.

import type { GenerateRequest } from "./orchestrator.server";

// Sentinel model so getCandidateModels() yields a candidate for the motion kind
// (motion has no fallback model list — without this the orchestrate loop would be
// empty and never reach the gpuWorker adapter).
export const MIMIC_MOTION_MODEL = "mimic-motion";

// How faithfully / energetically the reference subject follows the driving video.
export const MOTION_TYPES = ["faithful", "expressive", "subtle", "exaggerated"] as const;
export type MotionType = (typeof MOTION_TYPES)[number];

// Virtual camera move applied on top of the transferred motion.
export const CAMERA_MOVEMENTS = [
  "static", "orbit", "push-in", "pull-out",
  "pan-left", "pan-right", "tilt-up", "tilt-down", "handheld",
] as const;
export type CameraMovement = (typeof CAMERA_MOVEMENTS)[number];

export type MotionParams = {
  motionType?: MotionType;
  cameraMovement?: CameraMovement;
  fps?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  // Frames to render — drives clip length together with fps.
  frames?: number;
  // Keep the reference subject's face identity locked to the still.
  preserveFace?: boolean;
};

const DEFAULTS: Required<Pick<MotionParams, "motionType" | "cameraMovement" | "fps" | "steps" | "cfg" | "frames" | "preserveFace">> = {
  motionType: "faithful",
  cameraMovement: "static",
  fps: 16,
  steps: 25,
  cfg: 2.0,
  frames: 72,
  preserveFace: true,
};

// Default ComfyUI graph for a MimicMotion worker. Node IDs are stable so the
// builder can patch them via "nodeId.inputName" (see protocols.patchComfyInputs).
// A worker is free to ship its own graph; this is the contract we target by default.
export const MIMIC_MOTION_WORKFLOW = {
  "1": { class_type: "LoadImageFromUrl", inputs: { url: "" } },
  "2": { class_type: "LoadVideoFromUrl", inputs: { url: "" } },
  "3": {
    class_type: "MimicMotionSampler",
    inputs: {
      ref_image: ["1", 0],
      pose_video: ["2", 0],
      motion_type: DEFAULTS.motionType,
      camera_movement: DEFAULTS.cameraMovement,
      steps: DEFAULTS.steps,
      cfg: DEFAULTS.cfg,
      fps: DEFAULTS.fps,
      frames: DEFAULTS.frames,
      preserve_face: DEFAULTS.preserveFace,
      seed: 0,
    },
  },
  "4": { class_type: "VideoCombine", inputs: { frames: ["3", 0], fps: DEFAULTS.fps } },
  "5": { class_type: "SaveVideo", inputs: { video: ["4", 0] } },
} as const;

export type BuildMimicMotionOpts = {
  imageUrl: string;
  drivingVideoUrl: string;
  prompt?: string;
  params?: MotionParams;
};

// The subset of GenerateRequest fields a MimicMotion job needs. The caller adds
// userId/refId (server fn / worker) before handing it to orchestrate().
export type MotionGenerateRequest = Pick<
  GenerateRequest,
  "kind" | "model" | "prompt" | "imageUrls" | "videoUrl" | "params" | "comfyWorkflow" | "comfyInputs"
>;

export function normalizeMotionParams(p?: MotionParams): Required<MotionParams> {
  const seed = typeof p?.seed === "number" && Number.isFinite(p.seed)
    ? Math.trunc(p.seed)
    : Math.floor(Math.random() * 2_147_483_647);
  return {
    motionType: p?.motionType && MOTION_TYPES.includes(p.motionType) ? p.motionType : DEFAULTS.motionType,
    cameraMovement: p?.cameraMovement && CAMERA_MOVEMENTS.includes(p.cameraMovement) ? p.cameraMovement : DEFAULTS.cameraMovement,
    fps: clampInt(p?.fps, 8, 30, DEFAULTS.fps),
    steps: clampInt(p?.steps, 10, 50, DEFAULTS.steps),
    cfg: clampNum(p?.cfg, 1, 10, DEFAULTS.cfg),
    seed,
    frames: clampInt(p?.frames, 16, 240, DEFAULTS.frames),
    preserveFace: p?.preserveFace ?? DEFAULTS.preserveFace,
  };
}

function clampInt(v: number | undefined, lo: number, hi: number, dflt: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return dflt;
  return Math.max(lo, Math.min(hi, Math.trunc(v)));
}
function clampNum(v: number | undefined, lo: number, hi: number, dflt: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return dflt;
  return Math.max(lo, Math.min(hi, v));
}

// Build a fully-specified motion request that works on BOTH worker contracts.
export function buildMimicMotionRequest(opts: BuildMimicMotionOpts): MotionGenerateRequest {
  const p = normalizeMotionParams(opts.params);
  return {
    kind: "motion",
    model: MIMIC_MOTION_MODEL,
    prompt: opts.prompt,
    imageUrls: [opts.imageUrl],
    videoUrl: opts.drivingVideoUrl,
    // Flat params for custom/runpod workers (forwarded by workerInput()).
    params: {
      motion_type: p.motionType,
      camera_movement: p.cameraMovement,
      fps: p.fps,
      steps: p.steps,
      cfg: p.cfg,
      seed: p.seed,
      frames: p.frames,
      preserve_face: p.preserveFace,
    },
    // ComfyUI graph + per-node patches for comfyui workers.
    comfyWorkflow: MIMIC_MOTION_WORKFLOW,
    comfyInputs: {
      "1.url": opts.imageUrl,
      "2.url": opts.drivingVideoUrl,
      "3.motion_type": p.motionType,
      "3.camera_movement": p.cameraMovement,
      "3.steps": p.steps,
      "3.cfg": p.cfg,
      "3.fps": p.fps,
      "3.frames": p.frames,
      "3.preserve_face": p.preserveFace,
      "3.seed": p.seed,
      "4.fps": p.fps,
    },
  };
}
