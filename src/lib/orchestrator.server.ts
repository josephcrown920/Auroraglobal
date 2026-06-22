// Aurora Orchestration Layer (server-only)
// Providers:
//   - lovable     → Lovable AI Gateway (Gemini image/text)
//   - replicate   → Replicate via Lovable connector gateway (Seedream, Seedance, Kling, Flux, Wav2Lip)
//   - huggingface → HF Inference (flux-schnell, sdxl)
//   - sync        → Sync.so direct API (lipsync)
//   - gpuWorker   → admin-registered HTTP workers (RunPod / vast / salad / self-hosted)

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { replicateRun, pickReplicateUrl, getReplicateKey } from "./replicate.server";
import { syncLipsync } from "./sync.server";
import { hfTextToImage } from "./hf.server";
import { isTrustedUrl } from "./url-guard";

export type GenerateKind = "image" | "video" | "lipsync" | "upscale";

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
  name: "lovable" | "gemini" | "replicate" | "huggingface" | "sync" | "runpod" | "kling" | "heygen" | "fal";
  supports: (req: GenerateRequest) => boolean;
  estimateCost: (req: GenerateRequest) => number;
  run: (req: GenerateRequest) => Promise<{ url: string; endpoint: string }>;
};

// ─── Kling direct (JWT signed) ───────────────────────────────────────────────
function klingJwt(accessKey: string, secretKey: string): string {
  const enc = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
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
  supports: (r) => r.kind === "video" && !!process.env.KLING_ACCESS_KEY && !!process.env.KLING_SECRET_KEY,
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
// Map our model keys → Replicate official model slugs (owner/name).
const REPLICATE_MAP: Record<string, { slug: string; kind: GenerateKind; cost: number }> = {
  // images
  "fal-ai/seedream-4":      { slug: "bytedance/seedream-4",        kind: "image", cost: 0.04 },
  "fal-ai/seedream-4.5":    { slug: "bytedance/seedream-4",        kind: "image", cost: 0.05 },
  "replicate/flux-schnell": { slug: "black-forest-labs/flux-schnell", kind: "image", cost: 0.003 },
  // video (image-to-video)
  "seedance-2.0":           { slug: "bytedance/seedance-1-pro",    kind: "video", cost: 0.40 },
  "seedance-2.0-fast":      { slug: "bytedance/seedance-1-lite",   kind: "video", cost: 0.20 },
  "kling-3.0":              { slug: "kwaivgi/kling-v2.1",          kind: "video", cost: 0.60 },
  "kling-3.0-omni":         { slug: "kwaivgi/kling-v2.1-master",   kind: "video", cost: 0.70 },
  // lipsync (fallback after sync.so direct)
  "fal-ai/sync-lipsync/v2": { slug: "sync/sync-1.6.0",             kind: "lipsync", cost: 0.30 },
  "fal-ai/wav2lip":         { slug: "cudanexus/wav2lip",           kind: "lipsync", cost: 0.10 },
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

    const input: Record<string, unknown> = {};
    if (r.prompt) input.prompt = r.prompt;

    if (m.kind === "image") {
      // Seedream-4 takes image_input (array). Flux-schnell takes only prompt.
      if (m.slug.startsWith("bytedance/seedream") && r.imageUrls?.length) {
        input.image_input = r.imageUrls;
      }
    } else if (m.kind === "video") {
      if (r.imageUrls?.[0]) {
        if (m.slug.startsWith("bytedance/seedance")) input.image = r.imageUrls[0];
        else input.start_image = r.imageUrls[0]; // kling
      }
      if (r.duration) input.duration = r.duration;
      if (m.slug.startsWith("kwaivgi/kling")) {
        input.mode = "standard";
        input.aspect_ratio = "16:9";
      }
    } else if (m.kind === "lipsync") {
      input.video = r.videoUrl;
      input.audio = r.audioUrl;
    }

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
const gpuWorker: ProviderAdapter = {
  name: "runpod",
  supports: (r) => ["image", "video", "lipsync", "upscale"].includes(r.kind),
  estimateCost: (r) => (r.kind === "video" ? 0.05 : 0.01),
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
        const url = json.url ?? json.output_url;
        if (!url) throw new Error(`worker ${w.name} returned no url`);
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
  video:   [klingDirect, replicate, gpuWorker, falFallback],
  lipsync: [sync, heygen, replicate, gpuWorker, falFallback],
  upscale: [replicate, gpuWorker, falFallback],
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
  };
  for (const [k, v] of Object.entries(REPLICATE_MAP))
    out[k] = { provider: "replicate", kind: v.kind, cost: v.cost };
  for (const [k, v] of Object.entries(HF_ENDPOINTS))
    out[k] = { provider: "huggingface", kind: v.kind, cost: v.cost };
  for (const [k, v] of Object.entries(FAL_MAP))
    out[k] = { provider: "fal", kind: v.kind, cost: v.cost };
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

export async function orchestrate(rawReq: GenerateRequest): Promise<GenerateResult> {
  // Sign private-studio refs once, up front, so every adapter sees a fetchable URL.
  const req = await signStudioRefs(rawReq);
  const all = PRIORITY[req.kind];
  const adapters = all.filter((a) => a.supports(req) && isHealthy(a.name));
  if (adapters.length === 0) {
    const reasons = all.map((a) => {
      if (!a.supports(req)) return `${a.name}: missing config/key for model "${req.model ?? "?"}"`;
      if (!isHealthy(a.name)) return `${a.name}: cooling down after recent failure`;
      return `${a.name}: ok`;
    }).join("; ");
    throw new Error(`No provider available for ${req.kind} → ${reasons}`);
  }
  let lastErr: Error | null = null;
  for (const adapter of adapters) {
    const start = Date.now();
    try {
      const { url, endpoint } = await withRetry(() => adapter.run(req), 2);
      const latency = Date.now() - start;
      const cost = adapter.estimateCost(req);
      markSuccess(adapter.name);
      await log({ provider: adapter.name, endpoint, kind: req.kind, status: "ok",
        latencyMs: latency, costUsd: cost, userId: req.userId, refId: req.refId });
      return { url, provider: adapter.name, endpoint, latencyMs: latency, costUsd: cost };
    } catch (e) {
      const latency = Date.now() - start;
      const msg = e instanceof Error ? e.message : String(e);
      lastErr = e instanceof Error ? e : new Error(msg);
      markFailure(adapter.name);
      await log({ provider: adapter.name, endpoint: req.model ?? "unknown", kind: req.kind,
        status: "error", latencyMs: latency, costUsd: 0, error: msg.slice(0, 500),
        userId: req.userId, refId: req.refId });
    }
  }
  throw lastErr ?? new Error("All providers failed");
}
