// ByteDance direct API — BytePlus / Volcano Engine ModelArk.
//
// Native provider for the "Seed" model family (Seedream image, Seedance video).
// Calling ModelArk directly is usually cheaper and lower-latency than routing the
// same models through Replicate/fal, so the orchestrator prefers this adapter for
// supported Seed models when a key is present and falls back to Replicate/fal
// otherwise.
//
// Auth is a bearer key. Region base URL and each model ID are env-overridable
// because ModelArk is served from multiple regions (BytePlus international vs
// Volcano China) and ByteDance rotates the dated model-ID suffix — so a stale /
// 404 slug can be corrected with a secret change, never a code change. When
// unset, the current published defaults are used.

import { buildBytePlusVideoBody, type BytePlusVideoInput } from "./byteplus-video-contract";

const DEFAULT_BASE = "https://ark.ap-southeast.bytepluses.com/api/v3";

/** The direct ByteDance key, if configured. `BYTEPLUS_API_KEY` or `ARK_API_KEY`. */
export function getBytePlusKey(): string | undefined {
  return process.env.BYTEPLUS_API_KEY || process.env.ARK_API_KEY || undefined;
}

/**
 * Keep the documented BYTEPLUS preference for compatibility, but retain a
 * distinct ARK credential as a bounded fallback. A credential rejected with
 * HTTP 401 is safe to retry because the provider definitively rejected it
 * before accepting billable work. No other response or transport failure is
 * retried.
 */
function bytePlusKeys(): string[] {
  return [
    ...new Set([process.env.BYTEPLUS_API_KEY, process.env.ARK_API_KEY].filter(Boolean)),
  ] as string[];
}

/** Region base URL (no trailing slash). Overridable for China / other regions. */
export function bytePlusBaseUrl(): string {
  const raw = process.env.BYTEPLUS_BASE_URL || process.env.ARK_BASE_URL || DEFAULT_BASE;
  return raw.replace(/\/+$/, "");
}

/**
 * Carries the HTTP status and any provider-signalled retry delay so the
 * orchestrator's health/backoff logic can treat outages (5xx/429) as
 * provider-down while leaving 4xx request errors alone. Mirrors ReplicateError.
 */
export class BytePlusError extends Error {
  readonly status?: number;
  readonly retryAfterMs?: number;
  constructor(message: string, opts?: { status?: number; retryAfterMs?: number }) {
    super(message);
    this.name = "BytePlusError";
    this.status = opts?.status;
    this.retryAfterMs = opts?.retryAfterMs;
  }
}

function authHeaders(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function fetchWithCredentialFallback(
  request: (key: string) => Promise<Response>,
): Promise<{ response: Response; key: string }> {
  const keys = bytePlusKeys();
  if (!keys.length) throw new BytePlusError("BYTEPLUS_API_KEY / ARK_API_KEY missing");

  const first = await request(keys[0]);
  if (first.status !== 401 || keys.length < 2) {
    return { response: first, key: keys[0] };
  }

  return { response: await request(keys[1]), key: keys[1] };
}

function parseRetryAfterMs(res: Response, body: string): number | undefined {
  const header = res.headers?.get?.("retry-after");
  if (header) {
    const s = Number(header);
    if (Number.isFinite(s) && s >= 0) return Math.round(s * 1000);
  }
  const m = body.match(/retry[_-]?after"?\s*[:=]\s*"?(\d+(?:\.\d+)?)/i);
  if (m) {
    const s = Number(m[1]);
    if (Number.isFinite(s) && s >= 0) return Math.round(s * 1000);
  }
  return undefined;
}

function providerErrorCode(body: string): string | undefined {
  try {
    const parsed = JSON.parse(body) as {
      code?: unknown;
      error?: { code?: unknown } | unknown;
    };
    const candidate =
      parsed.error && typeof parsed.error === "object"
        ? (parsed.error as { code?: unknown }).code
        : parsed.code;
    if (
      typeof candidate === "string" &&
      /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/.test(candidate)
    ) {
      return candidate;
    }
  } catch {
    // Non-JSON provider responses intentionally contribute no error detail.
  }
  return undefined;
}

function errorCodeSuffix(body: string): string {
  const code = providerErrorCode(body);
  return code ? ` (${code})` : "";
}

function invalidRequestMarker(status: number): string {
  return status === 400 || status === 413 || status === 415 || status === 422
    ? " Invalid request."
    : "";
}

function sanitizeProviderMessage(value: unknown): string {
  let message = String(value);
  for (const key of bytePlusKeys()) message = message.replaceAll(key, "[redacted]");
  message = message
    .replace(/bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(api[_ -]?key|token|authorization)\s*[:=]\s*\S+/gi, "$1=[redacted]");
  return message.slice(0, 200);
}

// ─── Image (Seedream) — synchronous ──────────────────────────────────────────
// POST /images/generations → { data: [{ url }] }. A reference image (or several,
// for Seedream 4's unified generate+edit) is passed via `image`.
export async function bytePlusImage(opts: {
  model: string;
  prompt: string;
  imageUrls?: string[];
  size?: string;
  watermark?: boolean;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: opts.model,
    prompt: opts.prompt,
    response_format: "url",
    size: opts.size ?? "2048x2048",
    watermark: opts.watermark ?? false,
    stream: false,
  };
  if (opts.imageUrls?.length) {
    body.image = opts.imageUrls.length === 1 ? opts.imageUrls[0] : opts.imageUrls;
  }
  const { response: res } = await fetchWithCredentialFallback((key) =>
    fetch(`${bytePlusBaseUrl()}/images/generations`, {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    }),
  );
  if (!res.ok) {
    const t = await res.text();
    throw new BytePlusError(
      `BytePlus image failed with HTTP ${res.status}${errorCodeSuffix(t)}${invalidRequestMarker(res.status)}`,
      {
        status: res.status,
        retryAfterMs: parseRetryAfterMs(res, t),
      },
    );
  }
  const j = (await res.json()) as { data?: Array<{ url?: string }> };
  const url = j?.data?.[0]?.url;
  if (!url || typeof url !== "string") {
    throw new BytePlusError("BytePlus image: response contained no output url");
  }
  return url;
}

export type LayerizedImageLayer = {
  url: string;
  zIndex: number;
  name: string;
  description?: string;
  boundingBox?: {
    absolute?: number[];
    normalized?: number[];
  };
};

export type LayerizedImageResult = {
  /** The reconstructed/base image (z-index 0). */
  baseUrl: string;
  /** Transparent PNG layers ordered from back to front. */
  layers: LayerizedImageLayer[];
};

/**
 * Decompose ANY finished image into editable transparent layers.
 *
 * This is intentionally independent from the model that created the source
 * image: Nano Banana, GPT Image, Seedream, Flux, ComfyUI, etc. all arrive here
 * as one image URL. ModelArk's Seedream 5 Pro layer-decomposition capability is
 * the post-processing layerizer, not the source generator.
 */
export async function bytePlusLayerize(opts: {
  imageUrl: string;
  prompt?: string;
  size?: "auto" | "1K" | "1.5K" | "2K";
}): Promise<LayerizedImageResult> {
  const body: Record<string, unknown> = {
    model: process.env.BYTEPLUS_LAYER_MODEL || "dola-seedream-5-0-pro-260628",
    image: opts.imageUrl,
    layer_decomposition: true,
    response_format: "url",
    size: opts.size ?? "auto",
    watermark: false,
  };
  if (opts.prompt?.trim()) body.prompt = opts.prompt.trim();

  const res = await fetch(`${bytePlusBaseUrl()}/images/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new BytePlusError(`BytePlus layerize ${res.status}: ${t.slice(0, 500)}`, {
      status: res.status,
      retryAfterMs: parseRetryAfterMs(res, t),
    });
  }

  const json = (await res.json()) as {
    data?: Array<{
      url?: string;
      z_index?: number;
      name?: string;
      description?: string;
      bounding_box?: { absolute?: number[]; normalized?: number[] };
    }>;
  };
  const data = Array.isArray(json.data) ? json.data.filter((item) => typeof item?.url === "string") : [];
  if (!data.length) throw new BytePlusError("BytePlus layerize: response contained no layer images");

  const ordered = [...data].sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));
  const base = ordered.find((item) => (item.z_index ?? 0) === 0) ?? ordered[0];
  const layers = ordered
    .filter((item) => item !== base)
    .map((item, index) => ({
      url: item.url as string,
      zIndex: item.z_index ?? index + 1,
      name: item.name?.trim() || `Layer ${index + 1}`,
      description: item.description,
      boundingBox: item.bounding_box,
    }));

  return {
    baseUrl: base.url as string,
    layers,
  };
}

// ─── Video (Seedance) — async task create + poll ─────────────────────────────
// POST /contents/generations/tasks → { id }; then GET .../tasks/{id} until the
// status is a terminal one. Generation knobs (resolution, duration) ride on the
// text prompt as `--flag value` tokens, per the ModelArk content-task contract.
type BytePlusVideoOpts = BytePlusVideoInput & {
  timeoutMs?: number;
  pollIntervalMs?: number;
};

export async function bytePlusVideo(opts: BytePlusVideoOpts): Promise<string> {
  const base = bytePlusBaseUrl();
  const body = buildBytePlusVideoBody(opts);

  const { response: create, key: taskKey } = await fetchWithCredentialFallback((key) =>
    fetch(`${base}/contents/generations/tasks`, {
      method: "POST",
      headers: authHeaders(key),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    }),
  );
  if (!create.ok) {
    const t = await create.text();
    throw new BytePlusError(
      `BytePlus video create failed with HTTP ${create.status}${errorCodeSuffix(t)}${invalidRequestMarker(create.status)}`,
      {
        status: create.status,
        retryAfterMs: parseRetryAfterMs(create, t),
      },
    );
  }
  const created = (await create.json()) as { id?: string };
  const taskId = created?.id;
  if (!taskId) throw new BytePlusError("BytePlus video: create returned no task id");

  const timeout = opts.timeoutMs ?? 600_000;
  const deadline = Date.now() + timeout;
  let delay = opts.pollIntervalMs ?? 2_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 1_000, 6_000);
    const poll = await fetch(`${base}/contents/generations/tasks/${encodeURIComponent(taskId)}`, {
      // A task belongs to the credential that successfully created it. Do not
      // re-resolve env preference or probe a different account while polling.
      headers: authHeaders(taskKey),
      signal: AbortSignal.timeout(20_000),
    });
    if (!poll.ok) {
      // Transient outages (5xx / rate-limit) → keep polling; hard 4xx → give up.
      if (poll.status >= 500 || poll.status === 429) continue;
      const t = await poll.text();
      throw new BytePlusError(
        `BytePlus video poll failed with HTTP ${poll.status}${errorCodeSuffix(t)}${invalidRequestMarker(poll.status)}`,
        { status: poll.status },
      );
    }
    const pj = (await poll.json()) as {
      status?: string;
      content?: { video_url?: string };
      error?: { message?: string } | string;
    };
    const status = pj?.status ?? "";
    if (status === "succeeded") {
      const url = pj?.content?.video_url;
      if (!url || typeof url !== "string") {
        throw new BytePlusError("BytePlus video: succeeded task had no video_url");
      }
      return url;
    }
    if (status === "failed" || status === "cancelled") {
      const msg =
        typeof pj?.error === "string" ? pj.error : (pj?.error?.message ?? "unknown error");
      throw new BytePlusError(`BytePlus video ${status}: ${sanitizeProviderMessage(msg)}`);
    }
    // queued / running → keep polling.
  }
  throw new BytePlusError("BytePlus video: timed out waiting for task to finish");
}
