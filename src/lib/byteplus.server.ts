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

const DEFAULT_BASE = "https://ark.ap-southeast.bytepluses.com/api/v3";

/** The direct ByteDance key, if configured. `BYTEPLUS_API_KEY` or `ARK_API_KEY`. */
export function getBytePlusKey(): string | undefined {
  return process.env.BYTEPLUS_API_KEY || process.env.ARK_API_KEY || undefined;
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

function authHeaders(): Record<string, string> {
  const key = getBytePlusKey();
  if (!key) throw new BytePlusError("BYTEPLUS_API_KEY / ARK_API_KEY missing");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
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

// ─── Image (Seedream) — synchronous ──────────────────────────────────────────
// POST /images/generations → { data: [{ url }] }. A reference image (or several,
// for Seedream 4's unified generate+edit) is passed via `image`.
export async function bytePlusImage(opts: {
  model: string;
  prompt: string;
  imageUrls?: string[];
  size?: string;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: opts.model,
    prompt: opts.prompt,
    response_format: "url",
    size: opts.size ?? "2048x2048",
    watermark: false,
  };
  if (opts.imageUrls?.length) {
    body.image = opts.imageUrls.length === 1 ? opts.imageUrls[0] : opts.imageUrls;
  }
  const res = await fetch(`${bytePlusBaseUrl()}/images/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new BytePlusError(`BytePlus image ${res.status}: ${t.slice(0, 300)}`, {
      status: res.status,
      retryAfterMs: parseRetryAfterMs(res, t),
    });
  }
  const j = (await res.json()) as { data?: Array<{ url?: string }> };
  const url = j?.data?.[0]?.url;
  if (!url || typeof url !== "string") {
    throw new BytePlusError("BytePlus image: response contained no output url");
  }
  return url;
}

// ─── Video (Seedance) — async task create + poll ─────────────────────────────
// POST /contents/generations/tasks → { id }; then GET .../tasks/{id} until the
// status is a terminal one. Generation knobs (resolution, duration) ride on the
// text prompt as `--flag value` tokens, per the ModelArk content-task contract.
type BytePlusVideoOpts = {
  model: string;
  prompt?: string;
  imageUrls?: string[];
  duration?: number;
  resolution?: "480p" | "720p" | "1080p";
  timeoutMs?: number;
  pollIntervalMs?: number;
};

export async function bytePlusVideo(opts: BytePlusVideoOpts): Promise<string> {
  const base = bytePlusBaseUrl();
  const flags: string[] = [];
  if (opts.resolution) flags.push(`--resolution ${opts.resolution}`);
  if (opts.duration)
    flags.push(`--duration ${Math.max(3, Math.min(12, Math.round(opts.duration)))}`);
  const text = `${opts.prompt ?? ""} ${flags.join(" ")}`.trim();

  const content: Array<Record<string, unknown>> = [];
  if (text) content.push({ type: "text", text });
  if (opts.imageUrls?.[0]) {
    content.push({ type: "image_url", image_url: { url: opts.imageUrls[0] } });
  }

  const create = await fetch(`${base}/contents/generations/tasks`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ model: opts.model, content }),
  });
  if (!create.ok) {
    const t = await create.text();
    throw new BytePlusError(`BytePlus video create ${create.status}: ${t.slice(0, 300)}`, {
      status: create.status,
      retryAfterMs: parseRetryAfterMs(create, t),
    });
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
      headers: authHeaders(),
    });
    if (!poll.ok) {
      // Transient outages (5xx / rate-limit) → keep polling; hard 4xx → give up.
      if (poll.status >= 500 || poll.status === 429) continue;
      const t = await poll.text();
      throw new BytePlusError(`BytePlus video poll ${poll.status}: ${t.slice(0, 200)}`, {
        status: poll.status,
      });
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
      throw new BytePlusError(`BytePlus video ${status}: ${String(msg).slice(0, 200)}`);
    }
    // queued / running → keep polling.
  }
  throw new BytePlusError("BytePlus video: timed out waiting for task to finish");
}
