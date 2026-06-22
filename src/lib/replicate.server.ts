// Replicate via Lovable connector gateway.
// Auth: Bearer LOVABLE_API_KEY + X-Connection-Api-Key: REPLICATE_API_KEY.
// Both headers are required — the gateway swaps the connection key for the
// real Replicate token before forwarding upstream.

const GATEWAY = "https://connector-gateway.lovable.dev/replicate/v1";

/** Replicate connector key. Accept either the secret-tool name or the
 *  auto-injected connector name so this works regardless of how the project
 *  linked Replicate. */
export function getReplicateKey(): string | undefined {
  return (
    process.env.LOVABLE_CONNECTOR_REPLICATE_API_KEY ||
    process.env.REPLICATE_API_KEY ||
    undefined
  );
}

function authHeaders(): Record<string, string> {
  const lov = process.env.LOVABLE_API_KEY;
  const rep = getReplicateKey();
  if (!lov) throw new Error("LOVABLE_API_KEY missing");
  if (!rep) throw new Error("Replicate connector not linked (REPLICATE_API_KEY missing)");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": rep,
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
  const create = await fetch(`${GATEWAY}/models/${model}/predictions`, {
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
    const poll = await fetch(`${GATEWAY}/predictions/${created.id}`, {
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
