// API client for the Aurora Video Agent backend.
// In development (via Vite proxy) all /api/video-agent/* calls are forwarded
// to the main Aurora app at localhost:8080.
// In production, set VITE_AURORA_URL to your deployed Aurora instance.

const BASE =
  (import.meta.env.VITE_AURORA_URL as string) ||
  (typeof window !== "undefined" ? "" : "http://localhost:8080");

async function post<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${res.status})`);
  return json as T;
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (${res.status})`);
  return json as T;
}

// ── Enhance ──────────────────────────────────────────────────────────────────

export interface EnhanceParams {
  prompt: string;
  targetSeconds?: number;
  directToCamera?: boolean;
  styleId?: string;
  directorProvider?: "auto" | "anthropic" | "xai" | "openrouter";
}

export async function enhanceScript(
  params: EnhanceParams,
  token: string,
): Promise<{ script: string; provider?: string }> {
  return post("/api/video-agent/enhance", params, token);
}

// ── Submit (async) ────────────────────────────────────────────────────────────
// Reserves credits + submits to HeyGen. Returns videoId immediately so the
// frontend can poll status without blocking a long HTTP connection.

export interface SubmitParams {
  prompt: string;
  orientation?: "landscape" | "portrait";
}

export interface SubmitResult {
  ok: boolean;
  videoId?: string;
  reservationRef?: string;
  cost?: number;
  error?: string;
  insufficient?: boolean;
  heygenCredit?: boolean;
}

export async function submitVideo(
  params: SubmitParams,
  token: string,
): Promise<SubmitResult> {
  const res = await fetch(`${BASE}/api/video-agent/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });
  const json = await res.json() as SubmitResult;
  return json;
}

// ── Status ────────────────────────────────────────────────────────────────────
// Polls HeyGen v2 /videos/:videoId. Status values: pending | processing | completed | failed.

export interface StatusResult {
  status: string;
  url?: string | null;
  error?: string | null;
}

export async function getVideoStatus(videoId: string, token: string): Promise<StatusResult> {
  return get<StatusResult>(
    `/api/video-agent/status/${encodeURIComponent(videoId)}`,
    token,
  );
}

// ── Finalize ──────────────────────────────────────────────────────────────────
// Commits credit reservation + writes generation record once the video is done.

export interface FinalizeParams {
  videoId: string;
  url: string;
  prompt: string;
  reservationRef: string;
  cost: number;
}

export interface FinalizeResult {
  ok: boolean;
  generationId?: string;
  error?: string;
}

export async function finalizeVideo(
  params: FinalizeParams,
  token: string,
): Promise<FinalizeResult> {
  return post("/api/video-agent/finalize", params, token);
}

// ── Legacy generate (kept for compatibility with main app server function) ────

export interface GenerateParams {
  prompt: string;
  orientation?: "landscape" | "portrait";
}

export interface GenerateResult {
  ok: boolean;
  url?: string;
  generationId?: string;
  error?: string;
  insufficient?: boolean;
  heygenCredit?: boolean;
}

export async function generateVideo(
  params: GenerateParams,
  token: string,
): Promise<GenerateResult> {
  const res = await fetch(`${BASE}/api/video-agent/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });
  return res.json() as Promise<GenerateResult>;
}
