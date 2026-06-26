// RunPod Serverless adapter.
// Uses the /runsync endpoint, which blocks until the worker finishes (or 30s).
// For longer jobs switch to /run + poll /status/{id}.
//
// Required env:
//   RUNPOD_API_KEY      — your RunPod API key
//   RUNPOD_ENDPOINT_ID  — the serverless endpoint ID (e.g. "abc123xyz")
//
// Worker contract (your handler.py on RunPod must accept):
//   { input: { audio_url, media_url, mode: "image" | "video" } }
// And return:
//   { output: { video_url } }   — or { output: { video_base64 } }

import type { InferenceInput, InferenceResult, ProviderAdapter } from "../types";

export const runpodAdapter: ProviderAdapter = {
  id: "runpod",
  label: "RunPod Serverless",
  requiredEnv: ["RUNPOD_API_KEY", "RUNPOD_ENDPOINT_ID"],

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
      body: JSON.stringify({
        input: {
          audio_url: input.audioUrl,
          media_url: input.mediaUrl,
          mode: input.mode,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`RunPod ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      status?: string;
      output?: { video_url?: string; video_base64?: string };
      error?: string;
    };

    if (json.error) throw new Error(`RunPod error: ${json.error}`);
    if (json.status && json.status !== "COMPLETED") {
      throw new Error(`RunPod status: ${json.status} — increase timeout or use /run + polling.`);
    }

    const videoUrl = json.output?.video_url;
    if (!videoUrl) {
      throw new Error("RunPod response missing output.video_url");
    }
    return { videoUrl, raw: json };
  },
};
