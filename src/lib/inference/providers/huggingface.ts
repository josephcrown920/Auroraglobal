// Hugging Face Space (Gradio) adapter.
// Calls a Space's Gradio REST API. Works with both the legacy /run/predict
// endpoint and the modern /gradio_api/call/<fn>/<event_id> SSE endpoint.
//
// Required env:
//   HF_SPACE_URL    — e.g. "https://username-spacename.hf.space"
//   HF_TOKEN        — optional, only needed for private Spaces
//   HF_FN_NAME      — optional, defaults to "predict"
//
// Space contract: the Gradio function must accept (audio_url, media_url, mode)
// or (audio_file, media_file, mode) — adjust HF_INPUT_SHAPE below if needed.

import type { InferenceInput, InferenceResult, ProviderAdapter } from "../types";

async function callGradioSSE(
  spaceUrl: string,
  fnName: string,
  token: string | undefined,
  data: unknown[],
): Promise<unknown> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  // 1. POST to start the job, get an event_id
  const startRes = await fetch(`${spaceUrl}/gradio_api/call/${fnName}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data }),
  });
  if (!startRes.ok) {
    throw new Error(`HF Space ${startRes.status}: ${(await startRes.text()).slice(0, 300)}`);
  }
  const { event_id } = (await startRes.json()) as { event_id: string };

  // 2. GET the SSE stream and read until we see "complete"
  const sseRes = await fetch(`${spaceUrl}/gradio_api/call/${fnName}/${event_id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!sseRes.ok || !sseRes.body) {
    throw new Error(`HF Space SSE ${sseRes.status}`);
  }

  const reader = sseRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("event:")) currentEvent = line.slice(6).trim();
      else if (line.startsWith("data:")) {
        const payload = line.slice(5).trim();
        if (currentEvent === "complete") {
          try { return JSON.parse(payload); } catch { return payload; }
        }
        if (currentEvent === "error") {
          throw new Error(`HF Space error: ${payload.slice(0, 300)}`);
        }
      }
    }
  }
  throw new Error("HF Space SSE ended without a 'complete' event");
}

function extractVideoUrl(result: unknown, spaceUrl: string): string {
  // Gradio returns an array; the video output is usually { url } or { path }.
  const arr = Array.isArray(result) ? result : [result];
  for (const item of arr) {
    if (typeof item === "string" && item.startsWith("http")) return item;
    if (item && typeof item === "object") {
      const obj = item as { url?: string; path?: string; video?: { url?: string } };
      if (obj.url) return obj.url;
      if (obj.video?.url) return obj.video.url;
      if (obj.path) return `${spaceUrl}/gradio_api/file=${obj.path}`;
    }
  }
  throw new Error(`Could not find video URL in HF response: ${JSON.stringify(result).slice(0, 300)}`);
}

export const huggingfaceAdapter: ProviderAdapter = {
  id: "huggingface",
  label: "Hugging Face Space (Gradio)",
  requiredEnv: ["HF_SPACE_URL"],

  async run(input: InferenceInput): Promise<InferenceResult> {
    const spaceUrl = process.env.HF_SPACE_URL?.replace(/\/$/, "");
    const token = process.env.HF_TOKEN;
    const fnName = process.env.HF_FN_NAME || "predict";
    if (!spaceUrl) {
      throw new Error("HuggingFace not configured: set HF_SPACE_URL secret.");
    }

    // Most Gradio Spaces accept URL strings for File/Audio/Video components.
    const result = await callGradioSSE(spaceUrl, fnName, token, [
      { path: input.audioUrl, meta: { _type: "gradio.FileData" } },
      { path: input.mediaUrl, meta: { _type: "gradio.FileData" } },
      input.mode,
    ]);

    const videoUrl = extractVideoUrl(result, spaceUrl);
    return { videoUrl, raw: result };
  },
};
