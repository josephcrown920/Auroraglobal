// inference.sh adapter — managed cloud GPU "apps" API (https://inference.sh).
// Jobs run named apps (e.g. "infsh/flux") on inference.sh's cloud: POST /run
// creates a task, GET /tasks/{id} is polled until it completes, and the output
// asset URL is dug out of the task's `output` object.
//
// Required env:
//   INFERENCE_SH_API_KEY   — API key from app.inference.sh → Settings → API Keys ("inf_...")
// Optional env:
//   INFERENCE_SH_BASE_URL     — API base (default "https://api.inference.sh")
//   INFERENCE_SH_APP_<TASK>   — app ref per task type, e.g.
//                               INFERENCE_SH_APP_IMAGE="infsh/flux"
//                               INFERENCE_SH_APP_VIDEO="namespace/some-video-app"
//                               (image defaults to "infsh/flux"; every other task
//                               must be mapped explicitly or run() fails explicitly)
//
// App input schemas vary: conventional fields (prompt / image_urls / audio_url /
// video_url) are sent when present and `params` is spread on top (params win).
// A `params.setup` object is lifted out and sent as the task's `setup` block.

import type { InferenceInput, InferenceResult, ProbeResult, ProviderAdapter } from "../types";
import {
  extractOutputUrl,
  inferenceShInput,
  probeReachable,
  resolveInferenceShApp,
  runInferenceShTask,
  toResult,
} from "../protocols";

export const INFERENCE_SH_DEFAULT_BASE = "https://api.inference.sh";

function baseUrl(): string {
  return process.env.INFERENCE_SH_BASE_URL || INFERENCE_SH_DEFAULT_BASE;
}

export const inferenceshAdapter: ProviderAdapter = {
  id: "inferencesh",
  label: "inference.sh (cloud apps)",
  requiredEnv: ["INFERENCE_SH_API_KEY"],
  tasks: ["image", "video", "lipsync", "motion", "tts"],

  async probeHealth(timeoutMs?: number): Promise<ProbeResult | null> {
    if (!process.env.INFERENCE_SH_API_KEY) return null;
    // The OpenAPI catalog answers unauthenticated — a 2xx means the API is up.
    return probeReachable(`${baseUrl()}/openapi.json`, { expectOk: true, timeoutMs });
  },

  async run(input: InferenceInput): Promise<InferenceResult> {
    const token = process.env.INFERENCE_SH_API_KEY;
    if (!token) {
      throw new Error("inference.sh not configured: set INFERENCE_SH_API_KEY secret.");
    }
    const app = resolveInferenceShApp(input.task, process.env);
    if (!app) {
      throw new Error(
        `inference.sh has no app mapped for task "${input.task}": set INFERENCE_SH_APP_${input.task.toUpperCase()} to an app ref like "namespace/app-name".`,
      );
    }

    const { setup, ...params } = (input.params ?? {}) as Record<string, unknown>;
    const task = await runInferenceShTask({
      baseUrl: baseUrl(),
      token,
      app,
      input: inferenceShInput({ ...input, params }),
      setup:
        setup && typeof setup === "object" && !Array.isArray(setup)
          ? (setup as Record<string, unknown>)
          : undefined,
    });

    const outputUrl = extractOutputUrl(task.output) ?? extractOutputUrl(task);
    if (!outputUrl) throw new Error("inference.sh response missing an output url");
    return toResult(outputUrl, input, task);
  },
};
