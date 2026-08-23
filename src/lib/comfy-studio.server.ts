// HTTP client for the user's own ComfyUI Studio service.
//
// ComfyUI Studio is a separate Replit project that proxies / orchestrates a
// ComfyUI server. Aurora talks to it over plain HTTP — no SDK needed.
// Configure by setting COMFY_STUDIO_URL to the Studio's published URL
// (e.g. https://my-comfy-studio.replit.app). No trailing slash.
//
// Endpoints (all under COMFY_STUDIO_URL/api):
//   GET  /api/comfy/status          → StudioStatus
//   GET  /api/workflows             → StudioWorkflow[]
//   POST /api/jobs                  → StudioJob  (submit)
//   POST /api/jobs/{id}/refresh     → StudioJob  (re-check ComfyUI status)
//   GET  /api/jobs/{id}             → StudioJob  (detail + outputs)
//   GET  /api/outputs               → recent outputs
//   GET  /api/comfy/models          → { checkpoints, loras, vaes, controlnets }

const RAW_BASE = process.env.COMFY_STUDIO_URL ?? "";
const STUDIO_BASE = RAW_BASE.replace(/\/+$/, "");

export function hasStudio(): boolean {
  return /^https?:\/\//i.test(STUDIO_BASE);
}

export function getStudioBase(): string {
  return STUDIO_BASE;
}

async function studioFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  if (!hasStudio()) throw new Error("COMFY_STUDIO_URL is not configured");
  const url = `${STUDIO_BASE}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "content-type": "application/json",
      ...(opts?.headers ?? {}),
    },
    // Never let an unresponsive Comfy Studio host hang a request indefinitely.
    signal: opts?.signal ?? AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Studio ${path} → HTTP ${res.status}: ${txt.slice(0, 300)}`);
  }
  return res.json() as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type StudioStatus = {
  connected: boolean;
  serverUrl?: string;
  gpuName?: string;
  gpuVram?: string;
  ramUsed?: string;
  ramTotal?: string;
  queueRemaining?: number;
  error?: string;
};

export type StudioWorkflowParam = {
  key: string;
  label: string;
  type: "text" | "number" | "file" | "select" | "slider";
  required?: boolean;
  defaultValue?: string | number | boolean | null;
  options?: string[];
  min?: number;
  max?: number;
  accept?: string;
};

export type StudioWorkflow = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  params: StudioWorkflowParam[];
};

export type StudioOutput = {
  type: string; // e.g. "image/png", "video/mp4"
  comfyUrl: string; // relative path like /api/comfy/view?filename=...
  filename?: string;
};

export type StudioJob = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  comfyPromptId?: string;
  progress?: number;
  outputs?: StudioOutput[];
  error?: string;
};

// ─── API helpers ─────────────────────────────────────────────────────────────

/** GET /api/comfy/status — ComfyUI server connection + GPU info */
export async function getStudioStatus(): Promise<StudioStatus> {
  return studioFetch<StudioStatus>("/api/comfy/status");
}

/** GET /api/workflows — list all workflow templates on this Studio */
export async function getStudioWorkflows(): Promise<StudioWorkflow[]> {
  const raw = await studioFetch<StudioWorkflow[] | { workflows: StudioWorkflow[] }>("/api/workflows");
  return Array.isArray(raw) ? raw : raw.workflows ?? [];
}

/** POST /api/jobs — submit a generation job */
export async function submitStudioJob(
  workflowId: string,
  params: Record<string, unknown>,
): Promise<StudioJob> {
  return studioFetch<StudioJob>("/api/jobs", {
    method: "POST",
    body: JSON.stringify({ workflowId, params }),
  });
}

/**
 * POST /api/jobs/{id}/refresh — ask Studio to re-poll ComfyUI for updated
 * status. Call this every ~5 s while status === "running".
 */
export async function refreshStudioJob(jobId: string): Promise<StudioJob> {
  return studioFetch<StudioJob>(`/api/jobs/${encodeURIComponent(jobId)}/refresh`, {
    method: "POST",
    body: "{}",
  });
}

/** GET /api/jobs/{id} — full job detail including outputs[] */
export async function getStudioJob(jobId: string): Promise<StudioJob> {
  return studioFetch<StudioJob>(`/api/jobs/${encodeURIComponent(jobId)}`);
}

/** GET /api/outputs/recent — latest generated files across all jobs */
export async function getStudioRecentOutputs(): Promise<StudioOutput[]> {
  const raw = await studioFetch<StudioOutput[] | { outputs: StudioOutput[] }>("/api/outputs/recent");
  return Array.isArray(raw) ? raw : raw.outputs ?? [];
}

/** GET /api/comfy/models — models available on the connected ComfyUI server */
export async function getStudioModels(): Promise<{
  checkpoints: string[];
  loras: string[];
  vaes: string[];
  controlnets: string[];
}> {
  return studioFetch("/api/comfy/models");
}
