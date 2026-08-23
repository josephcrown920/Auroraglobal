// Replicate — direct API (api.replicate.com).
// Auth: Bearer REPLICATE_API_KEY. Calls Replicate directly so the app runs
// independent of any Lovable gateway or Lovable account.

const REPLICATE_API = "https://api.replicate.com/v1";

/** Replicate API token. Prefer the standard REPLICATE_API_KEY. Only fall back
 *  to an auto-injected connector key if it's a native Replicate token (r8_…);
 *  a Lovable connector identifier would not authenticate against the direct API. */
export function getReplicateKey(): string | undefined {
  const direct = process.env.REPLICATE_API_KEY;
  if (direct) return direct;
  const conn = process.env.LOVABLE_CONNECTOR_REPLICATE_API_KEY;
  if (conn && conn.startsWith("r8_")) return conn;
  return undefined;
}

function authHeaders(): Record<string, string> {
  const rep = getReplicateKey();
  if (!rep) throw new Error("REPLICATE_API_KEY missing");
  return {
    Authorization: `Bearer ${rep}`,
    "Content-Type": "application/json",
  };
}

type CreateResp = { id: string; status: string };
type PollResp = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: unknown;
  error?: string | null;
  /** Cumulative provider log tail — replicateProgressPct() mines it for real percent. */
  logs?: string | null;
};

/**
 * Extract a real 0-100 progress percent from a Replicate prediction's `logs`.
 * Replicate models commonly stream either explicit percents ("37%") or a step
 * counter ("27/50" diffusion steps / frames). The LAST such marker wins (logs
 * are cumulative). Returns null when no usable marker exists — callers must
 * treat that as "no signal", never as 0 (a bar snapping back to 0 mid-render
 * reads as a failure to the user).
 */
export function replicateProgressPct(logs: string | null | undefined): number | null {
  if (!logs) return null;
  let pct: number | null = null;
  // Explicit percents: "37%" / "37.5%" — take the last one.
  const pctMatches = logs.match(/(\d{1,3}(?:\.\d+)?)%/g);
  if (pctMatches && pctMatches.length > 0) {
    const last = Number(pctMatches[pctMatches.length - 1].replace("%", ""));
    if (Number.isFinite(last)) pct = last;
  }
  if (pct === null) {
    // Step counters: "27/50". Ignore tiny denominators (< 5) — "1/2" style
    // fragments are usually flags or dates, not step counters.
    const stepMatches = logs.match(/\b(\d{1,5})\s*\/\s*(\d{1,5})\b/g);
    if (stepMatches && stepMatches.length > 0) {
      const m = stepMatches[stepMatches.length - 1].match(/(\d{1,5})\s*\/\s*(\d{1,5})/);
      if (m) {
        const num = Number(m[1]);
        const den = Number(m[2]);
        if (Number.isFinite(num) && Number.isFinite(den) && den >= 5 && num <= den) {
          pct = (num / den) * 100;
        }
      }
    }
  }
  if (pct === null) return null;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/**
 * Replicate API error. Carries the HTTP status and, when the provider asks the
 * caller to back off (HTTP 429), the requested wait in milliseconds so the retry
 * layer can honor it instead of using only its short fixed backoff.
 */
export class ReplicateError extends Error {
  readonly status?: number;
  readonly retryAfterMs?: number;
  constructor(message: string, opts?: { status?: number; retryAfterMs?: number }) {
    super(message);
    this.name = "ReplicateError";
    this.status = opts?.status;
    this.retryAfterMs = opts?.retryAfterMs;
  }
}

/**
 * Pull a retry-after hint (in ms) from a throttled response: prefer the standard
 * `Retry-After` header (seconds), then fall back to a `retry_after` field in the
 * JSON body (Replicate embeds this in its 429s). Returns undefined when no hint
 * is present.
 */
function parseRetryAfterMs(res: Response, body: string): number | undefined {
  const header = res.headers.get("retry-after");
  if (header) {
    const secs = Number(header);
    if (Number.isFinite(secs) && secs >= 0) return Math.round(secs * 1000);
  }
  const m = body.match(/retry[_-]?after"?\s*[:=]\s*"?(\d+(?:\.\d+)?)/i);
  if (m) {
    const secs = Number(m[1]);
    if (Number.isFinite(secs) && secs >= 0) return Math.round(secs * 1000);
  }
  return undefined;
}

/**
 * Run a Replicate official model: POST /v1/models/{owner}/{name}/predictions
 * `model` should be "owner/name" (e.g. "bytedance/seedream-4").
 */
export async function replicateRun(
  model: string,
  input: Record<string, unknown>,
  timeoutMs = 600_000,
  opts?: { onPoll?: (p: PollResp) => void },
): Promise<PollResp> {
  const create = await fetch(`${REPLICATE_API}/models/${model}/predictions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ input }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!create.ok) {
    const t = await create.text();
    throw new ReplicateError(`Replicate create failed (${create.status}): ${t.slice(0, 300)}`, {
      status: create.status,
      retryAfterMs: parseRetryAfterMs(create, t),
    });
  }
  const created = (await create.json()) as CreateResp;

  const started = Date.now();
  let delay = 1500;
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 1000, 6000);
    const poll = await fetch(`${REPLICATE_API}/predictions/${created.id}`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(20_000),
    });
    if (!poll.ok) {
      const t = await poll.text();
      throw new ReplicateError(`Replicate poll failed (${poll.status}): ${t.slice(0, 200)}`, {
        status: poll.status,
        retryAfterMs: parseRetryAfterMs(poll, t),
      });
    }
    const j = (await poll.json()) as PollResp;
    try {
      opts?.onPoll?.(j);
    } catch {
      // Progress observers are cosmetic — never let one break the render poll.
    }
    if (j.status === "succeeded") return j;
    if (j.status === "failed" || j.status === "canceled") {
      throw new Error(`Replicate ${j.status}: ${j.error ?? "no error"}`);
    }
  }
  throw new Error("Replicate timeout");
}

/** Pull a single output URL out of a Replicate response. Output may be string | string[] | {url}. */
export function pickReplicateUrl(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const first = output[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in (first as object)) {
      return String((first as { url: unknown }).url);
    }
  }
  if (output && typeof output === "object" && "url" in (output as object)) {
    return String((output as { url: unknown }).url);
  }
  throw new Error("Replicate returned no output URL");
}

export async function fetchToBytes(url: string): Promise<{ bytes: Buffer; mime: string }> {
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`Failed to fetch ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return { bytes: buf, mime: r.headers.get("content-type") || "application/octet-stream" };
}
