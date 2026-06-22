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
};

/**
 * Run a Replicate official model: POST /v1/models/{owner}/{name}/predictions
 * `model` should be "owner/name" (e.g. "bytedance/seedream-4").
 */
export async function replicateRun(
  model: string,
  input: Record<string, unknown>,
  timeoutMs = 600_000,
): Promise<PollResp> {
  const create = await fetch(`${REPLICATE_API}/models/${model}/predictions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ input }),
  });
  if (!create.ok) {
    const t = await create.text();
    throw new Error(`Replicate create failed (${create.status}): ${t.slice(0, 300)}`);
  }
  const created = (await create.json()) as CreateResp;

  const started = Date.now();
  let delay = 1500;
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 1000, 6000);
    const poll = await fetch(`${REPLICATE_API}/predictions/${created.id}`, {
      headers: authHeaders(),
    });
    if (!poll.ok) {
      const t = await poll.text();
      throw new Error(`Replicate poll failed (${poll.status}): ${t.slice(0, 200)}`);
    }
    const j = (await poll.json()) as PollResp;
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
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return { bytes: buf, mime: r.headers.get("content-type") || "application/octet-stream" };
}
