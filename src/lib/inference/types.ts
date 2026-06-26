// Shared types for the lip-sync inference layer.
// This folder is self-contained — copy `src/lib/inference/` into any project
// (along with `src/lib/inference.functions.ts`) to reuse the GPU layer.

export type ProviderId = "runpod" | "huggingface" | "custom";

export type InputMode = "image" | "video";

export interface InferenceInput {
  /** Public (or signed) URL to the driving audio file. */
  audioUrl: string;
  /** Public (or signed) URL to the reference image or video. */
  mediaUrl: string;
  /** Whether `mediaUrl` is an image or a video. */
  mode: InputMode;
}

export interface InferenceResult {
  /** URL of the generated lip-synced video. */
  videoUrl: string;
  /** Provider-specific raw response for debugging. */
  raw?: unknown;
}

export interface ProviderAdapter {
  id: ProviderId;
  label: string;
  /** Returns the names of the env vars this adapter needs. */
  requiredEnv: string[];
  /** Run inference and return the result. Throws on failure. */
  run(input: InferenceInput): Promise<InferenceResult>;
}
