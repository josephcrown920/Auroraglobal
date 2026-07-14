// API client for the Aurora Content Line backend.
// In development (via Vite proxy) /api/ugc-line/* calls are forwarded to
// the main Aurora app at localhost:8080.
// In production set VITE_AURORA_URL to your deployed Aurora instance.

const BASE =
  (import.meta.env.VITE_AURORA_URL as string) ||
  (typeof window !== "undefined" ? "" : "http://localhost:8080");

async function post<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UgcBrief {
  hook: string;
  angle: string;
  arc_position: string;
  script: string;
  scene_direction: string;
  on_screen_text: string;
  cta: string;
  caption: string;
}

export interface ImageResult {
  prompt: string;
  imageBase64: string | null;
  error: string | null;
}

// ── Script arc ────────────────────────────────────────────────────────────────

export interface ScriptsParams {
  product: string;
  audience: string;
  niche: string;
  angles: string[];
  length: "15s" | "30s" | "45s";
  count: number;
}

export async function generateScripts(
  params: ScriptsParams,
  token: string,
): Promise<{ briefs: UgcBrief[] }> {
  return post("/api/ugc-line/scripts", params, token);
}

// ── Variation prompts ─────────────────────────────────────────────────────────

export interface VariationsParams {
  direction: string;
  count: number;
  inputType: "person" | "product";
  productName?: string;
}

export async function generateVariations(
  params: VariationsParams,
  token: string,
): Promise<{ prompts: string[] }> {
  return post("/api/ugc-line/variations", params, token);
}

// ── Images from reference ─────────────────────────────────────────────────────

export interface ImagesParams {
  referenceBase64: string;
  referenceMimeType: string;
  prompts: string[];
  aspectRatio: string;
}

export async function generateImages(
  params: ImagesParams,
  token: string,
): Promise<{ results: ImageResult[] }> {
  return post("/api/ugc-line/images", params, token);
}
