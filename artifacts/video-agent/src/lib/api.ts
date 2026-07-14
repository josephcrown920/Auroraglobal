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
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

// ── Enhance ──────────────────────────────────────────────────────────────────

export interface EnhanceParams {
  prompt: string;
  targetSeconds?: number;
  directToCamera?: boolean;
  styleId?: string;
}

export async function enhanceScript(
  params: EnhanceParams,
  token: string,
): Promise<{ script: string; provider?: string }> {
  return post("/api/video-agent/enhance", params, token);
}

// ── Generate ─────────────────────────────────────────────────────────────────

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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });
  return res.json() as Promise<GenerateResult>;
}

// ── Status ────────────────────────────────────────────────────────────────────

export async function getVideoStatus(videoId: string, token: string) {
  return get<{ data?: { status?: string; video_url?: string } }>(
    `/api/video-agent/status/${encodeURIComponent(videoId)}`,
    token,
  );
}
