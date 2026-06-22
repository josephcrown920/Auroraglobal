// Direct Sync.so API client (no gateway).
// Docs: https://docs.sync.so/api-reference

const SYNC_BASE = "https://api.sync.so/v2";

function syncKey(): string {
  const k = process.env.SYNC_API_KEY;
  if (!k) throw new Error("SYNC_API_KEY missing (add it in Project Settings → Secrets)");
  return k;
}

type CreateResp = { id?: string; status?: string; error?: string };
type PollResp = {
  id: string;
  status: string;
  outputUrl?: string | null;
  output_url?: string | null;
  output?: string | { url?: string } | null;
  error?: string | null;
};

export async function syncLipsync(
  opts: { videoUrl: string; audioUrl: string; model?: string },
  timeoutMs = 600_000,
): Promise<string> {
  const create = await fetch(`${SYNC_BASE}/generate`, {
    method: "POST",
    headers: { "x-api-key": syncKey(), "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? "lipsync-2",
      input: [
        { type: "video", url: opts.videoUrl },
        { type: "audio", url: opts.audioUrl },
      ],
      options: { output_format: "mp4" },
    }),
  });
  if (!create.ok) {
    const t = await create.text();
    throw new Error(`Sync create failed (${create.status}): ${t.slice(0, 300)}`);
  }
  const c = (await create.json()) as CreateResp;
  if (!c.id) {
    throw new Error(`Sync returned no job id: ${JSON.stringify(c).slice(0, 200)}`);
  }

  const started = Date.now();
  let delay = 2000;
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 1000, 6000);
    const poll = await fetch(`${SYNC_BASE}/generate/${c.id}`, {
      headers: { "x-api-key": syncKey() },
    });
    if (!poll.ok) {
      const t = await poll.text();
      throw new Error(`Sync poll failed (${poll.status}): ${t.slice(0, 200)}`);
    }
    const j = (await poll.json()) as PollResp;
    const status = String(j.status ?? "").toUpperCase();
    const url =
      j.outputUrl ||
      j.output_url ||
      (typeof j.output === "string" ? j.output : j.output?.url) ||
      null;
    if (status === "COMPLETED" && url) return url;
    if (
      status === "FAILED" ||
      status === "CANCELED" ||
      status === "REJECTED" ||
      status === "ERROR"
    ) {
      throw new Error(`Sync ${status}: ${j.error ?? "no error detail"}`);
    }
  }
  throw new Error("Sync timeout — try a shorter clip");
}
