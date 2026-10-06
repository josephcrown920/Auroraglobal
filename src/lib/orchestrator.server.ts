import { createHmac } from "node:crypto";
// Aurora Orchestration Layer (server-only)
// Providers:
//   - lovable     → Lovable AI Gateway (Gemini image/text)
//   - replicate   → Replicate direct API (Seedream, Seedance, Kling, Flux, Wav2Lip)
//   - huggingface → HF Inference (flux-schnell, sdxl)
//   - sync        → Sync.so direct API (lipsync)
//   - gpuWorker   → admin-registered HTTP workers (RunPod / vast / salad / self-hosted)

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { replicateRun, pickReplicateUrl, getReplicateKey } from "./replicate.server";
import { syncLipsync } from "./sync.server";
import { hfTextToImage } from "./hf.server";
import { isTrustedUrl } from "./url-guard";

export type GenerateKind = "image" | "video" | "lipsync" | "upscale" | "motion";
export type MotionType = "faithful" | "expressive" | "subtle" | "exaggerated";
export type CameraMovement =
  | "static"
  | "push_in"
  | "pull_out"
  | "orbit_cw"
  | "orbit_ccw"
  | "pan_left"
  | "pan_right"
  | "tilt_up"
  | "tilt_down"
  | "zoom_in"
  | "zoom_out"
  | "handheld";

// ─── Studio bucket signing ───────────────────────────────────────────────────
// The `studio` bucket is PRIVATE. When we hand a reference URL to an external
// provider (Replicate, Kling, Gemini ref, etc.), the `/object/public/...` URL
// returns 400. Rewrite any such URL to a short-lived signed URL before the
// provider fetches it. Non-studio URLs pass through untouched.
const PUBLIC_STUDIO_RE = /\/storage\/v1\/object\/public\/studio\/(.+)$/;
async function signIfStudio(url: string | undefined | null): Promise<string | undefined | null> {
  if (!url) return url;
  const m = url.match(PUBLIC_STUDIO_RE);
  if (!m) return url;
  const path = decodeURIComponent(m[1].split("?")[0]);
  const { data, error } = await supabaseAdmin.storage
    .from("studio")
    .createSignedUrl(path, 60 * 60); // 1 hour
  if (error || !data?.signedUrl) return url; // fall back; provider will surface error
  return data.signedUrl;
}
async function signStudioRefs(req: GenerateRequest): Promise<GenerateRequest> {
  const out: GenerateRequest = { ...req };
  if (req.imageUrls?.length) {
    out.imageUrls = await Promise.all(req.imageUrls.map(async (u) => (await signIfStudio(u)) ?? u));
  }
  const audio = await signIfStudio(req.audioUrl);
  const video = await signIfStudio(req.videoUrl);
  if (audio) out.audioUrl = audio;
  if (video) out.videoUrl = video;
  return out;
}

export type GenerateRequest = {
  kind: GenerateKind;
  prompt?: string;
  imageUrls?: string[];
  audioUrl?: string;
  videoUrl?: string;
  duration?: number;
  resolution?: "480p" | "720p" | "1080p";
  model?: string;
  /** Optional camera-movement preset (e.g. static, push_in, pan_left, orbit_cw). */
  cameraMovement?: string | null;
  /** Optional motion intensity used to preserve the intended movement style. */
  motionType?: MotionType | null;
  userId?: string | null;
  refId?: string | null;
};

export type GenerateResult = {
  url: string;
  provider: string;
  endpoint: string;
  latencyMs: number;
  costUsd: number;
};

const CAMERA_HINTS: Record<string, string> = {
  static: "locked-off static camera with no camera movement",
  zoom_in: "slow, smooth dolly zoom toward the subject",
  zoom_out: "slow, smooth dolly zoom away from the subject",
  pan_left: "smooth horizontal camera pan to the left",
  pan_right: "smooth horizontal camera pan to the right",
  tilt_up: "smooth vertical camera tilt upward",
  tilt_down: "smooth vertical camera tilt downward",
  orbit_cw: "cinematic clockwise orbit around the subject",
  orbit_ccw: "cinematic counter-clockwise orbit around the subject",
  push_in: "confident push-in toward the subject",
  pull_out: "graceful pull-out reveal away from the subject",
  handheld: "subtle handheld camera movement with controlled natural sway",
};

const MOTION_HINTS: Record<MotionType, string> = {
  faithful: "keep the subject's pose and identity faithful to the reference",
  expressive: "use expressive, natural body movement while preserving the subject's identity",
  subtle: "use restrained, minimal movement with a calm, stable performance",
  exaggerated: "use bold, energetic movement while keeping the subject recognizable",
};

function addMotionDirection(req: GenerateRequest): GenerateRequest {
  if (req.kind !== "video" || !req.prompt) return req;

  const cameraHint = req.cameraMovement ? CAMERA_HINTS[req.cameraMovement] : undefined;
  const motionHint = req.motionType ? MOTION_HINTS[req.motionType] : undefined;
  const hints = [cameraHint, motionHint].filter(Boolean);
  if (hints.length === 0) return req;

  return {
    ...req,
    prompt: `${req.prompt.replace(/\s+$/, "")}. ${hints.join(". ")}.`,
  };
}

// ─── Retry with exponential backoff ──────────────────────────────────────────
// Wraps a single provider call. Retries on transient failures only
// (network errors, 429, 5xx). Skips retry on 4xx auth/validation errors.
const TRANSIENT_RE = /\b(429|5\d\d|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|network|timeout)\b/i;
async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (i === attempts || !TRANSIENT_RE.test(msg)) break;
      const delay = 400 * Math.pow(2, i) + Math.floor(Math.random() * 200);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

type ProviderAdapter = {
  name: "lovable" | "gemini" | "replicate" | "huggingface" | "sync" | "runpod" | "ark" | "kling" | "heygen" | "fal";
  supports: (req: GenerateRequest) => boolean;
  estimateCost: (req: GenerateRequest) => number;
  run: (req: GenerateRequest) => Promise<{ url: string; endpoint: string }>;
};

// ─── Ark / ModelArk video generation ─────────────────────────────────────────
// BytePlus ModelArk uses an async task API. The base URL can be overridden for
// a regional endpoint or an activated endpoint, while the documented public
// endpoint is used by default.
const ARK_DEFAULT_BASE = "https://ark.ap-southeast.bytepluses.com";
const ARK_VIDEO_MODEL_DEFAULT = "dreamina-seedance-2-0-260128";
const ARK_VIDEO_25_MODEL_DEFAULT = "dreamina-seedance-2-5-260628";

function arkBaseUrl(): string {
  const raw = (process.env.ARK_BASE_URL || ARK_DEFAULT_BASE).replace(/\/+$/, "");
  return raw.endsWith("/api/v3") ? raw : `${raw}/api/v3`;
}

function arkVideoModel(modelKey: string | undefined): string {
  if (modelKey === "seedance-2.5") {
    return process.env.ARK_VIDEO_25_MODEL || ARK_VIDEO_25_MODEL_DEFAULT;
  }
  if (modelKey === "seedance-2.0-fast") {
    return process.env.ARK_VIDEO_FAST_MODEL || process.env.ARK_VIDEO_MODEL || ARK_VIDEO_MODEL_DEFAULT;
  }
  return process.env.ARK_VIDEO_MODEL || ARK_VIDEO_MODEL_DEFAULT;
}

function arkHeaders(): Record<string, string> {
  const key = process.env.ARK_API_KEY || process.env.BYTEPLUS_API_KEY;
  if (!key) throw new Error("ARK_API_KEY missing");
  return { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
}

const arkVideo: ProviderAdapter = {
  name: "ark",
  supports: (r) =>
    r.kind === "video" &&
    !!(process.env.ARK_API_KEY || process.env.BYTEPLUS_API_KEY) &&
    (r.model === "seedance-2.5" || r.model === "seedance-2.0" || r.model === "seedance-2.0-fast"),
  estimateCost: (r) => (r.model === "seedance-2.0-fast" ? 0.09 : r.model === "seedance-2.5" ? 0.15 : 0.15) * (r.duration ?? 5),
  async run(r) {
    const content: Array<Record<string, unknown>> = [];
    const images = r.imageUrls ?? [];
    const usesSeedance25 = r.model === "seedance-2.5";
    if (images[0]) {
      content.push({
        type: "image_url",
        role: usesSeedance25 ? "reference_image" : "first_frame",
        image_url: { url: images[0] },
      });
    }
    if (images[1]) {
      content.push({
        type: "image_url",
        role: usesSeedance25 ? "reference_image" : "last_frame",
        image_url: { url: images[1] },
      });
    }
    if (r.videoUrl) {
      content.push({ type: "video_url", role: "reference_video", video_url: { url: r.videoUrl } });
    }
    if (r.audioUrl) {
      content.push({ type: "audio_url", role: "reference_audio", audio_url: { url: r.audioUrl } });
    }
    if (r.prompt) content.push({ type: "text", text: r.prompt });
    if (content.length === 0) throw new Error("Ark video requires an image or prompt");

    const body: Record<string, unknown> = {
      model: arkVideoModel(r.model),
      content,
      resolution: r.resolution ?? "720p",
      duration: usesSeedance25
        ? Math.max(4, Math.min(30, Math.round(r.duration ?? 5)))
        : Math.max(3, Math.min(15, Math.round(r.duration ?? 5))),
    };
    if (r.cameraMovement === "static") body.camera_fixed = true;

    const create = await fetch(`${arkBaseUrl()}/contents/generations/tasks`, {
      method: "POST",
      headers: arkHeaders(),
      body: JSON.stringify(body),
    });
    if (!create.ok) {
      throw new Error(`Ark create failed (${create.status}): ${(await create.text()).slice(0, 300)}`);
    }

    const created = await create.json() as { id?: string; task_id?: string; data?: { id?: string } };
    const taskId = created.id ?? created.task_id ?? created.data?.id;
    if (!taskId) throw new Error("Ark returned no video task ID");

    const deadline = Date.now() + 10 * 60_000;
    let delay = 3000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay + 1000, 7000);

      const poll = await fetch(`${arkBaseUrl()}/contents/generations/tasks/${encodeURIComponent(taskId)}`, {
        headers: arkHeaders(),
      });
      if (!poll.ok) {
        throw new Error(`Ark poll failed (${poll.status}): ${(await poll.text()).slice(0, 300)}`);
      }

      const task = await poll.json() as {
        status?: string;
        content?: { video_url?: string };
        output?: { video_url?: string };
        error?: { message?: string } | string;
      };
      const status = task.status?.toLowerCase();
      if (status === "succeeded" || status === "completed") {
        const url = task.content?.video_url ?? task.output?.video_url;
        if (!url) throw new Error("Ark completed without a video URL");
        return { url, endpoint: `ark:${arkVideoModel(r.model)}` };
      }
      if (status === "failed" || status === "canceled" || status === "cancelled") {
        const error = typeof task.error === "string" ? task.error : task.error?.message;
        throw new Error(`Ark ${status}: ${error ?? "unknown error"}`);
      }
    }
    throw new Error("Ark video generation timed out");
  },
};

// ─── Kling direct (JWT signed) ───────────────────────────────────────────────
function klingJwt(accessKey: string, secretKey: string): string {
  const enc = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = enc({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload = enc({ iss: accessKey, exp: now + 1800, nbf: now - 5 });
  const data = `${header}.${payload}`;
  const sig = createHmac("sha256", secretKey).update(data).digest("base64url");
  return `${data}.${sig}`;
}

const KLING_BASE = "https://api.klingai.com";
const klingDirect: ProviderAdapter = {
  name: "kling",
  // Only handle EXPLICIT Kling model requests — never hijack a Seedance/Veo/Sora
  // video request just because Kling creds happen to be set (would silently cost more).
  supports: (r) => r.kind === "video" && (r.model?.startsWith("kling") ?? false) && !!process.env.KLING_ACCESS_KEY && !!process.env.KLING_SECRET_KEY,
  estimateCost: () => 0.30,
  async run(r) {
    const token = klingJwt(process.env.KLING_ACCESS_KEY!, process.env.KLING_SECRET_KEY!);
    const isImg2Vid = !!r.imageUrls?.[0];
    const path = isImg2Vid ? "/v1/videos/image2video" : "/v1/videos/text2video";
    const body: Record<string, unknown> = {
      model_name: "kling-v1",
      prompt: r.prompt ?? "",
      duration: String(r.duration ?? 5),
      aspect_ratio: "16:9",
      mode: "std",
    };
    if (isImg2Vid) body.image = r.imageUrls![0];
    const create = await fetch(`${KLING_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!create.ok) throw new Error(`Kling ${create.status}: ${(await create.text()).slice(0, 200)}`);
    const created = await create.json();
    const taskId = created?.data?.task_id;
    if (!taskId) throw new Error("Kling returned no task_id");
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((s) => setTimeout(s, 6000));
      const t2 = klingJwt(process.env.KLING_ACCESS_KEY!, process.env.KLING_SECRET_KEY!);
      const poll = await fetch(`${KLING_BASE}${path}/${taskId}`, {
        headers: { Authorization: `Bearer ${t2}` },
      });
      if (!poll.ok) continue;
      const pj = await poll.json();
      const status = pj?.data?.task_status;
      if (status === "succeed") {
        const url = pj?.data?.task_result?.videos?.[0]?.url;
        if (!url) throw new Error("Kling: no video url");
        return { url, endpoint: `kling:${path}` };
      }
      if (status === "failed") throw new Error(`Kling failed: ${pj?.data?.task_status_msg ?? "unknown"}`);
    }
    throw new Error("Kling poll timeout");
  },
};

// ─── HeyGen (lipsync via video.translate; best-effort) ───────────────────────
const heygen: ProviderAdapter = {
  name: "heygen",
  supports: (r) => r.kind === "lipsync" && !!process.env.HEYGEN_API_KEY,
  estimateCost: () => 0.40,
  async run(r) {
    if (!r.videoUrl || !r.audioUrl) throw new Error("heygen: video+audio required");
    const key = process.env.HEYGEN_API_KEY!;
    const create = await fetch("https://api.heygen.com/v2/video/lipsync", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      body: JSON.stringify({ video_url: r.videoUrl, audio_url: r.audioUrl }),
    });
    if (!create.ok) throw new Error(`HeyGen ${create.status}: ${(await create.text()).slice(0, 200)}`);
    const cj = await create.json();
    const videoId = cj?.data?.video_id ?? cj?.video_id;
    if (!videoId) throw new Error("HeyGen returned no video_id");
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((s) => setTimeout(s, 5000));
      const st = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
        headers: { "X-Api-Key": key },
      });
      if (!st.ok) continue;
      const sj = await st.json();
      const status = sj?.data?.status;
      if (status === "completed") {
        const url = sj?.data?.video_url;
        if (!url) throw new Error("HeyGen: no video url");
        return { url, endpoint: "heygen:lipsync" };
      }
      if (status === "failed") throw new Error(`HeyGen failed: ${sj?.data?.error ?? "unknown"}`);
    }
    throw new Error("HeyGen poll timeout");
  },
};

// ─── Fal (LAST fallback — user prefers other providers) ──────────────────────
const FAL_MAP: Record<string, { path: string; kind: GenerateKind; cost: number }> = {
  "fal-fallback/flux-schnell": { path: "fal-ai/flux/schnell", kind: "image", cost: 0.005 },
  "fal-fallback/kling-video":  { path: "fal-ai/kling-video/v1/standard/image-to-video", kind: "video", cost: 0.40 },
  "fal-fallback/sync-lipsync": { path: "fal-ai/sync-lipsync", kind: "lipsync", cost: 0.30 },
};
const falFallback: ProviderAdapter = {
  name: "fal",
  // Only activates when explicitly addressed OR when nothing else handles the kind
  supports: (r) => !!process.env.FAL_KEY,
  estimateCost: (r) => (r.kind === "video" ? 0.40 : r.kind === "lipsync" ? 0.30 : 0.005),
  async run(r) {
    const key = process.env.FAL_KEY!;
    const fallback =
      r.kind === "image" ? "fal-ai/flux/schnell" :
      r.kind === "video" ? "fal-ai/kling-video/v1/standard/image-to-video" :
      r.kind === "lipsync" ? "fal-ai/sync-lipsync" : null;
    const path = (r.model && FAL_MAP[r.model]?.path) || fallback;
    if (!path) throw new Error(`Fal: no path for kind ${r.kind}`);
    const input: Record<string, unknown> = {};
    if (r.prompt) input.prompt = r.prompt;
    if (r.imageUrls?.[0]) input.image_url = r.imageUrls[0];
    if (r.videoUrl) input.video_url = r.videoUrl;
    if (r.audioUrl) input.audio_url = r.audioUrl;
    if (r.duration) input.duration = r.duration;
    const res = await fetch(`https://fal.run/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`Fal ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    const url =
      j?.video?.url ?? j?.image?.url ?? j?.images?.[0]?.url ?? j?.url ?? j?.output;
    if (!url || typeof url !== "string") throw new Error("Fal: no output url");
    return { url, endpoint: `fal:${path}` };
  },
};

// ─── Health tracking ─────────────────────────────────────────────────────────
const HEALTH = new Map<string, { failures: number; cooldownUntil: number }>();
function isHealthy(p: string) {
  const h = HEALTH.get(p);
  return !h || Date.now() > h.cooldownUntil;
}
function markFailure(p: string) {
  const h = HEALTH.get(p) ?? { failures: 0, cooldownUntil: 0 };
  h.failures += 1;
  h.cooldownUntil = Date.now() + Math.min(120, 5 * Math.pow(3, h.failures - 1)) * 1000;
  HEALTH.set(p, h);
}
function markSuccess(p: string) { HEALTH.set(p, { failures: 0, cooldownUntil: 0 }); }

/** Public snapshot of in-memory health state (used by the orchestration dashboard). */
export function getProviderHealthSnapshot() {
  const now = Date.now();
  const out: Record<string, { failures: number; cooldownMs: number; ready: boolean }> = {};
  for (const [name, h] of HEALTH.entries()) {
    out[name] = {
      failures: h.failures,
      cooldownMs: Math.max(0, h.cooldownUntil - now),
      ready: now > h.cooldownUntil,
    };
  }
  return out;
}


// ─── Lovable (Gemini via gateway) — USED LAST so paid credits stay preserved ─
const lovable: ProviderAdapter = {
  name: "lovable",
  supports: (r) => r.kind === "image" && !!process.env.LOVABLE_API_KEY,
  estimateCost: () => 0.002,
  async run(r) {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
    const endpoint = r.model && r.model.startsWith("google/") ? r.model : "google/gemini-2.5-flash-image";
    const content: Array<Record<string, unknown>> = [{ type: "text", text: r.prompt ?? "" }];
    for (const url of r.imageUrls ?? []) content.push({ type: "image_url", image_url: { url } });
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({ model: endpoint, messages: [{ role: "user", content }], modalities: ["image", "text"] }),
    });
    if (!res.ok) throw new Error(`Lovable AI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    const msg = json?.choices?.[0]?.message;
    const url: string | undefined = msg?.images?.[0]?.image_url?.url ?? msg?.images?.[0]?.url;
    if (!url) throw new Error("Lovable AI returned no image");
    return { url, endpoint };
  },
};

// ─── Gemini direct (GEMINI_API_KEY) — preferred before Lovable credits ───────
const geminiDirect: ProviderAdapter = {
  name: "gemini",
  supports: (r) => r.kind === "image" && !!process.env.GEMINI_API_KEY,
  estimateCost: () => 0,
  async run(r) {
    const key = process.env.GEMINI_API_KEY!;
    const model = "gemini-2.5-flash-image-preview";
    const parts: Array<Record<string, unknown>> = [{ text: r.prompt ?? "" }];
    for (const url of r.imageUrls ?? []) {
      try {
        if (!isTrustedUrl(url)) continue; // SSRF guard: skip untrusted ref hosts
        const fetched = await fetch(url);
        if (!fetched.ok) continue;
        const buf = Buffer.from(await fetched.arrayBuffer());
        const mime = fetched.headers.get("content-type") || "image/png";
        parts.push({ inline_data: { mime_type: mime, data: buf.toString("base64") } });
      } catch { /* skip bad ref */ }
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } }),
      },
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    const cParts = json?.candidates?.[0]?.content?.parts ?? [];
    const img = cParts.find((p: Record<string, unknown>) => p.inline_data || p.inlineData) as
      | { inline_data?: { data?: string; mime_type?: string }; inlineData?: { data?: string; mimeType?: string } }
      | undefined;
    const inline = img?.inline_data ?? img?.inlineData;
    if (!inline?.data) throw new Error("Gemini returned no image");
    const mime = (inline as { mime_type?: string }).mime_type || (inline as { mimeType?: string }).mimeType || "image/png";
    const ext = mime.split("/")[1] || "png";
    const path = `${r.userId ?? "system"}/gemini/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("studio")
      .upload(path, Buffer.from(inline.data, "base64"), { contentType: mime, upsert: false });
    if (error) throw new Error(`Gemini upload failed: ${error.message}`);
    const { data } = supabaseAdmin.storage.from("studio").getPublicUrl(path);
    return { url: data.publicUrl, endpoint: `gemini:${model}` };
  },
};

// ─── Replicate ───────────────────────────────────────────────────────────────
// Map our model keys → Replicate official model slugs (owner/name) + a per-model
// input builder. Each Replicate model has a DIFFERENT input schema, so we build
// inputs per-model instead of guessing by slug prefix:
//   seedance → image + integer duration   kling → start_image + enum duration
//   wan i2v  → image + enum duration       veo   → optional image (no duration)
//   sora     → input_reference (no duration)  nano-banana/seedream → image_input[]
const durEnum = (d?: number) => ((d ?? 5) >= 10 ? "10" : "5");
const durInt = (d?: number) => Math.max(3, Math.min(12, d ?? 5));
const firstImg = (r: GenerateRequest) => r.imageUrls?.[0];

type ReplicateEntry = {
  slug: string;
  kind: GenerateKind;
  cost: number;
  build: (r: GenerateRequest) => Record<string, unknown>;
};

const REPLICATE_MAP: Record<string, ReplicateEntry> = {
  // ── images ──
  "google/nano-banana":     { slug: "google/nano-banana",            kind: "image", cost: 0.039,
    build: (r) => ({ prompt: r.prompt ?? "", ...(r.imageUrls?.length ? { image_input: r.imageUrls } : {}) }) },
  "fal-ai/seedream-4":      { slug: "bytedance/seedream-4",          kind: "image", cost: 0.04,
    build: (r) => ({ prompt: r.prompt ?? "", ...(r.imageUrls?.length ? { image_input: r.imageUrls } : {}) }) },
  "fal-ai/seedream-4.5":    { slug: "bytedance/seedream-4",          kind: "image", cost: 0.05,
    build: (r) => ({ prompt: r.prompt ?? "", ...(r.imageUrls?.length ? { image_input: r.imageUrls } : {}) }) },
  "replicate/flux-schnell": { slug: "black-forest-labs/flux-schnell", kind: "image", cost: 0.003,
    build: (r) => ({ prompt: r.prompt ?? "" }) },
  // ── video (image-to-video) ──
  "seedance-2.0":           { slug: "bytedance/seedance-1-pro",      kind: "video", cost: 0.65,
    build: (r) => ({ prompt: r.prompt ?? "", ...(firstImg(r) ? { image: firstImg(r) } : {}), duration: durInt(r.duration) }) },
  "seedance-2.0-fast":      { slug: "bytedance/seedance-1-lite",     kind: "video", cost: 0.05,
    build: (r) => ({ prompt: r.prompt ?? "", ...(firstImg(r) ? { image: firstImg(r) } : {}), duration: durInt(r.duration) }) },
  "wan-2.5":                { slug: "wan-video/wan-2.5-i2v",         kind: "video", cost: 0.45,
    build: (r) => ({ prompt: r.prompt ?? "", ...(firstImg(r) ? { image: firstImg(r) } : {}), duration: durEnum(r.duration) }) },
  "kling-3.0":              { slug: "kwaivgi/kling-v2.1",            kind: "video", cost: 0.60,
    build: (r) => ({ prompt: r.prompt ?? "", ...(firstImg(r) ? { start_image: firstImg(r) } : {}), duration: durEnum(r.duration), ...(r.imageUrls?.[1] ? { end_image: r.imageUrls[1] } : {}) }) },
  "kling-3.0-omni":         { slug: "kwaivgi/kling-v2.1-master",     kind: "video", cost: 0.70,
    build: (r) => ({ prompt: r.prompt ?? "", ...(firstImg(r) ? { start_image: firstImg(r) } : {}), duration: durEnum(r.duration), ...(r.imageUrls?.[1] ? { end_image: r.imageUrls[1] } : {}) }) },
  "veo-3-fast":             { slug: "google/veo-3-fast",             kind: "video", cost: 0.40,
    build: (r) => ({ prompt: r.prompt ?? "", ...(firstImg(r) ? { image: firstImg(r) } : {}) }) },
  "veo-3":                  { slug: "google/veo-3",                  kind: "video", cost: 0.75,
    build: (r) => ({ prompt: r.prompt ?? "", ...(firstImg(r) ? { image: firstImg(r) } : {}) }) },
  "sora-2":                 { slug: "openai/sora-2",                 kind: "video", cost: 0.50,
    build: (r) => ({ prompt: r.prompt ?? "", ...(firstImg(r) ? { input_reference: firstImg(r) } : {}) }) },
  // ── lipsync (fallback after sync.so direct) ──
  "fal-ai/sync-lipsync/v2": { slug: "sync/lipsync-2",               kind: "lipsync", cost: 0.30,
    build: (r) => ({ video: r.videoUrl, audio: r.audioUrl }) },
  "fal-ai/wav2lip":         { slug: "devxpy/cog-wav2lip",          kind: "lipsync", cost: 0.10,
    build: (r) => ({ face: r.videoUrl, audio: r.audioUrl }) },
};

const replicate: ProviderAdapter = {
  name: "replicate",
  supports: (r) => {
    if (!getReplicateKey()) return false;
    if (!r.model) return false;
    const m = REPLICATE_MAP[r.model];
    return !!m && m.kind === r.kind;
  },
  estimateCost: (r) => (r.model && REPLICATE_MAP[r.model]?.cost) || 0.10,
  async run(r) {
    const m = r.model ? REPLICATE_MAP[r.model] : null;
    if (!m) throw new Error(`No Replicate mapping for model: ${r.model}`);
    const input = m.build(r);
    const result = await replicateRun(m.slug, input, 600_000);
    const url = pickReplicateUrl(result.output);
    return { url, endpoint: `replicate:${m.slug}` };
  },
};

// ─── Sync.so direct ──────────────────────────────────────────────────────────
const sync: ProviderAdapter = {
  name: "sync",
  supports: (r) => r.kind === "lipsync" && !!process.env.SYNC_API_KEY,
  estimateCost: () => 0.25,
  async run(r) {
    if (!r.videoUrl || !r.audioUrl) throw new Error("sync: video+audio required");
    const url = await syncLipsync({ videoUrl: r.videoUrl, audioUrl: r.audioUrl, model: "lipsync-2" });
    return { url, endpoint: "sync:lipsync-2" };
  },
};

// ─── Hugging Face ────────────────────────────────────────────────────────────
const HF_ENDPOINTS: Record<string, { endpoint: string; kind: GenerateKind; cost: number }> = {
  "hf/flux-schnell": { endpoint: "black-forest-labs/FLUX.1-schnell", kind: "image", cost: 0.003 },
  "hf/sdxl":         { endpoint: "stabilityai/stable-diffusion-xl-base-1.0", kind: "image", cost: 0.004 },
};
const huggingface: ProviderAdapter = {
  name: "huggingface",
  supports: (r) => {
    if (!process.env.HF_TOKEN) return false;
    if (!r.model) return false;
    const m = HF_ENDPOINTS[r.model];
    return !!m && m.kind === r.kind;
  },
  estimateCost: (r) => (r.model && HF_ENDPOINTS[r.model]?.cost) || 0.005,
  async run(r) {
    const m = r.model ? HF_ENDPOINTS[r.model] : null;
    if (!m) throw new Error(`Unsupported HF model: ${r.model}`);
    const { bytes, contentType } = await hfTextToImage(m.endpoint, r.prompt ?? "");
    const ext = contentType.split("/")[1] || "png";
    const path = `${r.userId ?? "system"}/hf/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("studio")
      .upload(path, new Uint8Array(bytes), { contentType, upsert: false });
    if (error) throw new Error(`HF upload failed: ${error.message}`);
    const { data } = supabaseAdmin.storage.from("studio").getPublicUrl(path);
    return { url: data.publicUrl, endpoint: m.endpoint };
  },
};

// ─── GPU worker pool ─────────────────────────────────────────────────────────
export async function hasActiveWorkerForKind(kind: GenerateKind): Promise<boolean> {
  const { data: workers } = await supabaseAdmin
    .from("gpu_workers")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .contains("capabilities", [kind]);
  return (workers?.length ?? 0) > 0;
}

const gpuWorker: ProviderAdapter = {
  name: "runpod",
  supports: (r) => ["image", "video", "lipsync", "upscale", "motion"].includes(r.kind),
  estimateCost: (r) => (r.kind === "video" ? 0.05 : r.kind === "motion" ? 0.02 : 0.01),
  async run(r) {
    const { data: workers } = await supabaseAdmin
      .from("gpu_workers")
      .select("*")
      .eq("status", "active")
      .contains("capabilities", [r.kind])
      .order("priority", { ascending: true })
      .order("in_flight", { ascending: true })
      .limit(5);
    if (!workers || workers.length === 0) throw new Error("No GPU workers available");
    let lastErr: Error | null = null;
    for (const w of workers) {
      if (w.in_flight >= w.max_concurrency) continue;
      const started = Date.now();
      try {
        await supabaseAdmin.from("gpu_workers").update({ in_flight: w.in_flight + 1 }).eq("id", w.id);
        
        const protocol = w.protocol ?? "custom";
        let url: string | undefined;
        
        console.log(`[GPU Worker] Dispatching to ${w.name} (protocol: ${protocol})`);
        
        if (protocol === "runpod") {
          // RunPod async dispatch: POST to /run, poll /status/{id}
          const input = {
            kind: r.kind, prompt: r.prompt, image_urls: r.imageUrls,
            audio_url: r.audioUrl, video_url: r.videoUrl,
            model: r.model, duration: r.duration, resolution: r.resolution,
          };
          console.log(`[RunPod] Creating job to ${w.endpoint_url}/run with input:`, { kind: input.kind, model: input.model });
          console.log(`[RunPod] Auth token: ${w.auth_token ? "present" : "missing"}`, w.auth_token ? `("${w.auth_token.slice(0, 10)}...")` : "");
          const createRes = await fetch(w.endpoint_url.replace(/\/$/, "") + "/run", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(w.auth_token ? { authorization: `Bearer ${w.auth_token}` } : {}),
            },
            body: JSON.stringify({ input }),
            signal: AbortSignal.timeout(60_000),
          });
          console.log(`[RunPod] Create response status: ${createRes.status}`);
          if (!createRes.ok) throw new Error(`worker ${w.name} (create) -> ${createRes.status}`);
          const createJson = (await createRes.json()) as { id?: string };
          const jobId = createJson.id;
          console.log(`[RunPod] Got job ID: ${jobId}`);
          if (!jobId) throw new Error(`worker ${w.name} returned no job id`);
          
          const deadline = Date.now() + 900_000; // 15 min
          while (Date.now() < deadline) {
            await new Promise((s) => setTimeout(s, 3000));
            const statusRes = await fetch(w.endpoint_url.replace(/\/$/, "") + `/status/${jobId}`, {
              headers: w.auth_token ? { authorization: `Bearer ${w.auth_token}` } : {},
              signal: AbortSignal.timeout(30_000),
            });
            if (!statusRes.ok) {
              console.log(`[RunPod] Status poll failed with ${statusRes.status}, retrying...`);
              continue;
            }
            const statusJson = (await statusRes.json()) as { status?: string; output?: { url?: string; output_url?: string } };
            console.log(`[RunPod] Job status: ${statusJson.status}`);
            if (statusJson.status === "COMPLETED") {
              const output = statusJson.output;
              url = output?.url ?? output?.output_url;
              console.log(`[RunPod] Job completed, output URL: ${url}`);
              if (!url) throw new Error(`worker ${w.name} job completed without output url`);
              break;
            }
            if (statusJson.status === "FAILED") throw new Error(`worker ${w.name} job failed`);
          }
          if (!url) throw new Error(`worker ${w.name} poll timeout`);
        } else {
          // Custom / default protocol: POST to /generate with immediate response
          const res = await fetch(w.endpoint_url.replace(/\/$/, "") + "/generate", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(w.auth_token ? { authorization: `Bearer ${w.auth_token}` } : {}),
            },
            body: JSON.stringify({
              kind: r.kind, prompt: r.prompt, image_urls: r.imageUrls,
              audio_url: r.audioUrl, video_url: r.videoUrl,
              model: r.model, duration: r.duration, resolution: r.resolution,
            }),
            signal: AbortSignal.timeout(300_000),
          });
          if (!res.ok) throw new Error(`worker ${w.name} -> ${res.status}`);
          const json = (await res.json()) as { url?: string; output_url?: string };
          url = json.url ?? json.output_url;
          if (!url) throw new Error(`worker ${w.name} returned no url`);
        }

        await supabaseAdmin.from("worker_jobs").insert({
          worker_id: w.id, user_id: r.userId ?? null, kind: r.kind,
          status: "ok", latency_ms: Date.now() - started, ref_id: r.refId ?? null,
        });
        return { url, endpoint: `gpu:${w.name}` };
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        await supabaseAdmin.from("worker_jobs").insert({
          worker_id: w.id, user_id: r.userId ?? null, kind: r.kind,
          status: "error", latency_ms: Date.now() - started, error: lastErr.message.slice(0, 500),
        });
      } finally {
        await supabaseAdmin.from("gpu_workers")
          .update({ in_flight: Math.max(0, w.in_flight), last_heartbeat: new Date().toISOString() })
          .eq("id", w.id);
      }
    }
    throw lastErr ?? new Error("All GPU workers failed");
  },
};

// ─── Priority chain per kind ─────────────────────────────────────────────────
// Order matters: cheapest/free direct providers first; Lovable credits and Fal LAST.
// User preference: avoid Fal — only used as final fallback. HuggingFace is wired
// for free image generation. Kling direct (JWT) handles video without Replicate.
// HeyGen handles lipsync as a quality alternative to sync.so.
const PRIORITY: Record<GenerateKind, ProviderAdapter[]> = {
  image:   [geminiDirect, huggingface, replicate, lovable, gpuWorker, falFallback],
  video:   [arkVideo, klingDirect, replicate, gpuWorker, falFallback],
  lipsync: [sync, heygen, replicate, gpuWorker, falFallback],
  upscale: [replicate, gpuWorker, falFallback],
  motion:  [gpuWorker],
};

// ─── Unified model registry ──────────────────────────────────────────────────
// Single source of truth for model → { provider, kind, cost } lookup.
// Use this from server fns / admin UIs instead of poking REPLICATE_MAP etc.
// directly. Adding a new model? Add it here AND to the underlying provider map
// (REPLICATE_MAP / HF_ENDPOINTS / FAL_MAP) — they own the slug/path mapping.
export type ModelEntry = {
  provider: ProviderAdapter["name"];
  kind: GenerateKind;
  cost: number;
};
export const MODEL_REGISTRY: Record<string, ModelEntry> = (() => {
  const out: Record<string, ModelEntry> = {
    // Lovable AI gateway (Gemini image)
    "google/gemini-2.5-flash-image":          { provider: "lovable", kind: "image", cost: 0.002 },
    "google/gemini-3.1-flash-image-preview":  { provider: "lovable", kind: "image", cost: 0.002 },
    "google/gemini-3-pro-image-preview":      { provider: "lovable", kind: "image", cost: 0.01  },
    // Kling direct (JWT)
    "kling-v1":                               { provider: "kling",   kind: "video", cost: 0.30 },
    // HeyGen lipsync
    "heygen/lipsync":                         { provider: "heygen",  kind: "lipsync", cost: 0.40 },
    // Sync.so direct lipsync
    "sync/lipsync-2":                         { provider: "sync",    kind: "lipsync", cost: 0.25 },
    // MimicMotion (GPU worker only)
    "mimic-motion":                           { provider: "runpod",  kind: "motion", cost: 0.02 },
  };
  for (const [k, v] of Object.entries(REPLICATE_MAP))
    out[k] = { provider: "replicate", kind: v.kind, cost: v.cost };
  for (const [k, v] of Object.entries(HF_ENDPOINTS))
    out[k] = { provider: "huggingface", kind: v.kind, cost: v.cost };
  for (const [k, v] of Object.entries(FAL_MAP))
    out[k] = { provider: "fal", kind: v.kind, cost: v.cost };
  out["seedance-2.0"] = { provider: "ark", kind: "video", cost: 0.15 };
  out["seedance-2.0-fast"] = { provider: "ark", kind: "video", cost: 0.09 };
  out["seedance-2.5"] = { provider: "ark", kind: "video", cost: 0.15 };
  return out;
})();

export function resolveModel(modelKey: string | undefined | null): ModelEntry | null {
  if (!modelKey) return null;
  return MODEL_REGISTRY[modelKey] ?? null;
}

async function log(opts: {
  provider: string; endpoint: string; kind: GenerateKind;
  status: "ok" | "error"; latencyMs: number; costUsd: number;
  error?: string; userId?: string | null; refId?: string | null;
}) {
  try {
    await supabaseAdmin.from("provider_logs").insert({
      provider: opts.provider, endpoint: opts.endpoint, kind: opts.kind,
      status: opts.status, latency_ms: opts.latencyMs, cost_usd: opts.costUsd,
      error: opts.error ?? null, user_id: opts.userId ?? null, ref_id: opts.refId ?? null,
    });
  } catch { /* no-op */ }
}

// ─── Model-level fallback ────────────────────────────────────────────────────
// On top of provider fallback: if the requested model's providers all fail, try
// a bounded, cheapest-first list of alternate same-kind models (all reachable on
// the Replicate key). Capped so paid video generations never run away on cost.
const FALLBACK_MODELS: Record<GenerateKind, string[]> = {
  image:   ["google/nano-banana", "replicate/flux-schnell", "fal-ai/seedream-4"],
  video:   ["seedance-2.0-fast", "seedance-2.0", "seedance-2.5", "wan-2.5", "kling-3.0", "veo-3-fast", "sora-2"],
  lipsync: ["fal-ai/sync-lipsync/v2", "fal-ai/wav2lip"],
  upscale: [],
  motion:  ["mimic-motion"],
};
const FALLBACK_CAP: Record<GenerateKind, number> = { image: 3, video: 2, lipsync: 2, upscale: 1, motion: 1 };

function getCandidateModels(req: GenerateRequest): string[] {
  const base = FALLBACK_MODELS[req.kind] ?? [];
  const ordered = [req.model, ...base].filter((m): m is string => !!m);
  const cap = Math.max(1, FALLBACK_CAP[req.kind] ?? 2);
  return Array.from(new Set(ordered)).slice(0, cap);
}

// Request-level problems that every provider/model would hit identically — abort
// fast instead of burning fallback attempts. Provider auth (401/403) is
// deliberately EXCLUDED: a bad Gemini/Lovable key must fall through to Replicate.
const FATAL_RE = /url (?:host|scheme) not allowed|invalid url|not your|unsafe/i;

// Provider-down / quota signals worth briefly circuit-breaking the provider for.
// Model-specific input errors (e.g. 400/422) are NOT here, so one bad model never
// blacklists a healthy provider for other requests.
const PROVIDER_DOWN_RE = /\b(429|5\d\d|402)\b|timeout|timed out|econnreset|econnrefused|etimedout|fetch failed|socket hang up|capacity|temporarily unavailable|rate limit/i;

export async function orchestrate(rawReq: GenerateRequest): Promise<GenerateResult> {
  // Sign private-studio refs once, up front, so every adapter sees a fetchable URL.
  const req = addMotionDirection(await signStudioRefs(rawReq));
  const candidates = getCandidateModels(req);
  // Snapshot provider health ONCE. Without this, a failure on the first candidate
  // model marks its provider (e.g. Replicate) unhealthy and skips it for every
  // remaining candidate — which would defeat model-level fallback inside a single
  // request, since most candidates share the Replicate provider.
  const healthyAtStart = new Set(
    PRIORITY[req.kind].filter((a) => isHealthy(a.name)).map((a) => a.name),
  );
  let lastErr: Error | null = null;
  let triedAny = false;

  for (const modelKey of candidates) {
    const r: GenerateRequest = { ...req, model: modelKey };
    const adapters = PRIORITY[r.kind].filter((a) => a.supports(r) && healthyAtStart.has(a.name));
    if (adapters.length === 0) continue;

    for (const adapter of adapters) {
      triedAny = true;
      const start = Date.now();
      try {
        const { url, endpoint } = await withRetry(() => adapter.run(r), 2);
        const latency = Date.now() - start;
        const cost = adapter.estimateCost(r);
        markSuccess(adapter.name);
        await log({ provider: adapter.name, endpoint, kind: r.kind, status: "ok",
          latencyMs: latency, costUsd: cost, userId: r.userId, refId: r.refId });
        return { url, provider: adapter.name, endpoint, latencyMs: latency, costUsd: cost };
      } catch (e) {
        const latency = Date.now() - start;
        const msg = e instanceof Error ? e.message : String(e);
        lastErr = e instanceof Error ? e : new Error(msg);
        // Only back a provider off for genuine provider-down/quota signals, so a
        // single bad model never blacklists a healthy provider for other requests.
        if (PROVIDER_DOWN_RE.test(msg)) markFailure(adapter.name);
        await log({ provider: adapter.name, endpoint: modelKey, kind: r.kind,
          status: "error", latencyMs: latency, costUsd: 0, error: msg.slice(0, 500),
          userId: r.userId, refId: r.refId });
        if (FATAL_RE.test(msg)) throw lastErr; // bad request — every model fails the same
      }
    }
  }

  if (!triedAny) {
    const all = PRIORITY[req.kind];
    const reasons = all.map((a) => {
      if (!a.supports(req)) return `${a.name}: missing config/key for model "${req.model ?? "?"}"`;
      if (!isHealthy(a.name)) return `${a.name}: cooling down after recent failure`;
      return `${a.name}: ok`;
    }).join("; ");
    throw new Error(`No provider available for ${req.kind} → ${reasons}`);
  }
  throw lastErr ?? new Error("All providers failed");
}


// ─── Free-GPU-only guard (build-time compatibility repair) ────────────────────
// Kept here because studio/lipsync server functions import this guard directly.
// Paid adapters must never be reached while free-GPU-only mode is enabled.
import { isFreeGpuOnlyMode } from "./app-settings.server";

export const FREE_MODE_NO_WORKER_MSG =
  "Free GPU only mode is on — start a GPU worker for this operation before trying again.";

export async function assertFreeModeServable(kind: GenerateKind): Promise<void> {
  if (!(await isFreeGpuOnlyMode())) return;

  // Images have the existing $0 hosted path and therefore do not require a
  // self-hosted worker. Temporal workloads must have an active GPU worker.
  if (kind === "image") return;

  if (await hasActiveWorkerForKind(kind)) return;

  throw new Error(FREE_MODE_NO_WORKER_MSG);
}
