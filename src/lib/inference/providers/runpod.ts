// RunPod Serverless adapter.
// Uses the /runsync endpoint, which blocks until the worker finishes (or 30s).
// For longer jobs switch to /run + poll /status/{id} (see the worker registry).
//
// Required env:
//   RUNPOD_API_KEY      — your RunPod API key
//   RUNPOD_ENDPOINT_ID  — the serverless endpoint ID (e.g. "abc123xyz")
//
// Worker contract (your handler.py on RunPod receives the generalized job under
// `input`): { input: { task, prompt?, image_urls?, audio_url?, video_url?, mode?,
// params?, workflow?, workflow_inputs? } } and returns a payload containing an
// output URL (e.g. { output: { video_url } } or { output: { image_url } }).

import type { InferenceInput, InferenceResult, ProbeResult, ProviderAdapter } from "../types";
import { extractOutputUrl, jobBody, probeReachable, toResult } from "../protocols";

export const runpodAdapter: ProviderAdapter = {
  id: "runpod",
  label: "RunPod Serverless",
  requiredEnv: ["RUNPOD_API_KEY", "RUNPOD_ENDPOINT_ID"],
  tasks: ["image", "video", "lipsync", "motion"],

  async probeHealth(timeoutMs?: number): Promise<ProbeResult | null> {
    const apiKey = process.env.RUNPOD_API_KEY;
    const endpointId = process.env.RUNPOD_ENDPOINT_ID;
    if (!apiKey || !endpointId) return null;
    // RunPod serverless exposes /health (auth required) — require a 2xx.
    return probeReachable(`https://api.runpod.ai/v2/${endpointId}/health`, { token: apiKey, expectOk: true, timeoutMs });
  },

  async run(input: InferenceInput): Promise<InferenceResult> {
    const apiKey = process.env.RUNPOD_API_KEY;
    const endpointId = process.env.RUNPOD_ENDPOINT_ID;
    if (!apiKey || !endpointId) {
      throw new Error("RunPod not configured: set RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID secrets.");
    }

    const res = await fetch(`https://api.runpod.ai/v2/${endpointId}/runsync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: jobBody(input) }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`RunPod ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as { status?: string; output?: unknown; error?: string };

    if (json.error) throw new Error(`RunPod error: ${json.error}`);
    if (json.status && json.status !== "COMPLETED") {
      throw new Error(`RunPod status: ${json.status} — increase timeout or use /run + polling.`);
    }

    const outputUrl = extractOutputUrl(json.output) ?? extractOutputUrl(json);
    if (!outputUrl) throw new Error("RunPod response missing an output url");
    return toResult(outputUrl, input, json);
  },
};
