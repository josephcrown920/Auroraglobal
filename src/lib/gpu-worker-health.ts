/**
 * GPU worker health checks and status dashboard.
 * Monitors worker heartbeats, failure rates, and concurrency.
 */

export interface WorkerStatus {
  id: string;
  name: string;
  status: "online" | "offline" | "degraded";
  region: string;
  capabilities: string[];
  in_flight: number;
  max_concurrency: number;
  last_heartbeat: string;
  uptime_pct: number;
  failure_rate: number;
}

/** Minimal worker shape needed to probe a worker's live health endpoint. */
export interface WorkerHealthTarget {
  endpoint_url: string;
  auth_token?: string | null;
  protocol?: string | null;
}

/** Result of probing a worker's `/health` endpoint. */
export interface WorkerProbeResult {
  /** Whether the worker is considered healthy/reachable. */
  ok: boolean;
  /** HTTP status code, when a response was received. */
  status?: number;
  /** Human-readable extra info (e.g. RunPod worker counts). */
  detail?: string;
  /** Error message when the probe failed or returned an unexpected shape. */
  error?: string;
  /** True when no HTTP response was received at all (network error/timeout). */
  unreachable?: boolean;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Normalize a registered worker `endpoint_url` to its base origin so the
 * protocol-specific path can be appended cleanly. Strips trailing slashes and a
 * trailing `/generate` segment, because the custom/Vast worker actually *serves*
 * its job route at `.../generate` — operators (and our Colab/Kaggle templates)
 * naturally register that full URL. Without this, dispatch would POST to
 * `.../generate/generate` and the health probe would GET `.../generate/health`.
 * RunPod/ComfyUI/HF URLs never end in `/generate`, so this is a no-op for them.
 */
export function normalizeWorkerBase(url: string): string {
  return url.replace(/\/+$/, "").replace(/\/generate$/i, "");
}

/**
 * Interpret a RunPod Serverless `/health` response.
 *
 * RunPod returns `{ jobs: {...}, workers: { idle, initializing, ready,
 * running, throttled, unhealthy } }`. A 200 with no usable `workers` object
 * means the response wasn't actually a RunPod health payload. An endpoint that
 * is scaled to zero (all counts 0) is still healthy — RunPod scales it up on
 * demand — so we only treat it as down when workers exist but are all unhealthy.
 */
async function interpretRunpodHealth(res: Response): Promise<WorkerProbeResult> {
  if (!res.ok) {
    return { ok: false, status: res.status, error: `RunPod health ${res.status}` };
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, status: res.status, error: "RunPod health: invalid JSON" };
  }
  const workers = (json as { workers?: unknown } | null)?.workers;
  if (!workers || typeof workers !== "object") {
    return { ok: false, status: res.status, error: "RunPod health: missing workers field" };
  }
  const w = workers as Record<string, unknown>;
  const ready = num(w.ready) + num(w.idle) + num(w.running) + num(w.initializing);
  const unhealthy = num(w.unhealthy);
  const ok = unhealthy === 0 || ready > 0;
  return { ok, status: res.status, detail: `ready:${ready} unhealthy:${unhealthy}` };
}

/**
 * Probe a worker's live health endpoint, branching on its `protocol`:
 *  - custom / vast (default): `GET {endpoint}/health`; healthy when the response is 2xx.
 *  - runpod: `GET {endpoint}/health` with `Authorization: Bearer`; healthy when
 *    the RunPod health payload reports the endpoint isn't stuck with only
 *    unhealthy workers.
 *  - comfyui: `GET {endpoint}/system_stats` (ComfyUI's liveness endpoint).
 *  - hfspace: `GET {endpoint}/` (the Gradio app root).
 *
 * Network errors / timeouts return `{ ok: false, unreachable: true }` so callers
 * can distinguish "didn't respond" from "responded as unhealthy".
 */
export async function probeWorkerHealth(
  worker: WorkerHealthTarget,
  timeoutMs = 8_000,
): Promise<WorkerProbeResult> {
  const protocol = worker.protocol ?? "custom";
  const baseUrl = normalizeWorkerBase(worker.endpoint_url);
  const headers: Record<string, string> = worker.auth_token
    ? { authorization: `Bearer ${worker.auth_token}` }
    : {};
  // Each protocol exposes liveness at a different path.
  const path =
    protocol === "comfyui" ? "/system_stats"
    : protocol === "hfspace" ? "/"
    : "/health";
  try {
    const res = await fetch(baseUrl + path, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (protocol === "runpod") {
      return await interpretRunpodHealth(res);
    }
    // A non-2xx response is still a *received* answer (not a network error), but
    // without an explicit `error` here the admin UI would show "failed" with no
    // reason at all — the exact "worker vanished with nothing to look at" gap
    // this task is about closing. Surface the status code as the reason.
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status} from ${path}` };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, unreachable: true, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Check if a worker is healthy based on:
 * - Recent heartbeat (< 60 seconds)
 * - Low failure rate (< 5%)
 * - Available capacity
 */
export function isWorkerHealthy(worker: WorkerStatus): boolean {
  const lastHeartbeatMs = Date.now() - new Date(worker.last_heartbeat).getTime();
  const isReachable = lastHeartbeatMs < 60_000; // 60 seconds
  const hasCapacity = worker.in_flight < worker.max_concurrency;
  const isReliable = worker.failure_rate < 0.05; // < 5% failure

  return isReachable && hasCapacity && isReliable;
}

/**
 * Cron job: periodic health check of all GPU workers.
 * Called every 5 minutes.
 * Updates worker status and routes around unhealthy instances.
 */
export async function checkGPUWorkerHealth(supabaseAdmin: any) {
  const { data: workers, error } = await supabaseAdmin
    .from("gpu_workers")
    .select("id, name, status, endpoint_url, auth_token, protocol")
    .order("priority", { ascending: true });

  if (error || !workers) {
    console.error("Failed to fetch worker list:", error);
    return;
  }

  for (const worker of workers) {
    // Respect intentional admin states — never auto-flip a draining/paused worker.
    if (worker.status === "draining" || worker.status === "paused") continue;

    // Probe live health, branching on protocol (custom GET /health vs RunPod
    // health payload). Unreachable workers are marked paused.
    const result = await probeWorkerHealth(worker);
    const newStatus = result.ok ? "active" : "paused";

    const patch: Record<string, unknown> = {
      last_probe_at: new Date().toISOString(),
      last_probe_ok: result.ok,
      last_probe_detail: result.detail ?? null,
      last_probe_error: result.error ?? null,
    };
    if (worker.status !== newStatus) patch.status = newStatus;
    // The sweep is the only thing that ever pauses a worker here (draining/
    // paused workers were skipped above), so any pause this loop performs is
    // by definition automatic — tag it so the admin UI can tell it apart
    // from an admin explicitly clicking Pause (setWorkerStatus).
    if (!result.ok) patch.paused_reason = "auto";
    // Refresh the heartbeat whenever the worker actually answered healthy so
    // dispatch-time staleness checks see it as live.
    if (result.ok) patch.last_heartbeat = new Date().toISOString();

    await supabaseAdmin
      .from("gpu_workers")
      .update(patch)
      .eq("id", worker.id);
  }
}
