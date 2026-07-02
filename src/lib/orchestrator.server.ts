// Aurora Orchestration Layer (server-only)
// Providers:
//   - lovable     → Lovable AI Gateway (Gemini image/text)
//   - replicate   → Replicate direct API (Seedream, Seedance, Kling, Flux, Wav2Lip)
//   - huggingface → HF Inference (flux-schnell, sdxl)
//   - sync        → Sync.so direct API (lipsync)
//   - gpuWorker   → admin-registered HTTP workers (RunPod / vast / salad / self-hosted)

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isFreeGpuOnlyMode } from "./app-settings.server";
import { replicateRun, pickReplicateUrl, getReplicateKey } from "./replicate.server";
import { bytePlusImage, bytePlusVideo, getBytePlusKey } from "./byteplus.server";
import { syncLipsync } from "./sync.server";
import { hfTextToImage } from "./hf.server";
import { isTrustedUrl } from "./url-guard";
import { normalizeWorkerBase } from "./gpu-worker-health";
import { buildDefaultComfyWorkflow } from "./comfy-default-workflows.server";
import {
  callGradioSpace,
  extractGradioUrl,
  gradioData,
  runComfyWorkflow,
} from "./inference/protocols";
import type { InferenceInput, TaskType } from "./inference/types";

export type GenerateKind =
  | "image"
  | "video"
  | "lipsync"
  | "upscale"
  | "motion"
  | "text"
  | "audio"
  // Final ffmpeg stitch/mux/mix of a multi-scene story into one MP4. Self-hosted
  // GPU worker ONLY (Cloudflare Workers cannot run ffmpeg) — never a hosted API.
  | "assemble"
  // Burn caption segments (SRT-style timestamps + text) into a video via FFmpeg
  // drawtext. Self-hosted GPU worker ONLY — no hosted provider supports this.
  | "caption_burn"
  // AutoCut: user-uploaded clip assembly into a 9:16 short. Internally dispatches
  // an "assemble" sub-job (GPU worker) or falls back to a Replicate video model
  // when no assembler is online. Registered here so credit accounting can record
  // the canonical kind without a type-assertion escape hatch.
  | "autocut";

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
  const { data, error } = await supabaseAdmin.storage.from("studio").createSignedUrl(path, 60 * 60); // 1 hour
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
  userId?: string | null;
  refId?: string | null;
  /** Free-form provider/model params forwarded to the worker (seed, fps, steps, …). */
  params?: Record<string, unknown>;
  /** A ComfyUI prompt graph (JSON) for `comfyui`-protocol workers (wired by #13). */
  comfyWorkflow?: unknown;
  /** `"nodeId.inputName": value` patches applied to the ComfyUI graph. */
  comfyInputs?: Record<string, unknown>;
  /**
   * Force the request onto the self-hosted GPU worker pool only (capability =
   * `kind`), skipping every hosted provider. Set by the "self-hosted" engines
   * (e.g. LatentSync lip-sync) so the explicit choice never silently falls back
   * to a paid hosted API. Fails explicitly when no matching worker is online.
   */
  selfHostedOnly?: boolean;
  /**
   * Caption segments for `caption_burn` requests. Each entry is a timed text
   * cue: the GPU worker renders them over the video via FFmpeg `drawtext`.
   */
  segments?: Array<{ start: number; end: number; text: string }>;
};

export type GenerateResult = {
  url: string;
  /** For the `text` modality: the generated text (no URL output). */
  text?: string;
  provider: string;
  endpoint: string;
  /**
   * Which class of backend served this request: the owner's self-hosted GPU
   * worker pool (`self-hosted`) or a paid hosted/external provider (`external`).
   * Lets the owner confirm the GPU is being used and credits are being saved.
   */
  backend: "self-hosted" | "external";
  latencyMs: number;
  costUsd: number;
};

// ─── Retry with exponential backoff ──────────────────────────────────────────
// Wraps a single provider call. Retries on transient failures only
// (network errors, 429, 5xx). Skips retry on 4xx auth/validation errors.
const TRANSIENT_RE = /\b(429|5\d\d|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|network|timeout)\b/i;
// Cap on how long we'll honor a provider's wait hint before giving up — long
// enough for a typical single-digit-second 429 throttle to clear, short enough
// that one request never hangs indefinitely.
const MAX_RETRY_AFTER_MS = 30_000;
// Extract a wait hint from a transient error: prefer a structured `retryAfterMs`
// (set by the Replicate client on 429s), then parse a `retry_after` / `Retry-After`
// value out of the message text for providers that only embed it there.
function retryAfterHintMs(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const v = (err as { retryAfterMs?: unknown }).retryAfterMs;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/retry[_-]?after"?\s*[:=]\s*"?(\d+(?:\.\d+)?)/i);
  if (m) {
    const secs = Number(m[1]);
    if (Number.isFinite(secs) && secs >= 0) return Math.round(secs * 1000);
  }
  return undefined;
}
async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (i === attempts || !TRANSIENT_RE.test(msg)) break;
      // Honor an explicit provider wait hint (e.g. a 429 Retry-After) when present,
      // capped at a sane max; otherwise fall back to the fixed exponential backoff.
      const hint = retryAfterHintMs(e);
      const backoff = 400 * Math.pow(2, i) + Math.floor(Math.random() * 200);
      const delay = hint !== undefined ? Math.min(hint, MAX_RETRY_AFTER_MS) : backoff;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

type ProviderAdapter = {
  name:
    | "lovable"
    | "gemini"
    | "replicate"
    | "byteplus"
    | "huggingface"
    | "sync"
    | "runpod"
    | "kling"
    | "piapi"
    | "heygen"
    | "fal"
    // free / general-router providers
    | "pollinations"
    | "runware"
    | "runway"
    | "elevenlabs"
    // keyed text providers
    | "groq"
    | "mistral"
    | "openai"
    | "gemini-text"
    | "lovable-text"
    | "hf-text";
  supports: (req: GenerateRequest) => boolean;
  estimateCost: (req: GenerateRequest) => number;
  run: (req: GenerateRequest) => Promise<{ url: string; endpoint: string; text?: string }>;
};

// ─── Kling direct (JWT signed) ───────────────────────────────────────────────
function klingJwt(accessKey: string, secretKey: string): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = enc({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload = enc({ iss: accessKey, exp: now + 1800, nbf: now - 5 });
  const data = `${header}.${payload}`;
  const crypto = require("crypto") as typeof import("crypto");
  const sig = crypto.createHmac("sha256", secretKey).update(data).digest("base64url");
  return `${data}.${sig}`;
}

const KLING_BASE = "https://api.klingai.com";
const klingDirect: ProviderAdapter = {
  name: "kling",
  // Only handle EXPLICIT Kling model requests — never hijack a Seedance/Veo/Sora
  // video request just because Kling creds happen to be set (would silently cost more).
  supports: (r) =>
    r.kind === "video" &&
    (r.model?.startsWith("kling") ?? false) &&
    !!process.env.KLING_ACCESS_KEY &&
    !!process.env.KLING_SECRET_KEY,
  estimateCost: () => 0.3,
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
    if (!create.ok)
      throw new Error(`Kling ${create.status}: ${(await create.text()).slice(0, 200)}`);
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
      if (status === "failed")
        throw new Error(`Kling failed: ${pj?.data?.task_status_msg ?? "unknown"}`);
    }
    throw new Error("Kling poll timeout");
  },
};

// ─── HeyGen (lipsync via video.translate; best-effort) ───────────────────────
const heygen: ProviderAdapter = {
  name: "heygen",
  supports: (r) => r.kind === "lipsync" && !!process.env.HEYGEN_API_KEY,
  estimateCost: () => 0.4,
  async run(r) {
    if (!r.videoUrl || !r.audioUrl) throw new Error("heygen: video+audio required");
    const key = process.env.HEYGEN_API_KEY!;
    const create = await fetch("https://api.heygen.com/v2/video/lipsync", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": key },
      body: JSON.stringify({ video_url: r.videoUrl, audio_url: r.audioUrl }),
    });
    if (!create.ok)
      throw new Error(`HeyGen ${create.status}: ${(await create.text()).slice(0, 200)}`);
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
  "fal-fallback/kling-video": {
    path: "fal-ai/kling-video/v1/standard/image-to-video",
    kind: "video",
    cost: 0.4,
  },
  "fal-fallback/sync-lipsync": { path: "fal-ai/sync-lipsync", kind: "lipsync", cost: 0.3 },
};
const falFallback: ProviderAdapter = {
  name: "fal",
  // Only activates when explicitly addressed OR when nothing else handles the kind
  supports: (r) => !!process.env.FAL_KEY,
  estimateCost: (r) => (r.kind === "video" ? 0.4 : r.kind === "lipsync" ? 0.3 : 0.005),
  async run(r) {
    const key = process.env.FAL_KEY!;
    const fallback =
      r.kind === "image"
        ? "fal-ai/flux/schnell"
        : r.kind === "video"
          ? "fal-ai/kling-video/v1/standard/image-to-video"
          : r.kind === "lipsync"
            ? "fal-ai/sync-lipsync"
            : null;
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
    const url = j?.video?.url ?? j?.image?.url ?? j?.images?.[0]?.url ?? j?.url ?? j?.output;
    if (!url || typeof url !== "string") throw new Error("Fal: no output url");
    return { url, endpoint: `fal:${path}` };
  },
};

// ─── Health tracking ─────────────────────────────────────────────────────────
const HEALTH = new Map<string, { failures: number; cooldownUntil: number }>();
// Exported for unit tests (see orchestrator.fallback.test.ts). Not part of the
// public API — callers should rely on orchestrate()/getProviderHealthSnapshot().
export function isHealthy(p: string) {
  const h = HEALTH.get(p);
  return !h || Date.now() > h.cooldownUntil;
}
export function markFailure(p: string) {
  const h = HEALTH.get(p) ?? { failures: 0, cooldownUntil: 0 };
  h.failures += 1;
  h.cooldownUntil = Date.now() + Math.min(120, 5 * Math.pow(3, h.failures - 1)) * 1000;
  HEALTH.set(p, h);
}
export function markSuccess(p: string) {
  HEALTH.set(p, { failures: 0, cooldownUntil: 0 });
}

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
    const endpoint =
      r.model && r.model.startsWith("google/") ? r.model : "google/gemini-2.5-flash-image";
    const content: Array<Record<string, unknown>> = [{ type: "text", text: r.prompt ?? "" }];
    for (const url of r.imageUrls ?? []) content.push({ type: "image_url", image_url: { url } });
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({
        model: endpoint,
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
      }),
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
      } catch {
        /* skip bad ref */
      }
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    const cParts = json?.candidates?.[0]?.content?.parts ?? [];
    const img = cParts.find((p: Record<string, unknown>) => p.inline_data || p.inlineData) as
      | {
          inline_data?: { data?: string; mime_type?: string };
          inlineData?: { data?: string; mimeType?: string };
        }
      | undefined;
    const inline = img?.inline_data ?? img?.inlineData;
    if (!inline?.data) throw new Error("Gemini returned no image");
    const mime =
      (inline as { mime_type?: string }).mime_type ||
      (inline as { mimeType?: string }).mimeType ||
      "image/png";
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
const durInt = (d?: number, max = 15) => Math.max(3, Math.min(max, d ?? 5));
const firstImg = (r: GenerateRequest) => r.imageUrls?.[0];

type ReplicateEntry = {
  slug: string;
  kind: GenerateKind;
  cost: number;
  build: (r: GenerateRequest) => Record<string, unknown>;
};

const REPLICATE_MAP: Record<string, ReplicateEntry> = {
  // ── images ──
  "google/nano-banana": {
    slug: "google/nano-banana",
    kind: "image",
    cost: 0.039,
    build: (r) => ({
      prompt: r.prompt ?? "",
      ...(r.imageUrls?.length ? { image_input: r.imageUrls } : {}),
    }),
  },
  "fal-ai/seedream-4": {
    slug: "bytedance/seedream-4",
    kind: "image",
    cost: 0.04,
    build: (r) => ({
      prompt: r.prompt ?? "",
      ...(r.imageUrls?.length ? { image_input: r.imageUrls } : {}),
    }),
  },
  "fal-ai/seedream-4.5": {
    slug: "bytedance/seedream-4",
    kind: "image",
    cost: 0.05,
    build: (r) => ({
      prompt: r.prompt ?? "",
      ...(r.imageUrls?.length ? { image_input: r.imageUrls } : {}),
    }),
  },
  "replicate/flux-schnell": {
    slug: "black-forest-labs/flux-schnell",
    kind: "image",
    cost: 0.003,
    build: (r) => ({ prompt: r.prompt ?? "" }),
  },
  // ── video (image-to-video) ──
  "seedance-2.0": {
    slug: "bytedance/seedance-1-pro",
    kind: "video",
    cost: 0.65,
    build: (r) => ({
      prompt: r.prompt ?? "",
      ...(firstImg(r) ? { image: firstImg(r) } : {}),
      duration: durInt(r.duration),
    }),
  },
  "seedance-2.0-fast": {
    slug: "bytedance/seedance-1-lite",
    kind: "video",
    cost: 0.05,
    build: (r) => ({
      prompt: r.prompt ?? "",
      ...(firstImg(r) ? { image: firstImg(r) } : {}),
      duration: durInt(r.duration),
    }),
  },
  "wan-2.5": {
    slug: "wan-video/wan-2.5-i2v",
    kind: "video",
    cost: 0.45,
    build: (r) => ({
      prompt: r.prompt ?? "",
      ...(firstImg(r) ? { image: firstImg(r) } : {}),
      duration: durEnum(r.duration),
    }),
  },
  "kling-3.0": {
    slug: "kwaivgi/kling-v2.1",
    kind: "video",
    cost: 0.6,
    build: (r) => ({
      prompt: r.prompt ?? "",
      ...(firstImg(r) ? { start_image: firstImg(r) } : {}),
      duration: durEnum(r.duration),
      ...(r.imageUrls?.[1] ? { end_image: r.imageUrls[1] } : {}),
    }),
  },
  "kling-3.0-omni": {
    slug: "kwaivgi/kling-v2.1-master",
    kind: "video",
    cost: 0.7,
    build: (r) => ({
      prompt: r.prompt ?? "",
      ...(firstImg(r) ? { start_image: firstImg(r) } : {}),
      duration: durEnum(r.duration),
      ...(r.imageUrls?.[1] ? { end_image: r.imageUrls[1] } : {}),
    }),
  },
  "veo-3-fast": {
    slug: "google/veo-3-fast",
    kind: "video",
    cost: 0.4,
    build: (r) => ({ prompt: r.prompt ?? "", ...(firstImg(r) ? { image: firstImg(r) } : {}) }),
  },
  "veo-3": {
    slug: "google/veo-3",
    kind: "video",
    cost: 0.75,
    build: (r) => ({ prompt: r.prompt ?? "", ...(firstImg(r) ? { image: firstImg(r) } : {}) }),
  },
  "sora-2": {
    slug: "openai/sora-2",
    kind: "video",
    cost: 0.5,
    build: (r) => ({
      prompt: r.prompt ?? "",
      ...(firstImg(r) ? { input_reference: firstImg(r) } : {}),
    }),
  },
  // ── lipsync (fallback after sync.so direct) ──
  "fal-ai/sync-lipsync/v2": {
    slug: "sync/lipsync-2",
    kind: "lipsync",
    cost: 0.3,
    build: (r) => ({ video: r.videoUrl, audio: r.audioUrl }),
  },
  "fal-ai/wav2lip": {
    slug: "devxpy/cog-wav2lip",
    kind: "lipsync",
    cost: 0.1,
    build: (r) => ({ face: r.videoUrl, audio: r.audioUrl }),
  },
  // ── caption burn ──
  // Converts the timed-segments array to SRT and submits to a Replicate
  // subtitle-burn model. Used as fallback when no self-hosted GPU worker
  // with "caption_burn" capability is online.
  "zsxkib/add-subtitles-to-video": {
    slug: "zsxkib/add-subtitles-to-video",
    kind: "caption_burn",
    cost: 0.02,
    build: (r) => {
      const toTs = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        const ms = Math.round((s % 1) * 1000);
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
      };
      const srt = (r.segments ?? [])
        .map((seg, i) => `${i + 1}\n${toTs(seg.start)} --> ${toTs(seg.end)}\n${seg.text}`)
        .join("\n\n");
      return {
        video: r.videoUrl,
        srt,
        font_size: 24,
        font_color: "white",
        border: true,
        border_color: "black",
      };
    },
  },
};

const replicate: ProviderAdapter = {
  name: "replicate",
  supports: (r) => {
    if (!getReplicateKey()) return false;
    if (!r.model) return false;
    const m = REPLICATE_MAP[r.model];
    return !!m && m.kind === r.kind;
  },
  estimateCost: (r) => (r.model && REPLICATE_MAP[r.model]?.cost) || 0.1,
  async run(r) {
    const m = r.model ? REPLICATE_MAP[r.model] : null;
    if (!m) throw new Error(`No Replicate mapping for model: ${r.model}`);
    const input = m.build(r);
    const result = await replicateRun(m.slug, input, 600_000);
    const url = pickReplicateUrl(result.output);
    return { url, endpoint: `replicate:${m.slug}` };
  },
};

// ─── ByteDance direct (BytePlus / Volcano ModelArk) ──────────────────────────
// Native provider for the Seed family. Maps our app model keys → the ModelArk
// model ID. IDs are region/account-specific and ByteDance rotates the dated
// suffix, so the whole table is overridable via a BYTEPLUS_MODEL_MAP JSON secret
// (value = model-id string, or a { modelId, kind } object) — a stale slug is
// fixed with a secret change, no code deploy. Defaults track the current
// published Seed models. Preferred over Replicate/fal for these models when a
// key is present; when it fails or the key is absent, the chain falls through to
// Replicate/fal (explicit fallback, never a silent one).
type BytePlusEntry = { modelId: string; kind: "image" | "video" };
const BYTEPLUS_DEFAULTS: Record<string, BytePlusEntry> = {
  "fal-ai/seedream-4": { modelId: "seedream-4-0-250828", kind: "image" },
  "fal-ai/seedream-4.5": { modelId: "seedream-4-0-250828", kind: "image" },
  "seedance-2.0": { modelId: "seedance-1-0-pro-250528", kind: "video" },
  "seedance-2.0-fast": { modelId: "seedance-1-0-lite-i2v-250428", kind: "video" },
};
const BYTEPLUS_MAP: Record<string, BytePlusEntry> = (() => {
  const out: Record<string, BytePlusEntry> = { ...BYTEPLUS_DEFAULTS };
  const raw = process.env.BYTEPLUS_MODEL_MAP;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string | Partial<BytePlusEntry>>;
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string") {
          const existing = out[k];
          if (existing) out[k] = { ...existing, modelId: v };
        } else if (
          v &&
          typeof v === "object" &&
          typeof v.modelId === "string" &&
          (v.kind === "image" || v.kind === "video")
        ) {
          out[k] = { modelId: v.modelId, kind: v.kind };
        }
      }
    } catch {
      // Malformed override → ignore and keep the published defaults.
    }
  }
  return out;
})();

const byteplus: ProviderAdapter = {
  name: "byteplus",
  supports: (r) => {
    if (!getBytePlusKey()) return false;
    if (r.kind !== "image" && r.kind !== "video") return false;
    if (!r.model) return false;
    const m = BYTEPLUS_MAP[r.model];
    return !!m && m.kind === r.kind;
  },
  // Bill the same provider cost as the Replicate route for the model so margins
  // and logs stay consistent; direct is typically cheaper, so this is a safe
  // upper bound.
  estimateCost: (r) =>
    (r.model && REPLICATE_MAP[r.model]?.cost) || (r.kind === "video" ? 0.3 : 0.03),
  async run(r) {
    const m = r.model ? BYTEPLUS_MAP[r.model] : null;
    if (!m) throw new Error(`No BytePlus mapping for model: ${r.model}`);
    if (m.kind === "image") {
      const url = await bytePlusImage({
        model: m.modelId,
        prompt: r.prompt ?? "",
        imageUrls: r.imageUrls,
      });
      return { url, endpoint: `byteplus:${m.modelId}` };
    }
    const url = await bytePlusVideo({
      model: m.modelId,
      prompt: r.prompt,
      imageUrls: r.imageUrls,
      duration: r.duration,
      resolution: r.resolution,
    });
    return { url, endpoint: `byteplus:${m.modelId}` };
  },
};

// ─── Sync.so direct ──────────────────────────────────────────────────────────
const sync: ProviderAdapter = {
  name: "sync",
  supports: (r) => r.kind === "lipsync" && !!process.env.SYNC_API_KEY,
  estimateCost: () => 0.25,
  async run(r) {
    if (!r.videoUrl || !r.audioUrl) throw new Error("sync: video+audio required");
    const url = await syncLipsync({
      videoUrl: r.videoUrl,
      audioUrl: r.audioUrl,
      model: "lipsync-2",
    });
    return { url, endpoint: "sync:lipsync-2" };
  },
};

// ─── PiAPI (aggregator: Midjourney, Kling, …) ────────────────────────────────
// Unified async task API: POST /api/v1/task → task_id, then poll
// GET /api/v1/task/{id} until completed/failed (same create-then-poll shape as
// the Kling/HeyGen adapters above). Docs: https://piapi.ai/docs
const PIAPI_BASE = "https://api.piapi.ai";
type PiapiModelEntry = {
  kind: GenerateKind;
  cost: number;
  build: (r: GenerateRequest) => {
    model: string;
    task_type: string;
    input: Record<string, unknown>;
  };
};
// Curated starter set — one image engine + one video engine. Add more PiAPI
// sub-models here AND give video models a tier in pricing.ts VIDEO_MODEL_TIERS.
const PIAPI_MAP: Record<string, PiapiModelEntry> = {
  "piapi/midjourney-imagine": {
    kind: "image",
    // Fast-mode imagine task ≈ $0.045; billed with a small buffer.
    cost: 0.05,
    build: (r) => ({
      model: "midjourney",
      task_type: "imagine",
      input: { prompt: r.prompt ?? "", process_mode: "fast", aspect_ratio: "1:1" },
    }),
  },
  "piapi/kling-video": {
    kind: "video",
    // Kling std 5s via PiAPI ≈ $0.16; upper bound covers 10s runs.
    cost: 0.3,
    build: (r) => {
      const input: Record<string, unknown> = {
        prompt: r.prompt ?? "",
        // Kling accepts 5 or 10 second durations only.
        duration: (r.duration ?? 5) > 5 ? 10 : 5,
        aspect_ratio: "16:9",
        mode: "std",
        version: "1.6",
      };
      if (r.imageUrls?.[0]) input.image_url = r.imageUrls[0];
      return { model: "kling", task_type: "video_generation", input };
    },
  },
};

// PiAPI output shape varies per engine: midjourney → image_url / image_urls[],
// kling → video_url or works[0].video.resource(_without_watermark).
function extractPiapiOutputUrl(output: unknown): string | undefined {
  if (!output || typeof output !== "object") return undefined;
  const o = output as Record<string, unknown>;
  for (const k of ["video_url", "image_url"]) {
    const v = o[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  const urls = o.image_urls;
  if (Array.isArray(urls) && typeof urls[0] === "string" && urls[0].length > 0) return urls[0];
  const works = o.works;
  if (Array.isArray(works) && works[0] && typeof works[0] === "object") {
    const video = (works[0] as Record<string, unknown>).video;
    if (video && typeof video === "object") {
      const v = video as Record<string, unknown>;
      for (const k of ["resource_without_watermark", "resource"]) {
        const u = v[k];
        if (typeof u === "string" && u.length > 0) return u;
      }
    }
  }
  return undefined;
}

const piapi: ProviderAdapter = {
  name: "piapi",
  // Only handle EXPLICIT piapi/* model requests — mirrors the Kling-direct rule
  // so a generic image/video request never silently routes (and bills) via PiAPI
  // just because the key happens to be set.
  supports: (r) => {
    if (!process.env.PIAPI_API_KEY) return false;
    if (!r.model) return false;
    const m = PIAPI_MAP[r.model];
    return !!m && m.kind === r.kind;
  },
  estimateCost: (r) => (r.model && PIAPI_MAP[r.model]?.cost) || (r.kind === "video" ? 0.3 : 0.05),
  async run(r) {
    const m = r.model ? PIAPI_MAP[r.model] : null;
    if (!m) throw new Error(`No PiAPI mapping for model: ${r.model}`);
    const key = process.env.PIAPI_API_KEY!;
    const body = m.build(r);
    const create = await fetch(`${PIAPI_BASE}/api/v1/task`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify(body),
    });
    if (!create.ok)
      throw new Error(`PiAPI ${create.status}: ${(await create.text()).slice(0, 200)}`);
    const cj = await create.json();
    // PiAPI wraps responses as { code, data, message }; a non-200 code with an
    // HTTP 200 is still a provider error — surface it explicitly.
    if (typeof cj?.code === "number" && cj.code !== 200)
      throw new Error(`PiAPI error ${cj.code}: ${String(cj?.message ?? "unknown").slice(0, 200)}`);
    const taskId = cj?.data?.task_id;
    if (!taskId) throw new Error("PiAPI returned no task_id");
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((s) => setTimeout(s, 6000));
      const poll = await fetch(`${PIAPI_BASE}/api/v1/task/${taskId}`, {
        headers: { "x-api-key": key },
      });
      if (!poll.ok) continue;
      const pj = await poll.json();
      const status = String(pj?.data?.status ?? "").toLowerCase();
      if (status === "completed" || status === "success" || status === "finished") {
        const url = extractPiapiOutputUrl(pj?.data?.output);
        if (!url) throw new Error("PiAPI: task completed but no output url");
        return { url, endpoint: `piapi:${body.model}/${body.task_type}` };
      }
      if (status === "failed") {
        const err = pj?.data?.error;
        const msg = err?.message || err?.raw_message || "unknown";
        throw new Error(`PiAPI failed: ${String(msg).slice(0, 200)}`);
      }
    }
    throw new Error("PiAPI poll timeout");
  },
};

// ─── Hugging Face ────────────────────────────────────────────────────────────
const HF_ENDPOINTS: Record<string, { endpoint: string; kind: GenerateKind; cost: number }> = {
  "hf/flux-schnell": { endpoint: "black-forest-labs/FLUX.1-schnell", kind: "image", cost: 0.003 },
  "hf/sdxl": { endpoint: "stabilityai/stable-diffusion-xl-base-1.0", kind: "image", cost: 0.004 },
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

// ─── Text generation (free-first chain) ──────────────────────────────────────
// A new `text` modality. Pollinations (no key, free) leads; keyed OpenAI-compatible
// providers Aurora may already hold credentials for follow, cheapest first. Each
// text model key maps to exactly one adapter, so model-level fallback walks the
// chain provider-by-provider.
type TextModelEntry = { adapter: ProviderAdapter["name"]; providerModel: string; cost: number };
const TEXT_MODELS: Record<string, TextModelEntry> = {
  "pollinations/openai": { adapter: "pollinations", providerModel: "openai", cost: 0 },
  "groq/llama-3.3-70b": { adapter: "groq", providerModel: "llama-3.3-70b-versatile", cost: 0.001 },
  "gemini/gemini-2.0-flash": {
    adapter: "gemini-text",
    providerModel: "gemini-2.0-flash",
    cost: 0.001,
  },
  "mistral/mistral-small": {
    adapter: "mistral",
    providerModel: "mistral-small-latest",
    cost: 0.001,
  },
  "openai/gpt-4o-mini": { adapter: "openai", providerModel: "gpt-4o-mini", cost: 0.002 },
  "hf/llama-3.1-8b": {
    adapter: "hf-text",
    providerModel: "meta-llama/Llama-3.1-8B-Instruct",
    cost: 0.001,
  },
  "lovable/gemini-2.5-flash": {
    adapter: "lovable-text",
    providerModel: "google/gemini-2.5-flash",
    cost: 0.002,
  },
};

/** POST an OpenAI-compatible /chat/completions request and return the message text. */
async function openAIChat(opts: {
  url: string;
  apiKey: string;
  model: string;
  prompt: string;
  authStyle: "bearer" | "lovable";
  imageUrls?: string[];
}): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.authStyle === "lovable") headers["Lovable-API-Key"] = opts.apiKey;
  else headers.Authorization = `Bearer ${opts.apiKey}`;
  // Vision: only switch to the multimodal content-array shape when trusted image
  // refs are supplied — text-only callers keep the plain-string content (no change).
  const imgs = (opts.imageUrls ?? []).filter(isTrustedUrl);
  const content =
    imgs.length > 0
      ? [
          { type: "text", text: opts.prompt },
          ...imgs.map((u) => ({ type: "image_url", image_url: { url: u } })),
        ]
      : opts.prompt;
  const res = await fetch(opts.url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: opts.model, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const text: unknown = j?.choices?.[0]?.message?.content;
  if (!text || typeof text !== "string") throw new Error("provider returned no text");
  return text;
}

/** Build a keyed OpenAI-compatible text adapter (groq/mistral/openai/hf/lovable). */
function makeTextAdapter(cfg: {
  name: ProviderAdapter["name"];
  envKey: string;
  url: string;
  authStyle: "bearer" | "lovable";
}): ProviderAdapter {
  return {
    name: cfg.name,
    supports: (r) =>
      r.kind === "text" &&
      !!process.env[cfg.envKey] &&
      (r.model ? TEXT_MODELS[r.model]?.adapter === cfg.name : false),
    estimateCost: (r) => (r.model ? TEXT_MODELS[r.model]?.cost : undefined) ?? 0.001,
    async run(r) {
      const m = r.model ? TEXT_MODELS[r.model] : null;
      if (!m) throw new Error(`No text model mapping for "${r.model}"`);
      const text = await openAIChat({
        url: cfg.url,
        apiKey: process.env[cfg.envKey]!,
        model: m.providerModel,
        prompt: r.prompt ?? "",
        authStyle: cfg.authStyle,
        imageUrls: r.imageUrls,
      });
      return { url: "", endpoint: `${cfg.name}:${m.providerModel}`, text };
    },
  };
}

const groqText = makeTextAdapter({
  name: "groq",
  envKey: "GROQ_API_KEY",
  url: "https://api.groq.com/openai/v1/chat/completions",
  authStyle: "bearer",
});
const mistralText = makeTextAdapter({
  name: "mistral",
  envKey: "MISTRAL_API_KEY",
  url: "https://api.mistral.ai/v1/chat/completions",
  authStyle: "bearer",
});
const openaiText = makeTextAdapter({
  name: "openai",
  envKey: "OPENAI_API_KEY",
  url: "https://api.openai.com/v1/chat/completions",
  authStyle: "bearer",
});
const hfText = makeTextAdapter({
  name: "hf-text",
  envKey: "HF_TOKEN",
  url: "https://router.huggingface.co/v1/chat/completions",
  authStyle: "bearer",
});
const lovableText = makeTextAdapter({
  name: "lovable-text",
  envKey: "LOVABLE_API_KEY",
  url: "https://ai.gateway.lovable.dev/v1/chat/completions",
  authStyle: "lovable",
});

// Gemini uses its own generateContent API (not OpenAI-compatible).
const geminiText: ProviderAdapter = {
  name: "gemini-text",
  supports: (r) =>
    r.kind === "text" &&
    !!process.env.GEMINI_API_KEY &&
    (r.model ? TEXT_MODELS[r.model]?.adapter === "gemini-text" : false),
  estimateCost: (r) => (r.model ? TEXT_MODELS[r.model]?.cost : undefined) ?? 0.001,
  async run(r) {
    const key = process.env.GEMINI_API_KEY!;
    const m = r.model ? TEXT_MODELS[r.model] : null;
    const model = m?.providerModel ?? "gemini-2.0-flash";
    // Vision: inline any trusted image refs so the model can analyze them.
    const parts: Array<Record<string, unknown>> = [{ text: r.prompt ?? "" }];
    for (const url of r.imageUrls ?? []) {
      if (!isTrustedUrl(url)) continue; // SSRF guard: skip untrusted ref hosts
      try {
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const mime = resp.headers.get("content-type") || "image/jpeg";
        const buf = Buffer.from(await resp.arrayBuffer());
        parts.push({ inline_data: { mime_type: mime, data: buf.toString("base64") } });
      } catch {
        /* skip unreachable ref */
      }
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] }),
      },
    );
    if (!res.ok) throw new Error(`Gemini text ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    const respParts: Array<{ text?: string }> = j?.candidates?.[0]?.content?.parts ?? [];
    const text = respParts
      .map((p) => p.text)
      .filter(Boolean)
      .join("");
    if (!text) throw new Error("Gemini text returned empty");
    return { url: "", endpoint: `gemini-text:${model}`, text };
  },
};

// ─── Free image providers ────────────────────────────────────────────────────
// Pollinations (no key) leads the image chain; Runware (keyed) is a cheap hosted
// alternative. Both upload the bytes to the studio bucket so results live where
// every other provider's results do.
type FreeImageEntry = { adapter: "pollinations" | "runware"; model: string; cost: number };
const FREE_IMAGE_MODELS: Record<string, FreeImageEntry> = {
  "pollinations/flux": { adapter: "pollinations", model: "flux", cost: 0 },
  "runware/flux-schnell": { adapter: "runware", model: "runware:100@1", cost: 0.0006 },
};

async function uploadBytesToStudio(
  userId: string | null | undefined,
  folder: string,
  bytes: Uint8Array,
  contentType: string,
  ext: string,
): Promise<string> {
  const path = `${userId ?? "system"}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from("studio")
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw new Error(`${folder} upload failed: ${error.message}`);
  const { data } = supabaseAdmin.storage.from("studio").getPublicUrl(path);
  return data.publicUrl;
}

const pollinations: ProviderAdapter = {
  name: "pollinations",
  supports: (r) => {
    if (r.kind === "text")
      return r.model ? TEXT_MODELS[r.model]?.adapter === "pollinations" : false;
    if (r.kind === "image")
      return r.model ? FREE_IMAGE_MODELS[r.model]?.adapter === "pollinations" : false;
    return false;
  },
  estimateCost: () => 0,
  async run(r) {
    if (r.kind === "text") {
      const m = r.model ? TEXT_MODELS[r.model] : null;
      const model = m?.providerModel ?? "openai";
      const res = await fetch(
        `https://text.pollinations.ai/${encodeURIComponent(r.prompt ?? "")}?model=${encodeURIComponent(model)}`,
      );
      if (!res.ok)
        throw new Error(`Pollinations text ${res.status}: ${(await res.text()).slice(0, 150)}`);
      const text = await res.text();
      if (!text) throw new Error("Pollinations returned empty text");
      return { url: "", endpoint: `pollinations:${model}`, text };
    }
    const m = r.model ? FREE_IMAGE_MODELS[r.model] : null;
    const model = m?.model ?? "flux";
    const u = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(r.prompt ?? "")}`);
    u.searchParams.set("width", "1024");
    u.searchParams.set("height", "1024");
    u.searchParams.set("model", model);
    u.searchParams.set("nologo", "true");
    const res = await fetch(u.toString());
    if (!res.ok)
      throw new Error(`Pollinations image ${res.status}: ${(await res.text()).slice(0, 150)}`);
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const bytes = new Uint8Array(await res.arrayBuffer());
    const url = await uploadBytesToStudio(
      r.userId,
      "pollinations",
      bytes,
      contentType,
      contentType.split("/")[1] || "jpg",
    );
    return { url, endpoint: `pollinations:${model}` };
  },
};

const runware: ProviderAdapter = {
  name: "runware",
  supports: (r) =>
    r.kind === "image" &&
    !!process.env.RUNWARE_API_KEY &&
    (r.model ? FREE_IMAGE_MODELS[r.model]?.adapter === "runware" : false),
  estimateCost: (r) => (r.model ? FREE_IMAGE_MODELS[r.model]?.cost : undefined) ?? 0.001,
  async run(r) {
    const key = process.env.RUNWARE_API_KEY!;
    const m = r.model ? FREE_IMAGE_MODELS[r.model] : null;
    const body = [
      {
        taskType: "imageInference",
        taskUUID: crypto.randomUUID(),
        positivePrompt: r.prompt ?? "",
        model: m?.model ?? "runware:100@1",
        width: 1024,
        height: 1024,
        numberResults: 1,
      },
    ];
    const res = await fetch("https://api.runware.ai/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Runware ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    const url: unknown = j?.data?.[0]?.imageURL ?? j?.data?.[0]?.imageUrl;
    if (!url || typeof url !== "string") throw new Error("Runware returned no image");
    return { url, endpoint: `runware:${m?.model ?? "runware:100@1"}` };
  },
};

// ─── Runway video (official REST, image-to-video) ────────────────────────────
const RUNWAY_MODELS: Record<string, { model: string; cost: number }> = {
  "runway/gen4-turbo": { model: "gen4_turbo", cost: 0.5 },
  "runway/gen3a-turbo": { model: "gen3a_turbo", cost: 0.4 },
};
const runway: ProviderAdapter = {
  name: "runway",
  supports: (r) =>
    r.kind === "video" &&
    !!process.env.RUNWAY_API_KEY &&
    (r.model ? !!RUNWAY_MODELS[r.model] : false),
  estimateCost: (r) => (r.model ? RUNWAY_MODELS[r.model]?.cost : undefined) ?? 0.5,
  async run(r) {
    const key = process.env.RUNWAY_API_KEY!;
    const m = r.model ? RUNWAY_MODELS[r.model] : null;
    const img = firstImg(r);
    if (!img) throw new Error("Runway requires a start image (image-to-video)");
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-Runway-Version": "2024-11-06",
    };
    const create = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: m?.model ?? "gen4_turbo",
        promptImage: img,
        promptText: r.prompt ?? "",
        duration: r.duration ?? 5,
        ratio: "1280:720",
      }),
    });
    if (!create.ok)
      throw new Error(`Runway ${create.status}: ${(await create.text()).slice(0, 200)}`);
    const cj = await create.json();
    const id = cj?.id;
    if (!id) throw new Error("Runway returned no task id");
    const deadline = Date.now() + 10 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((s) => setTimeout(s, 6000));
      const st = await fetch(`https://api.dev.runwayml.com/v1/tasks/${id}`, { headers });
      if (!st.ok) continue;
      const sj = await st.json();
      const status = sj?.status;
      if (status === "SUCCEEDED") {
        const url = Array.isArray(sj?.output) ? sj.output[0] : undefined;
        if (!url) throw new Error("Runway: no output url");
        return { url, endpoint: `runway:${m?.model ?? "gen4_turbo"}` };
      }
      if (status === "FAILED")
        throw new Error(
          `Runway failed: ${String(sj?.failure ?? sj?.failureCode ?? "unknown").slice(0, 200)}`,
        );
    }
    throw new Error("Runway poll timeout");
  },
};

// ─── ElevenLabs (TTS / audio) ────────────────────────────────────────────────
const elevenlabs: ProviderAdapter = {
  name: "elevenlabs",
  supports: (r) => r.kind === "audio" && !!process.env.ELEVENLABS_API_KEY,
  estimateCost: () => 0.01,
  async run(r) {
    const key = process.env.ELEVENLABS_API_KEY!;
    const voiceId =
      (typeof r.params?.voiceId === "string" && r.params.voiceId) || "21m00Tcm4TlvDq8ikWAM";
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": key },
      body: JSON.stringify({ text: r.prompt ?? "", model_id: "eleven_multilingual_v2" }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const url = await uploadBytesToStudio(r.userId, "tts", bytes, "audio/mpeg", "mp3");
    return { url, endpoint: `elevenlabs:${voiceId}` };
  },
};

// ─── GPU worker pool ─────────────────────────────────────────────────────────
// Admin-registered HTTP workers (RunPod / vast / salad / self-hosted). Each row
// declares the request contract it speaks via `protocol`:
//   custom  → POST {endpoint}/generate  with a flat body, returns { url } | { output_url }
//   vast    → same flat /generate contract as custom (a Vast.ai box runs your server)
//   runpod  → RunPod serverless: POST {endpoint}/run (async, poll GET /status/{id})
//             or POST {endpoint}/runsync (when runpod_sync), body wrapped as { input }
//   comfyui → POST {endpoint}/prompt with a ComfyUI graph, poll /history, /view the asset
//   hfspace → call the Space's Gradio predict fn over the /gradio_api SSE flow
// Routing stays capability-based; `protocol` only changes HOW a worker is called,
// so legacy /generate workers and the provider failover chain keep working.
const WORKER_TIMEOUT_MS = 300_000;
const RUNPOD_POLL_MS = 2_500;
const RUNPOD_DONE = "COMPLETED";
const RUNPOD_FAILED = new Set(["FAILED", "CANCELLED", "TIMED_OUT"]);

export type WorkerRow = {
  id: string;
  name: string;
  endpoint_url: string;
  auth_token: string | null;
  in_flight: number;
  max_concurrency: number;
  protocol: string;
  runpod_sync: boolean;
};

// Robustly pull an output URL out of whatever shape a worker returns: a bare
// string, an array, { url }/{ output_url }/{ image_url }/… , or nested under
// output/result/data/images/etc. (RunPod handlers wrap results under `output`).
export function extractWorkerUrl(payload: unknown, depth = 0): string | undefined {
  if (payload == null || depth > 6) return undefined;
  if (typeof payload === "string") return payload.startsWith("http") ? payload : undefined;
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const u = extractWorkerUrl(item, depth + 1);
      if (u) return u;
    }
    return undefined;
  }
  if (typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    for (const k of [
      "url",
      "output_url",
      "image_url",
      "video_url",
      "audio_url",
      "result_url",
      "signed_url",
      "delivery_url",
    ]) {
      const v = o[k];
      if (typeof v === "string" && v.startsWith("http")) return v;
    }
    for (const k of [
      "output",
      "result",
      "data",
      "response",
      "image",
      "video",
      "images",
      "videos",
      "outputs",
      "assets",
    ]) {
      if (k in o) {
        const u = extractWorkerUrl(o[k], depth + 1);
        if (u) return u;
      }
    }
  }
  return undefined;
}

const STALE_MS = 5 * 60_000; // 5 minutes

// Flat job params shared by both contracts (runpod wraps these under `input`).
function workerInput(r: GenerateRequest): Record<string, unknown> {
  return {
    kind: r.kind,
    prompt: r.prompt,
    image_urls: r.imageUrls,
    audio_url: r.audioUrl,
    video_url: r.videoUrl,
    model: r.model,
    duration: r.duration,
    resolution: r.resolution,
    ...(r.segments ? { segments: r.segments } : {}),
    ...(r.params ? { params: r.params } : {}),
    ...(r.comfyWorkflow ? { workflow: r.comfyWorkflow } : {}),
    ...(r.comfyInputs ? { workflow_inputs: r.comfyInputs } : {}),
  };
}

// custom contract: flat POST /generate (legacy behaviour, unchanged on the wire).
export async function dispatchCustom(
  base: string,
  w: WorkerRow,
  r: GenerateRequest,
  deadline: number,
): Promise<unknown> {
  const res = await fetch(`${base}/generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(w.auth_token ? { authorization: `Bearer ${w.auth_token}` } : {}),
    },
    body: JSON.stringify(workerInput(r)),
    signal: AbortSignal.timeout(Math.max(1_000, deadline - Date.now())),
  });
  if (!res.ok) throw new Error(`worker ${w.name} -> ${res.status}`);
  return res.json();
}

// runpod contract: { input } to /runsync (sync) or /run + poll /status/{id} (async).
export async function dispatchRunpod(
  base: string,
  w: WorkerRow,
  r: GenerateRequest,
  deadline: number,
): Promise<unknown> {
  const headers = {
    "content-type": "application/json",
    ...(w.auth_token ? { authorization: `Bearer ${w.auth_token}` } : {}),
  };
  const body = JSON.stringify({ input: workerInput(r) });
  if (w.runpod_sync) {
    const res = await fetch(`${base}/runsync`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(Math.max(1_000, deadline - Date.now())),
    });
    if (!res.ok) throw new Error(`worker ${w.name} /runsync -> ${res.status}`);
    const j = (await res.json()) as { status?: string; output?: unknown; error?: unknown };
    if (RUNPOD_FAILED.has((j.status ?? "").toUpperCase()))
      throw new Error(`worker ${w.name} ${j.status}: ${String(j.error ?? "").slice(0, 200)}`);
    return j.output ?? j;
  }
  const submit = await fetch(`${base}/run`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(Math.min(30_000, Math.max(1_000, deadline - Date.now()))),
  });
  if (!submit.ok) throw new Error(`worker ${w.name} /run -> ${submit.status}`);
  const sj = (await submit.json()) as { id?: string; status?: string; output?: unknown };
  if ((sj.status ?? "").toUpperCase() === RUNPOD_DONE && sj.output !== undefined) return sj.output;
  const jobId = sj.id;
  if (!jobId) throw new Error(`worker ${w.name} /run returned no job id`);
  while (Date.now() < deadline) {
    await new Promise((s) =>
      setTimeout(s, Math.min(RUNPOD_POLL_MS, Math.max(0, deadline - Date.now()))),
    );
    if (Date.now() >= deadline) break;
    let pj: { status?: string; output?: unknown; error?: unknown };
    try {
      const st = await fetch(`${base}/status/${encodeURIComponent(jobId)}`, {
        headers,
        signal: AbortSignal.timeout(Math.min(15_000, Math.max(1_000, deadline - Date.now()))),
      });
      if (!st.ok) continue;
      pj = (await st.json()) as { status?: string; output?: unknown; error?: unknown };
    } catch {
      continue; // transient network/timeout polling status → keep polling the same job (don't resubmit)
    }
    const status = (pj.status ?? "").toUpperCase();
    if (status === RUNPOD_DONE) return pj.output ?? pj;
    if (RUNPOD_FAILED.has(status))
      throw new Error(`worker ${w.name} ${status}: ${String(pj.error ?? "").slice(0, 200)}`);
    // IN_QUEUE / IN_PROGRESS → keep polling until the deadline.
  }
  throw new Error(`worker ${w.name} runpod poll timeout`);
}

// Legacy custom workers may return a relative or non-http string in url/output_url;
// preserve that exact behaviour rather than tightening it with extractWorkerUrl.
export function legacyCustomUrl(payload: unknown): string | undefined {
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    const v = o.url ?? o.output_url;
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

// Map a GenerateRequest onto the generalized inference job consumed by the shared
// protocol helpers (Gradio / ComfyUI). `upscale` maps to the `image` task.
function toInferenceInput(r: GenerateRequest): InferenceInput {
  const task: TaskType =
    r.kind === "upscale"
      ? "image"
      : r.kind === "audio"
        ? "tts"
        : r.kind === "text"
          ? "image" /* never reached: text never dispatches to a GPU worker */
          : r.kind;
  return {
    task,
    prompt: r.prompt,
    imageUrls: r.imageUrls,
    audioUrl: r.audioUrl,
    videoUrl: r.videoUrl,
    params: r.params,
    comfyWorkflow: r.comfyWorkflow,
    comfyInputs: r.comfyInputs,
  };
}

// comfyui contract: submit a ComfyUI graph, poll /history, resolve a /view URL.
// A request that already carries `comfyWorkflow` (lipsync/motion, wired by their
// builders) uses it verbatim. Otherwise — the free-GPU swarm case for plain
// image/video requests — we build a default graph by kind so a ComfyUI worker can
// serve them. Kinds with no default (upscale/text/audio, or lipsync/motion missing
// their media) fail explicitly: no silent fallback.
export async function dispatchComfyui(
  base: string,
  w: WorkerRow,
  r: GenerateRequest,
  deadline: number,
): Promise<unknown> {
  let workflow = r.comfyWorkflow;
  let inputs = r.comfyInputs;
  if (!workflow) {
    const def = buildDefaultComfyWorkflow(r);
    if (!def)
      throw new Error(
        `worker ${w.name}: comfyui protocol requires a workflow (no default graph for kind ${r.kind})`,
      );
    workflow = def.comfyWorkflow;
    // Request-supplied comfyInputs win over the defaults so callers can override.
    inputs = { ...def.comfyInputs, ...(r.comfyInputs ?? {}) };
  }
  const url = await runComfyWorkflow({
    baseUrl: base,
    token: w.auth_token ?? undefined,
    workflow,
    inputs,
    deadline,
  });
  return { url };
}

// hfspace contract: call the Space's Gradio `predict` fn over the SSE flow.
export async function dispatchHfspace(
  base: string,
  w: WorkerRow,
  r: GenerateRequest,
  deadline: number,
): Promise<unknown> {
  const result = await callGradioSpace(
    base,
    "predict",
    w.auth_token ?? undefined,
    gradioData(toInferenceInput(r)),
    deadline,
  );
  const url = extractGradioUrl(result, base);
  return url ? { url } : result;
}

// A GPU worker advertises capabilities by kind, except TTS audio which workers
// declare as the `tts` capability (matching the inference-layer TaskType).
function workerCapability(kind: GenerateKind): string {
  return kind === "audio" ? "tts" : kind;
}

const gpuWorker: ProviderAdapter = {
  name: "runpod",
  supports: (r) =>
    ["image", "video", "lipsync", "upscale", "motion", "audio", "assemble", "caption_burn", "autocut"].includes(r.kind),
  estimateCost: (r) => (r.kind === "video" || r.kind === "motion" ? 0.05 : 0.01),
  async run(r) {
    const { data: workers } = await supabaseAdmin
      .from("gpu_workers")
      .select("*")
      .eq("status", "active")
      .contains("capabilities", [workerCapability(r.kind)])
      .order("priority", { ascending: true })
      .order("in_flight", { ascending: true })
      .limit(10);
    if (!workers || workers.length === 0) throw new Error("No GPU workers available");
    const now = Date.now();
    let lastErr: Error | null = null;
    for (const w of workers) {
      if (w.in_flight >= w.max_concurrency) continue;
      // Lazy heartbeat staleness check: skip workers that haven't been pinged recently.
      if (w.last_heartbeat && now - new Date(w.last_heartbeat).getTime() > STALE_MS) continue;
      const started = Date.now();
      let incremented = false;
      try {
        await supabaseAdmin.rpc("gpu_worker_inflight_inc", { _worker: w.id });
        incremented = true;
        const base = normalizeWorkerBase(w.endpoint_url);
        const deadline = started + WORKER_TIMEOUT_MS;
        const payload =
          w.protocol === "runpod"
            ? await dispatchRunpod(base, w, r, deadline)
            : w.protocol === "comfyui"
              ? await dispatchComfyui(base, w, r, deadline)
              : w.protocol === "hfspace"
                ? await dispatchHfspace(base, w, r, deadline)
                : await dispatchCustom(base, w, r, deadline);
        // custom & vast workers may return a relative/non-http url; preserve it.
        const isCustomLike =
          w.protocol !== "runpod" && w.protocol !== "comfyui" && w.protocol !== "hfspace";
        const url =
          extractWorkerUrl(payload) ?? (isCustomLike ? legacyCustomUrl(payload) : undefined);
        if (!url) throw new Error(`worker ${w.name} returned no url`);
        await supabaseAdmin.from("worker_jobs").insert({
          worker_id: w.id,
          user_id: r.userId ?? null,
          kind: r.kind,
          status: "ok",
          latency_ms: Date.now() - started,
          ref_id: r.refId ?? null,
        });
        return { url, endpoint: `gpu:${w.name}` };
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        await supabaseAdmin.from("worker_jobs").insert({
          worker_id: w.id,
          user_id: r.userId ?? null,
          kind: r.kind,
          status: "error",
          latency_ms: Date.now() - started,
          error: lastErr.message.slice(0, 500),
        });
      } finally {
        if (incremented) {
          await supabaseAdmin.rpc("gpu_worker_inflight_dec", { _worker: w.id });
        }
      }
    }
    throw lastErr ?? new Error("All GPU workers failed");
  },
};

// ─── Priority chain per kind ─────────────────────────────────────────────────
// GPU-FIRST across every modality: the self-hosted gpuWorker pool is always tried
// first. When no eligible worker is up (offline, stale heartbeat, at capacity,
// missing the capability) the adapter throws a "GPU unavailable" signal that
// orchestrate() treats as a clean skip — the request falls straight through to
// the external chain below. This means a running GPU always saves credits, and
// the external providers act purely as high-availability fallbacks.
const PRIORITY: Record<GenerateKind, ProviderAdapter[]> = {
  image: [
    gpuWorker,
    byteplus,
    pollinations,
    geminiDirect,
    huggingface,
    runware,
    replicate,
    piapi,
    lovable,
    falFallback,
  ],
  video: [gpuWorker, klingDirect, byteplus, replicate, runway, piapi, falFallback],
  lipsync: [gpuWorker, sync, heygen, replicate, falFallback],
  // GPU-first: a worker advertising "upscale" is tried before Replicate.
  upscale: [gpuWorker, replicate, falFallback],
  // Motion transfer (MimicMotion) has no hosted provider — GPU/ComfyUI workers only.
  motion: [gpuWorker],
  // GPU-first: a worker advertising "text" (local LLM) is tried first.
  text: [gpuWorker, pollinations, groqText, geminiText, mistralText, hfText, openaiText, lovableText],
  // GPU-first: a worker advertising "audio" (local TTS) is tried before ElevenLabs.
  audio: [gpuWorker, elevenlabs],
  // Final assembly (ffmpeg): self-hosted GPU worker pool only — no hosted provider.
  assemble: [gpuWorker],
  // Caption burn: self-hosted GPU worker preferred (FFmpeg drawtext, fastest).
  // Falls back to Replicate subtitle-burn model when no capable worker is online.
  caption_burn: [gpuWorker, replicate],
  // AutoCut: self-hosted FFmpeg assembler ONLY. A true multi-clip edit (concat +
  // beat-synced style/music) has no hosted equivalent, so there is no provider
  // fallback — runAutocut fails explicitly and refunds when no worker is online.
  autocut: [gpuWorker],
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
    "google/gemini-2.5-flash-image": { provider: "lovable", kind: "image", cost: 0.002 },
    "google/gemini-3.1-flash-image-preview": { provider: "lovable", kind: "image", cost: 0.002 },
    "google/gemini-3-pro-image-preview": { provider: "lovable", kind: "image", cost: 0.01 },
    // Kling direct (JWT)
    "kling-v1": { provider: "kling", kind: "video", cost: 0.3 },
    // HeyGen lipsync
    "heygen/lipsync": { provider: "heygen", kind: "lipsync", cost: 0.4 },
    // Sync.so direct lipsync
    "sync/lipsync-2": { provider: "sync", kind: "lipsync", cost: 0.25 },
    // Self-hosted LatentSync — runs on the registered GPU worker pool only.
    latentsync: { provider: gpuWorker.name, kind: "lipsync", cost: 0.01 },
    // Runway video (official REST, image-to-video)
    "runway/gen4-turbo": { provider: "runway", kind: "video", cost: 0.5 },
    "runway/gen3a-turbo": { provider: "runway", kind: "video", cost: 0.4 },
    // ElevenLabs TTS (sentinel — adapter ignores the model key, picks voice via params)
    "elevenlabs/tts": { provider: "elevenlabs", kind: "audio", cost: 0.01 },
    // Self-hosted ffmpeg final assembly (kids story). Sentinel model so the
    // candidate loop runs; routed self-hosted-only to the GPU worker pool.
    "ffmpeg-assemble": { provider: gpuWorker.name, kind: "assemble", cost: 0.005 },
    "ffmpeg-captionburn": { provider: gpuWorker.name, kind: "caption_burn", cost: 0.005 },
    "zsxkib/add-subtitles-to-video": { provider: "replicate", kind: "caption_burn", cost: 0.02 },
  };
  for (const [k, v] of Object.entries(REPLICATE_MAP))
    out[k] = { provider: "replicate", kind: v.kind, cost: v.cost };
  for (const [k, v] of Object.entries(HF_ENDPOINTS))
    out[k] = { provider: "huggingface", kind: v.kind, cost: v.cost };
  for (const [k, v] of Object.entries(FAL_MAP))
    out[k] = { provider: "fal", kind: v.kind, cost: v.cost };
  for (const [k, v] of Object.entries(PIAPI_MAP))
    out[k] = { provider: "piapi", kind: v.kind, cost: v.cost };
  for (const [k, v] of Object.entries(FREE_IMAGE_MODELS))
    out[k] = { provider: v.adapter, kind: "image", cost: v.cost };
  for (const [k, v] of Object.entries(TEXT_MODELS))
    out[k] = { provider: v.adapter, kind: "text", cost: v.cost };
  return out;
})();

export function resolveModel(modelKey: string | undefined | null): ModelEntry | null {
  if (!modelKey) return null;
  return MODEL_REGISTRY[modelKey] ?? null;
}

// Preflight: is there at least one active GPU worker that advertises this kind?
// Used by motion/reskin server fns + MCP tools to fail fast with a friendly
// "no backend configured" message BEFORE reserving any credits.
export async function hasActiveWorkerForKind(kind: GenerateKind): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("gpu_workers")
    .select("in_flight, max_concurrency, last_heartbeat")
    .eq("status", "active")
    .contains("capabilities", [workerCapability(kind)])
    // Same ordering as gpuWorker.run (lowest priority, then least-loaded first) so
    // the limited slice surfaces the workers most likely to be dispatch-eligible.
    .order("priority", { ascending: true })
    .order("in_flight", { ascending: true })
    .limit(20);
  if (error || !data) return false;
  // Mirror gpuWorker.run dispatch eligibility EXACTLY so this preflight predicts a
  // real dispatch: a worker must have free capacity AND a non-stale heartbeat (a
  // NULL heartbeat counts as fresh, same as dispatch) to actually accept the job.
  // Checking only status+capability lets a saturated or dead-but-"active" worker
  // pass, which would burn the whole kids pipeline only to die at the final stitch.
  const now = Date.now();
  return data.some((w) => {
    if (w.in_flight >= w.max_concurrency) return false;
    if (w.last_heartbeat && now - new Date(w.last_heartbeat).getTime() > STALE_MS) return false;
    return true;
  });
}

async function log(opts: {
  provider: string;
  endpoint: string;
  kind: GenerateKind;
  status: "ok" | "error";
  latencyMs: number;
  costUsd: number;
  error?: string;
  userId?: string | null;
  refId?: string | null;
}) {
  try {
    await supabaseAdmin.from("provider_logs").insert({
      provider: opts.provider,
      endpoint: opts.endpoint,
      kind: opts.kind,
      status: opts.status,
      latency_ms: opts.latencyMs,
      cost_usd: opts.costUsd,
      error: opts.error ?? null,
      user_id: opts.userId ?? null,
      ref_id: opts.refId ?? null,
    });
  } catch {
    /* no-op */
  }
}

// ─── Model-level fallback ────────────────────────────────────────────────────
// On top of provider fallback: if the requested model's providers all fail, try
// a bounded, cheapest-first list of alternate same-kind models (all reachable on
// the Replicate key). Capped so paid video generations never run away on cost.
const FALLBACK_MODELS: Record<GenerateKind, string[]> = {
  image: ["pollinations/flux", "google/nano-banana", "replicate/flux-schnell", "fal-ai/seedream-4"],
  video: ["seedance-2.0-fast", "seedance-2.0", "wan-2.5", "kling-3.0", "veo-3-fast", "sora-2"],
  lipsync: ["fal-ai/sync-lipsync/v2", "fal-ai/wav2lip"],
  upscale: [],
  motion: [],
  // Free Pollinations first, then keyed text providers cheapest-first.
  text: [
    "pollinations/openai",
    "groq/llama-3.3-70b",
    "gemini/gemini-2.0-flash",
    "lovable/gemini-2.5-flash",
  ],
  // Sentinel so the candidate loop runs; both audio adapters ignore the model key.
  audio: ["elevenlabs/tts"],
  // Assembly pins to its self-hosted sentinel model (selfHostedOnly) — no fallback.
  assemble: [],
  // Caption burn: GPU worker first (FFmpeg drawtext), Replicate fallback.
  caption_burn: ["ffmpeg-captionburn", "zsxkib/add-subtitles-to-video"],
  // AutoCut: no hosted fallback — a true multi-clip edit only runs on the
  // self-hosted FFmpeg assembler. autocut is never routed through orchestrate()
  // directly (runAutocut dispatches kind "assemble"), so this stays empty.
  autocut: [],
};
const FALLBACK_CAP: Record<GenerateKind, number> = {
  image: 4,
  video: 2,
  lipsync: 2,
  upscale: 1,
  motion: 1,
  text: 4,
  audio: 1,
  assemble: 1,
  caption_burn: 2,
  autocut: 1,
};

export function getCandidateModels(req: GenerateRequest): string[] {
  // Self-hosted requests pin to the single requested model — no cross-model
  // fallback (the worker pool serves the kind, not a specific hosted model).
  if (req.selfHostedOnly) return req.model ? [req.model] : [];
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
const PROVIDER_DOWN_RE =
  /\b(429|5\d\d|402)\b|timeout|timed out|econnreset|econnrefused|etimedout|fetch failed|socket hang up|capacity|temporarily unavailable|rate limit/i;

// The self-hosted GPU pool raises these exact messages when it has no eligible
// worker to serve a request (none online with the capability, or all at capacity /
// stale heartbeat). They mean "fall back to the external chain" — NOT "the backend
// failed" — so orchestrate() skips them silently: no error log, no cooldown. This
// keeps the owner's dashboard from filling with phantom "GPU down" rows whenever
// their Colab/Kaggle session is simply offline. Genuine GPU dispatch errors
// (timeouts, bad URLs, HTTP 5xx) do NOT match here and are handled normally.
const GPU_UNAVAILABLE_RE = /^(No GPU workers available|All GPU workers failed)$/;

// ─── Free GPU only mode ──────────────────────────────────────────────────────
// When the global "Free GPU only" safety flag is ON, image/video/lip-sync/motion
// (and any other modality) may run ONLY on the self-hosted GPU pool plus
// genuinely free ($0) hosted providers (e.g. Pollinations). Every paid external
// adapter (Replicate, Kling, HeyGen, Fal, Runway, Lovable gateway, ElevenLabs, …)
// is filtered out at provider selection, so it is never reached and can never
// bill. The single source of truth for "free" is the adapter's own estimateCost:
// the GPU pool is always allowed (owner's own hardware) and any adapter that
// estimates $0 for the request is allowed; everything else is paid → skipped.
export const FREE_MODE_NO_WORKER_MSG =
  "Your free GPU isn't running right now — start your Colab/Kaggle worker and try again. (Free GPU only mode is on, so paid providers are disabled.)";

function isFreeAdapter(a: ProviderAdapter, r: GenerateRequest): boolean {
  // The self-hosted pool runs on the owner's own hardware — always free of
  // external billing — and a $0 estimate marks a genuinely free hosted provider.
  return a === gpuWorker || a.estimateCost(r) === 0;
}

/**
 * Preflight for "Free GPU only" mode, run by server fns BEFORE reserving credits.
 * No-op when the flag is off. When on, it throws the friendly "start your GPU"
 * message if there is no free way to serve this kind — i.e. no $0 hosted provider
 * exists for the kind AND no eligible self-hosted worker is online — so we never
 * charge credits for a request that can only fail.
 */
export async function assertFreeModeServable(kind: GenerateKind): Promise<void> {
  if (!(await isFreeGpuOnlyMode())) return;
  // A zero-cost hosted provider (e.g. Pollinations for image/text) can always
  // serve this kind for free, so the request is servable regardless of the pool.
  const probe = { kind } as GenerateRequest;
  const hasFreeHosted = PRIORITY[kind].some((a) => a !== gpuWorker && a.estimateCost(probe) === 0);
  if (hasFreeHosted) return;
  // Otherwise the only free path is the self-hosted GPU pool — require one online.
  if (await hasActiveWorkerForKind(kind)) return;
  throw new Error(FREE_MODE_NO_WORKER_MSG);
}

export async function orchestrate(rawReq: GenerateRequest): Promise<GenerateResult> {
  // Sign private-studio refs once, up front, so every adapter sees a fetchable URL.
  const req = await signStudioRefs(rawReq);
  // Global safety mode: when ON, restrict EVERY request to the free pool + $0
  // providers. selfHostedOnly requests are already pool-only, so the extra read
  // is skipped for them.
  const freeOnly = req.selfHostedOnly ? false : await isFreeGpuOnlyMode();
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
    let adapters = PRIORITY[r.kind].filter((a) => a.supports(r) && healthyAtStart.has(a.name));
    // Self-hosted requests run ONLY on the GPU worker pool — never a hosted API.
    if (req.selfHostedOnly) adapters = adapters.filter((a) => a === gpuWorker);
    // Free GPU only mode: drop every paid adapter so it is never reached. Only the
    // self-hosted pool and $0 providers survive — no paid API can ever bill.
    else if (freeOnly) adapters = adapters.filter((a) => isFreeAdapter(a, r));
    if (adapters.length === 0) continue;

    for (const adapter of adapters) {
      triedAny = true;
      const start = Date.now();
      try {
        const { url, endpoint, text } = await withRetry(() => adapter.run(r), 2);
        const latency = Date.now() - start;
        const cost = adapter.estimateCost(r);
        // The self-hosted GPU pool is the only adapter that runs on the owner's
        // own hardware; everything else is a paid hosted/external provider.
        const backend: GenerateResult["backend"] =
          adapter === gpuWorker ? "self-hosted" : "external";
        markSuccess(adapter.name);
        await log({
          provider: adapter.name,
          endpoint,
          kind: r.kind,
          status: "ok",
          latencyMs: latency,
          costUsd: cost,
          userId: r.userId,
          refId: r.refId,
        });
        // Make the served-by backend obvious in the workflow/deploy logs so the
        // owner can confirm the GPU is being used and external credits are saved.
        console.info(
          `[orchestrator] ${r.kind} served by ${
            backend === "self-hosted"
              ? `self-hosted GPU (${endpoint})`
              : `external provider ${adapter.name} (${endpoint})`
          }`,
        );
        return {
          url,
          provider: adapter.name,
          endpoint,
          backend,
          latencyMs: latency,
          costUsd: cost,
          text,
        };
      } catch (e) {
        const latency = Date.now() - start;
        const msg = e instanceof Error ? e.message : String(e);
        lastErr = e instanceof Error ? e : new Error(msg);
        // The self-hosted GPU pool simply having no eligible worker is the normal
        // cue to fall back, not a provider failure — skip it silently (no error
        // log, no cooldown) so the dashboard isn't flooded while Colab is offline.
        if (adapter === gpuWorker && GPU_UNAVAILABLE_RE.test(msg)) continue;
        // Only back a provider off for genuine provider-down/quota signals, so a
        // single bad model never blacklists a healthy provider for other requests.
        if (PROVIDER_DOWN_RE.test(msg)) markFailure(adapter.name);
        await log({
          provider: adapter.name,
          endpoint: modelKey,
          kind: r.kind,
          status: "error",
          latencyMs: latency,
          costUsd: 0,
          error: msg.slice(0, 500),
          userId: r.userId,
          refId: r.refId,
        });
        if (FATAL_RE.test(msg)) throw lastErr; // bad request — every model fails the same
      }
    }
  }

  // Free GPU only mode: the only thing that could have run was the self-hosted
  // pool (and $0 providers). If nothing ran, or the only failure was the pool
  // having no eligible worker, surface the friendly "start your GPU" message —
  // never a confusing "no provider" dump that hints at a missing paid key.
  if (freeOnly && (!triedAny || (lastErr && GPU_UNAVAILABLE_RE.test(lastErr.message)))) {
    throw new Error(FREE_MODE_NO_WORKER_MSG);
  }

  if (!triedAny) {
    const all = PRIORITY[req.kind];
    const reasons = all
      .map((a) => {
        if (!a.supports(req))
          return `${a.name}: missing config/key for model "${req.model ?? "?"}"`;
        if (!isHealthy(a.name)) return `${a.name}: cooling down after recent failure`;
        return `${a.name}: ok`;
      })
      .join("; ");
    throw new Error(`No provider available for ${req.kind} → ${reasons}`);
  }
  throw lastErr ?? new Error("All providers failed");
}
