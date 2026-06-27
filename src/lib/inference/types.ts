// Shared types for the pluggable GPU inference layer.
// This folder is self-contained — copy `src/lib/inference/` into any project
// (along with `src/lib/inference.functions.ts`) to reuse the GPU layer.

/** Identifiers for the env-configured GPU backends. */
export type ProviderId = "runpod" | "huggingface" | "custom" | "vast" | "comfyui";

/** Generation task types a backend can serve. */
export type TaskType = "image" | "video" | "lipsync" | "motion";

/** Whether a legacy lip-sync `mediaUrl` is an image or a video. */
export type InputMode = "image" | "video";

/**
 * Generalized inference job. Beyond the original lip-sync `audio + media` shape,
 * a job can now carry a prompt, reference image(s), a driving/source video, free
 * `params`, and an optional ComfyUI workflow + per-node input patches. The legacy
 * `mediaUrl`/`mode` fields are kept (optional) so existing lip-sync callers work.
 */
export interface InferenceInput {
  /** What kind of generation this is. */
  task: TaskType;
  /** Text prompt (image/video/motion). */
  prompt?: string;
  /** Reference image URL(s) — first is the primary subject/start frame. */
  imageUrls?: string[];
  /** Driving audio URL (lip-sync). */
  audioUrl?: string;
  /** Driving/source video URL (motion, or the face video for lip-sync). */
  videoUrl?: string;
  /** Free-form provider/model params (resolution, fps, seed, etc.). */
  params?: Record<string, unknown>;
  /** A ComfyUI prompt graph (JSON) for the generic ComfyUI dispatch. */
  comfyWorkflow?: unknown;
  /** `"nodeId.inputName": value` patches applied to `comfyWorkflow` before submit. */
  comfyInputs?: Record<string, unknown>;

  // ── Legacy lip-sync fields (kept for backward compatibility) ──
  /** @deprecated Use `imageUrls`/`videoUrl`. The reference image or video URL. */
  mediaUrl?: string;
  /** @deprecated Whether `mediaUrl` is an image or a video. */
  mode?: InputMode;
}

export interface InferenceResult {
  /** URL of the generated output asset (image or video). */
  outputUrl: string;
  /** Populated for non-image tasks (video/lipsync/motion) — legacy compat field. */
  videoUrl?: string;
  /** Provider-specific raw response for debugging. */
  raw?: unknown;
}

export interface ProviderAdapter {
  id: ProviderId;
  label: string;
  /** Names of the env vars this adapter needs to be considered configured. */
  requiredEnv: string[];
  /** Task types this backend can serve. */
  tasks: TaskType[];
  /** Run inference and return the result. Throws explicitly on failure. */
  run(input: InferenceInput): Promise<InferenceResult>;
}
