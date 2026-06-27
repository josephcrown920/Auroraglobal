// Custom URL adapter.
// Covers Colab + ngrok/cloudflared, your own FastAPI server, a ComfyUI proxy,
// or any HTTP endpoint that accepts the flat generalized job contract below.
//
// Required env:
//   CUSTOM_INFERENCE_URL    — full URL to POST to, e.g. "https://abc.ngrok-free.app/generate"
//   CUSTOM_INFERENCE_TOKEN  — optional bearer token
//
// Request body (flat JSON, undefined fields omitted):
//   { task, prompt?, image_urls?, audio_url?, video_url?, mode?, params?, workflow?, workflow_inputs? }
// Expected response: any JSON containing an output URL (url / output_url / video_url / image_url / …).

import type { InferenceInput, InferenceResult, ProbeResult, ProviderAdapter } from "../types";
import { extractOutputUrl, postFlatJob, probeReachable, toResult } from "../protocols";

export const customAdapter: ProviderAdapter = {
  id: "custom",
  label: "Custom URL (Colab / ngrok / self-hosted)",
  requiredEnv: ["CUSTOM_INFERENCE_URL"],
  tasks: ["image", "video", "lipsync", "motion"],

  async probeHealth(timeoutMs?: number): Promise<ProbeResult | null> {
    const url = process.env.CUSTOM_INFERENCE_URL;
    if (!url) return null;
    // Flat POST endpoint has no health route — any HTTP response means it's up.
    return probeReachable(url, { token: process.env.CUSTOM_INFERENCE_TOKEN, timeoutMs });
  },

  async run(input: InferenceInput): Promise<InferenceResult> {
    const url = process.env.CUSTOM_INFERENCE_URL;
    const token = process.env.CUSTOM_INFERENCE_TOKEN;
    if (!url) {
      throw new Error("Custom not configured: set CUSTOM_INFERENCE_URL secret.");
    }

    const json = await postFlatJob(url, token, input);
    if (json && typeof json === "object" && "error" in json && (json as { error?: unknown }).error) {
      throw new Error(`Custom error: ${String((json as { error?: unknown }).error)}`);
    }
    const outputUrl = extractOutputUrl(json);
    if (!outputUrl) throw new Error("Custom response missing an output url");
    return toResult(outputUrl, input, json);
  },
};
