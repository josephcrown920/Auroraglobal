// LatentSync (self-hosted lip-sync) request builder.
//
// LatentSync takes a face video + a driving audio track and re-renders the mouth
// to match the audio. There is NO hosted API for it — it runs only on a GPU
// worker registered in `gpu_workers` with the "lipsync" capability, reached via
// the orchestrator's gpuWorker adapter with `selfHostedOnly` routing.
//
// This module mirrors motion-workflows.server.ts: it maps tuning knobs onto BOTH
// worker contracts at once so a single request works on every protocol —
//   * custom / runpod / hfspace workers read the flat `audio_url` / `video_url`
//     / `params` fields that orchestrator.workerInput() forwards, and
//   * comfyui workers read `comfyWorkflow` + `comfyInputs` ("nodeId.inputName").

import type { GenerateRequest } from "./orchestrator.server";

// Model key for self-hosted LatentSync (also registered in MODEL_REGISTRY).
export const LATENTSYNC_MODEL = "latentsync";

export type LatentSyncParams = {
  /** Diffusion inference steps — higher = sharper mouth, slower. */
  inferenceSteps?: number;
  /** Classifier-free guidance scale. */
  guidanceScale?: number;
  seed?: number;
};

const DEFAULTS = { inferenceSteps: 20, guidanceScale: 1.5 } as const;

// Default ComfyUI graph for a LatentSync worker. Node IDs are stable so the
// builder can patch them via "nodeId.inputName" (see protocols.patchComfyInputs).
// A worker may ship its own graph; this is the contract we target by default.
export const LATENTSYNC_WORKFLOW = {
  "1": { class_type: "LoadVideoFromUrl", inputs: { url: "" } },
  "2": { class_type: "LoadAudioFromUrl", inputs: { url: "" } },
  "3": {
    class_type: "LatentSyncSampler",
    inputs: {
      video: ["1", 0],
      audio: ["2", 0],
      inference_steps: DEFAULTS.inferenceSteps,
      guidance_scale: DEFAULTS.guidanceScale,
      seed: 0,
    },
  },
  "4": { class_type: "VideoCombine", inputs: { frames: ["3", 0] } },
  "5": { class_type: "SaveVideo", inputs: { video: ["4", 0] } },
} as const;

// The subset of GenerateRequest fields the builder fills in. The caller merges
// these onto the lip-sync orchestrate() request only when the engine is
// self-hosted (so the hosted Sync.so / Wav2Lip paths are never affected).
export type LatentSyncRequestParts = Pick<
  GenerateRequest,
  "params" | "comfyWorkflow" | "comfyInputs"
>;

export function buildLatentSyncRequest(opts: {
  videoUrl: string;
  audioUrl: string;
  params?: LatentSyncParams;
}): LatentSyncRequestParts {
  const steps = clampInt(opts.params?.inferenceSteps, 10, 50, DEFAULTS.inferenceSteps);
  const cfg = clampNum(opts.params?.guidanceScale, 1, 5, DEFAULTS.guidanceScale);
  const seed =
    typeof opts.params?.seed === "number" && Number.isFinite(opts.params.seed)
      ? Math.trunc(opts.params.seed)
      : Math.floor(Math.random() * 2_147_483_647);
  return {
    // Flat params for custom / runpod / hfspace workers (forwarded by workerInput()).
    params: { inference_steps: steps, guidance_scale: cfg, seed },
    // ComfyUI graph + per-node patches for comfyui workers.
    comfyWorkflow: LATENTSYNC_WORKFLOW,
    comfyInputs: {
      "1.url": opts.videoUrl,
      "2.url": opts.audioUrl,
      "3.inference_steps": steps,
      "3.guidance_scale": cfg,
      "3.seed": seed,
    },
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
