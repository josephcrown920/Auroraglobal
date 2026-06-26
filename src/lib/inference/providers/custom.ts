// Custom URL adapter.
// Covers Colab + ngrok, self-hosted ComfyUI, your own FastAPI server,
// or any HTTP endpoint that accepts the contract below.
//
// Required env:
//   CUSTOM_INFERENCE_URL    — full URL to POST to, e.g. "https://abc.ngrok-free.app/lipsync"
//   CUSTOM_INFERENCE_TOKEN  — optional bearer token
//
// Request body:
//   { audio_url, media_url, mode: "image" | "video" }
// Expected response:
//   { video_url: "https://..." }

import type { InferenceInput, InferenceResult, ProviderAdapter } from "../types";

export const customAdapter: ProviderAdapter = {
  id: "custom",
  label: "Custom URL (Colab / ngrok / ComfyUI / self-hosted)",
  requiredEnv: ["CUSTOM_INFERENCE_URL"],

  async run(input: InferenceInput): Promise<InferenceResult> {
    const url = process.env.CUSTOM_INFERENCE_URL;
    const token = process.env.CUSTOM_INFERENCE_TOKEN;
    if (!url) {
      throw new Error("Custom not configured: set CUSTOM_INFERENCE_URL secret.");
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        audio_url: input.audioUrl,
        media_url: input.mediaUrl,
        mode: input.mode,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Custom endpoint ${res.status}: ${text.slice(0, 300)}`);
    }
    const json = (await res.json()) as { video_url?: string; error?: string };
    if (json.error) throw new Error(`Custom error: ${json.error}`);
    if (!json.video_url) throw new Error("Custom response missing video_url");
    return { videoUrl: json.video_url, raw: json };
  },
};
