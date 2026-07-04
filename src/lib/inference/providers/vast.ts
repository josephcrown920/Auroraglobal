// Vast.ai adapter.
// A Vast.ai instance is a GPU box running *your* HTTP server (FastAPI, ComfyUI
// wrapper, etc.) exposed on a mapped port. It speaks the same flat generalized
// job contract as the custom adapter, but with its own env vars so a Vast.ai box
// and a Colab/ngrok box can both be configured at the same time.
//
// Required env:
//   VAST_INFERENCE_URL    — full URL to POST to, e.g. "https://12.34.56.78:8000/generate"
//   VAST_INFERENCE_TOKEN  — optional bearer token
//   VAST_INFERENCE_TASKS  — optional comma list declaring what this box
//                           actually runs (e.g. "video"). Defaults to every
//                           task the flat protocol can carry, which may
//                           overstate a single-model box's real capability.
//
// Request body / response: identical to the custom adapter (see custom.ts).

import type { InferenceInput, InferenceResult, ProbeResult, ProviderAdapter } from "../types";
import { extractOutputUrl, postFlatJob, probeReachable, toResult } from "../protocols";

export const vastAdapter: ProviderAdapter = {
  id: "vast",
  label: "Vast.ai (self-hosted HTTP)",
  requiredEnv: ["VAST_INFERENCE_URL"],
  tasks: ["image", "video", "lipsync", "motion"],
  capabilitiesEnvVar: "VAST_INFERENCE_TASKS",

  async probeHealth(timeoutMs?: number): Promise<ProbeResult | null> {
    const url = process.env.VAST_INFERENCE_URL;
    if (!url) return null;
    // Flat POST endpoint has no health route — any HTTP response means it's up.
    return probeReachable(url, { token: process.env.VAST_INFERENCE_TOKEN, timeoutMs });
  },

  async run(input: InferenceInput): Promise<InferenceResult> {
    const url = process.env.VAST_INFERENCE_URL;
    const token = process.env.VAST_INFERENCE_TOKEN;
    if (!url) {
      throw new Error("Vast.ai not configured: set VAST_INFERENCE_URL secret.");
    }

    const json = await postFlatJob(url, token, input);
    if (
      json &&
      typeof json === "object" &&
      "error" in json &&
      (json as { error?: unknown }).error
    ) {
      throw new Error(`Vast.ai error: ${String((json as { error?: unknown }).error)}`);
    }
    const outputUrl = extractOutputUrl(json);
    if (!outputUrl) throw new Error("Vast.ai response missing an output url");
    return toResult(outputUrl, input, json);
  },
};
