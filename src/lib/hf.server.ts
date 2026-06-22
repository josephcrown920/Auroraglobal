// Hugging Face Inference helper (server-only).
//
// Supports two surfaces:
//   1. Serverless Inference API     → https://api-inference.huggingface.co/models/<id>
//   2. Dedicated Inference Endpoint → full URL you pass in (e.g.
//      https://<id>.endpoints.huggingface.cloud)
//
// Plus the OpenAI-compatible router used by the LLM fallback chain:
//      https://router.huggingface.co/v1
//
// Tasks covered:
//   - text-generation / chat (router, OpenAI-compatible)
//   - image generation (text-to-image)
//   - automatic-speech-recognition (Whisper)
//   - text-to-speech (Bark / SpeechT5)
//
// All functions throw on non-2xx so callers can decide how to surface errors.

const SERVERLESS_BASE = "https://api-inference.huggingface.co/models";
export const HF_ROUTER_BASE = "https://router.huggingface.co/v1";

function token(): string {
  const t = process.env.HF_TOKEN;
  if (!t) throw new Error("HF_TOKEN is not configured");
  return t;
}

/** Resolve the URL for a HF model id OR a dedicated endpoint URL. */
function resolveUrl(modelOrUrl: string): string {
  if (modelOrUrl.startsWith("http://") || modelOrUrl.startsWith("https://")) {
    return modelOrUrl;
  }
  return `${SERVERLESS_BASE}/${modelOrUrl}`;
}

async function postBinary(
  modelOrUrl: string,
  body: unknown,
  accept: string
): Promise<ArrayBuffer> {
  const res = await fetch(resolveUrl(modelOrUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      Accept: accept,
      "X-Wait-For-Model": "true",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HF ${res.status}: ${txt.slice(0, 400)}`);
  }
  return res.arrayBuffer();
}

async function postJson<T>(modelOrUrl: string, body: unknown): Promise<T> {
  const res = await fetch(resolveUrl(modelOrUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Wait-For-Model": "true",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HF ${res.status}: ${txt.slice(0, 400)}`);
  }
  return (await res.json()) as T;
}

// ─── Text generation (non-chat, raw) ──────────────────────────────────────────
export async function hfTextGeneration(
  modelOrUrl: string,
  inputs: string,
  parameters: Record<string, unknown> = {}
): Promise<string> {
  const out = await postJson<Array<{ generated_text?: string }> | { generated_text?: string }>(
    modelOrUrl,
    { inputs, parameters }
  );
  if (Array.isArray(out)) return out[0]?.generated_text ?? "";
  return out.generated_text ?? "";
}

// ─── Text-to-image ───────────────────────────────────────────────────────────
export async function hfTextToImage(
  modelOrUrl: string,
  prompt: string,
  parameters: Record<string, unknown> = {}
): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const buf = await postBinary(modelOrUrl, { inputs: prompt, parameters }, "image/png");
  return { bytes: buf, contentType: "image/png" };
}

// ─── Automatic speech recognition ────────────────────────────────────────────
export type AsrChunk = { start: number; end: number; text: string };
export async function hfSpeechToText(
  modelOrUrl: string,
  audio: ArrayBuffer | Uint8Array,
  opts: { timestamps?: boolean } = {}
): Promise<{ text: string; chunks: AsrChunk[] }> {
  const base = resolveUrl(modelOrUrl);
  const url = opts.timestamps ? `${base}?return_timestamps=true` : base;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/octet-stream",
      Accept: "application/json",
      "X-Wait-For-Model": "true",
    },
    body: audio as BodyInit,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HF ${res.status}: ${txt.slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    text?: string;
    chunks?: Array<{ timestamp: [number, number]; text: string }>;
  };
  const chunks: AsrChunk[] = (json.chunks ?? []).map((c) => ({
    start: c.timestamp?.[0] ?? 0,
    end: c.timestamp?.[1] ?? 0,
    text: (c.text ?? "").trim(),
  }));
  return { text: json.text ?? "", chunks };
}

// ─── Text-to-speech ──────────────────────────────────────────────────────────
export async function hfTextToSpeech(
  modelOrUrl: string,
  text: string
): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const buf = await postBinary(modelOrUrl, { inputs: text }, "audio/flac");
  return { bytes: buf, contentType: "audio/flac" };
}

// ─── Convenience: data URL ───────────────────────────────────────────────────
export function toDataUrl(bytes: ArrayBuffer, contentType: string): string {
  // Base64 in a Worker-safe way
  const u8 = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  // btoa is available in the Worker runtime
  // eslint-disable-next-line no-undef
  const b64 = btoa(bin);
  return `data:${contentType};base64,${b64}`;
}
