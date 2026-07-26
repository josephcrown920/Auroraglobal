// Shared types for the pluggable GPU inference layer.
// This folder is self-contained — copy `src/lib/inference/` into any project
// (along with `src/lib/inference.functions.ts`) to reuse the GPU layer.

/** Identifiers for the env-configured GPU backends. */
export type ProviderId = "runpod" | "huggingface" | "custom" | "vast" | "comfyui" | "inferencesh";

/** Generation task types a backend can serve. */
export type TaskType =
  | "image"
  | "video"
  | "lipsync"
  | "motion"
  | "tts"
  | "assemble"
  | "caption_burn"
  | "autocut"
  | "lyric_video";

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

  // ── Legacy lip-sync fields — boundary tombstones ──
  /**
   * @internal @deprecated — normalised at boundary via `normaliseInferenceInput()`.
   * Remove after all deployed Colab/Kaggle workers update to send `image_urls`/`video_url`.
   * Internal code must NOT write or read these fields; use `imageUrls`/`videoUrl` instead.
   */
  mediaUrl?: string;
  /**
   * @internal @deprecated — normalised at boundary via `normaliseInferenceInput()`.
   * Paired with `mediaUrl`; obsolete once all workers stop sending `mode`.
   */
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
  /**
   * Task types this *protocol* can carry over the wire — i.e. the maximum a
   * backend on this protocol could ever serve. This is NOT the same as what a
   * specific configured server actually runs (most self-hosted boxes only run
   * one or two of these). Use `effectiveTasks()` in `./index` to get the
   * owner-declared real capability list for routing/display.
   */
  tasks: TaskType[];
  /**
   * Name of an optional env var (comma-separated `TaskType` list, e.g.
   * "image,video") that lets the owner declare which of `tasks` this specific
   * configured backend genuinely supports. When unset, the backend's real
   * capability is unknown and `effectiveTasks()` falls back to the full
   * `tasks` list (protocol-level, may overstate reality).
   */
  capabilitiesEnvVar?: string;
  /**
   * Optional override that computes the effective capability list some other
   * way than a flat env var (e.g. inference.sh derives it from which
   * `INFERENCE_SH_APP_<TASK>` vars are mapped). Wins over `capabilitiesEnvVar`
   * when present.
   */
  resolveTasks?(): TaskType[];
  /** Run inference and return the result. Throws explicitly on failure. */
  run(input: InferenceInput): Promise<InferenceResult>;
  /**
   * Optional liveness probe against the configured endpoint. Returns `null` when
   * the backend isn't configured (nothing to probe), otherwise `{ ok }` —
   * `ok:false` means it didn't answer healthy / was unreachable.
   */
  probeHealth?(timeoutMs?: number): Promise<ProbeResult | null>;
}

/** Result of a backend liveness probe. */
export interface ProbeResult {
  ok: boolean;
  status?: number;
  error?: string;
}
