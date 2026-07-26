// Pure, env-agnostic wire helpers shared by the env-based inference adapters
// (src/lib/inference/providers/*) AND the DB worker-registry dispatch in
// src/lib/orchestrator.server.ts. No env reads, no DB — just HTTP-out, so the
// wire logic for each backend protocol has a single source of truth.

import type { InferenceInput, InferenceResult } from "./types";

/**
 * Normalise legacy `{mediaUrl, mode}` to the canonical `{imageUrls, videoUrl}`.
 * Call this at every inbound boundary (server fns, API routes) before any internal
 * processing. After normalisation, `mediaUrl` and `mode` will not be present on the
 * returned object.
 */
export function normaliseInferenceInput(input: InferenceInput): InferenceInput {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { mediaUrl, mode, ...rest } = input;
  if (!mediaUrl) return rest as InferenceInput;
  const normalised: InferenceInput = { ...rest };
  if (mode === "image") {
    if (!normalised.imageUrls?.length) normalised.imageUrls = [mediaUrl];
  } else {
    // mode === "video" or unset — treat as video (lipsync default)
    if (!normalised.videoUrl) normalised.videoUrl = mediaUrl;
  }
  return normalised;
}

/** Flatten a generalized job into the snake_case body workers/handlers expect. */
export function jobBody(input: InferenceInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    task: input.task,
    prompt: input.prompt,
    image_urls: input.imageUrls,
    audio_url: input.audioUrl,
    video_url: input.videoUrl,
    params: input.params,
    workflow: input.comfyWorkflow,
    workflow_inputs: input.comfyInputs,
  };
  // Wire compat: old deployed lipsync workers (Colab/Kaggle) still read media_url + mode.
  // Derive from canonical fields so internal code never needs to write the deprecated pair.
  if (input.task === "lipsync") {
    body.media_url = input.videoUrl ?? input.imageUrls?.[0];
    body.mode = input.videoUrl ? "video" : input.imageUrls?.[0] ? "image" : undefined;
  }
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
  return body;
}

/** Recursively dig an http(s) URL out of an arbitrary worker/handler response. */
export function extractOutputUrl(payload: unknown, depth = 0): string | undefined {
  if (payload == null || depth > 6) return undefined;
  if (typeof payload === "string") return payload.startsWith("http") ? payload : undefined;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const u = extractOutputUrl(item, depth + 1);
      if (u) return u;
    }
    return undefined;
  }
  if (typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    for (const k of ["url", "output_url", "image_url", "video_url", "audio_url", "result_url", "signed_url", "delivery_url", "uri"]) {
      const v = o[k];
      if (typeof v === "string" && v.startsWith("http")) return v;
    }
    for (const k of ["output", "result", "data", "response", "image", "video", "images", "videos", "outputs", "assets"]) {
      if (k in o) {
        const u = extractOutputUrl(o[k], depth + 1);
        if (u) return u;
      }
    }
  }
  return undefined;
}

/** Build the standard InferenceResult, setting the legacy `videoUrl` for non-image tasks. */
export function toResult(outputUrl: string, input: InferenceInput, raw?: unknown): InferenceResult {
  return {
    outputUrl,
    ...(input.task === "image" ? {} : { videoUrl: outputUrl }),
    raw,
  };
}

function remainingMs(deadline?: number): number {
  if (!deadline) return 300_000;
  return Math.max(1_000, deadline - Date.now());
}

/**
 * Lightweight liveness probe used by the admin status panel. By default a host
 * that answers *any* HTTP status counts as reachable (`ok:true`) — useful for
 * flat POST endpoints (Colab/Vast) that have no health route and would 405/404
 * a GET while still being up. Pass `expectOk` for endpoints that expose a real
 * health/liveness path (ComfyUI /system_stats, HF Space root, RunPod /health).
 * Network errors / timeouts return `{ ok:false }`.
 */
export async function probeReachable(
  url: string,
  opts: { token?: string; expectOk?: boolean; timeoutMs?: number } = {},
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const headers: Record<string, string> = {};
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 5_000),
    });
    return { ok: opts.expectOk ? res.ok : true, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Flat HTTP (Colab / ngrok / Vast.ai / self-hosted custom servers) ─────────
/** POST a flat job body to an HTTP endpoint and return the parsed JSON. */
export async function postFlatJob(
  url: string,
  token: string | undefined,
  input: InferenceInput,
  deadline?: number,
): Promise<unknown> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(jobBody(input)),
    signal: AbortSignal.timeout(remainingMs(deadline)),
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// ─── inference.sh (managed cloud apps API) ────────────────────────────────────
// Wire contract (https://inference.sh/docs/api/rest/tasks):
//   POST {base}/run  { app: "namespace/name", input: {...}, setup?: {...} }
//     → task JSON { id, status, output?, error? }
//   GET  {base}/tasks/{id} → same task JSON; poll until a terminal status.
// Auth: `Authorization: Bearer inf_...` + `X-API-Version: 2` (bare JSON responses).
// Status codes: 10 = Completed, 11 = Failed, 12 = Cancelled (1-9 = in progress).

export type InferenceShTask = {
  id?: string;
  status?: number;
  output?: unknown;
  error?: string;
};

export const INFERENCE_SH_DONE = 10;
export const INFERENCE_SH_FAILED = 11;
export const INFERENCE_SH_CANCELLED = 12;

/** Default apps per task; every entry is overridable via INFERENCE_SH_APP_<TASK>. */
const INFERENCE_SH_DEFAULT_APPS: Record<string, string> = {
  image: "infsh/flux", // the app used throughout inference.sh's own API docs
};

/**
 * Resolve which inference.sh app serves a task type. Env is passed in so this
 * module stays env-agnostic: `INFERENCE_SH_APP_<TASK>` (e.g. INFERENCE_SH_APP_VIDEO)
 * wins, else the default app for the task, else undefined (caller must fail
 * explicitly — no silent fallback).
 */
export function resolveInferenceShApp(
  task: string,
  env: Record<string, string | undefined>,
): string | undefined {
  return env[`INFERENCE_SH_APP_${task.toUpperCase()}`] || INFERENCE_SH_DEFAULT_APPS[task];
}

/**
 * Build the app `input` body from a generalized job. App schemas vary, so the
 * conventional fields (prompt / image_urls / audio_url / video_url) are sent when
 * present and `params` is spread on top (params win) so callers can match any
 * app's exact schema. Apps that reject unknown fields fail explicitly upstream.
 */
export function inferenceShInput(input: InferenceInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    prompt: input.prompt,
    image_urls: input.imageUrls,
    audio_url: input.audioUrl,
    video_url: input.videoUrl,
    ...(input.params ?? {}),
  };
  // Wire compat: old lipsync workers on inference.sh still read media_url + mode.
  // Derive from canonical fields; params take priority (already spread above).
  if (input.task === "lipsync") {
    const legacyMedia = input.videoUrl ?? input.imageUrls?.[0];
    const legacyMode = input.videoUrl ? "video" : input.imageUrls?.[0] ? "image" : undefined;
    if (legacyMedia && !("media_url" in body)) body.media_url = legacyMedia;
    if (legacyMode && !("mode" in body)) body.mode = legacyMode;
  }
  for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k];
  return body;
}

/**
 * Run an inference.sh app and return the final task JSON: POST {base}/run, then
 * poll GET {base}/tasks/{id} until Completed (10), Failed (11), Cancelled (12),
 * or the deadline passes. Throws explicitly on failure/cancel/timeout.
 */
export async function runInferenceShTask(opts: {
  baseUrl: string;
  token: string;
  app: string;
  input: Record<string, unknown>;
  setup?: Record<string, unknown>;
  deadline?: number;
  pollMs?: number;
}): Promise<InferenceShTask> {
  const base = opts.baseUrl.replace(/\/$/, "");
  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${opts.token}`,
    "x-api-version": "2",
  };
  const deadline = opts.deadline ?? Date.now() + 300_000;

  const res = await fetch(`${base}/run`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      app: opts.app,
      input: opts.input,
      ...(opts.setup ? { setup: opts.setup } : {}),
    }),
    signal: AbortSignal.timeout(Math.min(60_000, remainingMs(deadline))),
  });
  if (!res.ok) {
    throw new Error(`inference.sh /run ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  let task = (await res.json()) as InferenceShTask;
  const taskId = task.id;

  for (;;) {
    if (task.status === INFERENCE_SH_DONE) return task;
    if (task.status === INFERENCE_SH_FAILED) {
      throw new Error(`inference.sh task failed: ${String(task.error ?? "unknown error").slice(0, 300)}`);
    }
    if (task.status === INFERENCE_SH_CANCELLED) throw new Error("inference.sh task was cancelled");
    if (!taskId) throw new Error("inference.sh /run returned no task id");
    if (Date.now() >= deadline) break;
    await new Promise((r) =>
      setTimeout(r, Math.min(opts.pollMs ?? 2_500, Math.max(0, deadline - Date.now()))),
    );
    if (Date.now() >= deadline) break;
    try {
      const pr = await fetch(`${base}/tasks/${encodeURIComponent(taskId)}`, {
        headers,
        signal: AbortSignal.timeout(Math.min(15_000, remainingMs(deadline))),
      });
      if (!pr.ok) continue;
      task = (await pr.json()) as InferenceShTask;
    } catch {
      continue; // transient poll error — keep polling the same task (don't resubmit)
    }
  }
  throw new Error("inference.sh poll timeout");
}

// ─── Hugging Face Space (Gradio) ──────────────────────────────────────────────
/**
 * Call a Gradio Space via the modern `/gradio_api/call/<fn>` + SSE endpoint.
 * Returns the raw "complete" payload (usually an array of output components).
 */
export async function callGradioSpace(
  spaceUrl: string,
  fnName: string,
  token: string | undefined,
  data: unknown[],
  deadline?: number,
): Promise<unknown> {
  const base = spaceUrl.replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const startRes = await fetch(`${base}/gradio_api/call/${fnName}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data }),
    signal: AbortSignal.timeout(Math.min(30_000, remainingMs(deadline))),
  });
  if (!startRes.ok) {
    throw new Error(`HF Space ${startRes.status}: ${(await startRes.text()).slice(0, 300)}`);
  }
  const { event_id } = (await startRes.json()) as { event_id: string };

  const sseRes = await fetch(`${base}/gradio_api/call/${fnName}/${event_id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal: AbortSignal.timeout(remainingMs(deadline)),
  });
  if (!sseRes.ok || !sseRes.body) throw new Error(`HF Space SSE ${sseRes.status}`);

  const reader = sseRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  for (;;) {
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
        if (currentEvent === "error") throw new Error(`HF Space error: ${payload.slice(0, 300)}`);
      }
    }
  }
  throw new Error("HF Space SSE ended without a 'complete' event");
}

/**
 * Build the positional Gradio `data` array for a generalized job.
 * Lip-sync uses the documented `(audio, media, mode)` signature; other tasks use
 * a generalized `(prompt, image, audio, video)` signature. The Space's `predict`
 * function must accept the matching order.
 */
export function gradioData(input: InferenceInput): unknown[] {
  const file = (u?: string) => (u ? { path: u, meta: { _type: "gradio.FileData" } } : null);
  if (input.task === "lipsync") {
    // Derive media file and mode from canonical fields (videoUrl wins over imageUrls).
    const mediaUrl = input.videoUrl ?? input.imageUrls?.[0];
    const mediaMode = input.videoUrl ? "video" : "image";
    return [file(input.audioUrl), file(mediaUrl), mediaMode];
  }
  return [input.prompt ?? "", file(input.imageUrls?.[0]), file(input.audioUrl), file(input.videoUrl)];
}

/** Pull an output URL out of a Gradio result array (handles {url}/{path}/{video}). */
export function extractGradioUrl(result: unknown, spaceUrl: string): string | undefined {
  const base = spaceUrl.replace(/\/$/, "");
  const arr = Array.isArray(result) ? result : [result];
  for (const item of arr) {
    if (typeof item === "string" && item.startsWith("http")) return item;
    if (item && typeof item === "object") {
      const obj = item as { url?: string; path?: string; video?: { url?: string }; image?: { url?: string } };
      if (obj.url) return obj.url;
      if (obj.video?.url) return obj.video.url;
      if (obj.image?.url) return obj.image.url;
      if (obj.path) return `${base}/gradio_api/file=${obj.path}`;
    }
  }
  return undefined;
}

// ─── ComfyUI (self-hosted workflow API) ───────────────────────────────────────
type ComfyOpts = {
  baseUrl: string;
  token?: string;
  /** A ComfyUI prompt graph (the JSON ComfyUI's /prompt accepts under `prompt`). */
  workflow: unknown;
  /** Optional `"nodeId.inputName": value` patches applied to the graph (JSON only). */
  inputs?: Record<string, unknown>;
  deadline?: number;
};

/**
 * Submit a ComfyUI workflow, poll /history until it finishes, and return the
 * first output asset's `/view` URL. Generic dispatch — the caller supplies the
 * graph; this layer never hardcodes a model or node.
 */
export async function runComfyWorkflow(opts: ComfyOpts): Promise<string> {
  const base = opts.baseUrl.replace(/\/$/, "");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const workflow = patchComfyInputs(opts.workflow, opts.inputs);
  const deadline = opts.deadline ?? Date.now() + 300_000;

  const submit = await fetch(`${base}/prompt`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt: workflow, client_id: crypto.randomUUID() }),
    signal: AbortSignal.timeout(Math.min(30_000, remainingMs(deadline))),
  });
  if (!submit.ok) throw new Error(`ComfyUI /prompt ${submit.status}: ${(await submit.text()).slice(0, 300)}`);
  const sj = (await submit.json()) as { prompt_id?: string; error?: unknown; node_errors?: unknown };
  const promptId = sj.prompt_id;
  if (!promptId) throw new Error(`ComfyUI returned no prompt_id: ${JSON.stringify(sj.error ?? sj.node_errors ?? sj).slice(0, 200)}`);

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, Math.min(2_000, Math.max(0, deadline - Date.now()))));
    if (Date.now() >= deadline) break;
    let hist: Record<string, unknown>;
    try {
      const res = await fetch(`${base}/history/${encodeURIComponent(promptId)}`, {
        headers,
        signal: AbortSignal.timeout(Math.min(15_000, remainingMs(deadline))),
      });
      if (!res.ok) continue;
      hist = (await res.json()) as Record<string, unknown>;
    } catch {
      continue; // transient poll error — keep polling the same prompt
    }
    const entry = hist[promptId] as
      | { outputs?: Record<string, unknown>; status?: { status_str?: string; completed?: boolean } }
      | undefined;
    if (!entry) continue;
    if (entry.status?.status_str === "error") throw new Error("ComfyUI workflow failed");
    const url = comfyOutputUrl(entry.outputs, base);
    if (url) return url;
  }
  throw new Error("ComfyUI poll timeout");
}

/** Resolve the first output asset (gif/video preferred, else image) to a /view URL. */
function comfyOutputUrl(outputs: Record<string, unknown> | undefined, base: string): string | undefined {
  if (!outputs) return undefined;
  for (const node of Object.values(outputs)) {
    const n = node as {
      images?: Array<Record<string, string>>;
      gifs?: Array<Record<string, string>>;
      videos?: Array<Record<string, string>>;
    };
    for (const coll of [n.gifs, n.videos, n.images]) {
      for (const f of coll ?? []) {
        if (f?.filename) {
          const q = new URLSearchParams({
            filename: f.filename,
            subfolder: f.subfolder ?? "",
            type: f.type ?? "output",
          });
          return `${base}/view?${q.toString()}`;
        }
      }
    }
  }
  return undefined;
}

/** Apply `"nodeId.inputName": value` patches to a ComfyUI graph. Pure JSON — no eval. */
function patchComfyInputs(workflow: unknown, inputs?: Record<string, unknown>): unknown {
  if (!inputs || typeof workflow !== "object" || workflow === null) return workflow;
  const wf = JSON.parse(JSON.stringify(workflow)) as Record<string, { inputs?: Record<string, unknown> }>;
  for (const [key, value] of Object.entries(inputs)) {
    const dot = key.indexOf(".");
    if (dot === -1) continue;
    const nodeId = key.slice(0, dot);
    const inputName = key.slice(dot + 1);
    const node = wf[nodeId];
    if (node && typeof node === "object") {
      node.inputs = node.inputs ?? {};
      node.inputs[inputName] = value;
    }
  }
  return wf;
}
