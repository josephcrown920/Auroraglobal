/**
 * AI Provider integrations for Aurora Performance Studio.
 *
 * Each provider exposes:
 *   submit(params)  → { jobId: string }
 *   poll(jobId)     → { status: "processing"|"completed"|"failed", outputUrl?, thumbnailUrl?, error? }
 *
 * Falls back to demo simulation when the provider's API key is absent.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProviderStatus =
  | { status: "processing"; progress?: number }
  | { status: "completed"; outputUrl: string; thumbnailUrl?: string }
  | { status: "failed"; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 300)}`);
  }
}

// ─── fal.ai ──────────────────────────────────────────────────────────────────

// Map generation types → fal.ai model IDs
const FAL_MODELS: Record<string, string> = {
  photo: "fal-ai/flux/dev",
  ugc: "fal-ai/hunyuan-video",
  music_video: "fal-ai/hunyuan-video",
  video: "fal-ai/kling-video/v1.6/standard/text-to-video",
};

const FAL_QUEUE_BASE = "https://queue.fal.run";

function falHeaders() {
  return {
    "Authorization": `Key ${process.env.FAL_KEY}`,
    "Content-Type": "application/json",
  };
}

function aspectRatioToFalImageSize(aspectRatio: string): string {
  const map: Record<string, string> = {
    "1:1": "square",
    "16:9": "landscape_16_9",
    "9:16": "portrait_9_16",
    "4:3": "landscape_4_3",
    "3:4": "portrait_4_3",
  };
  return map[aspectRatio] ?? "landscape_16_9";
}

export async function falSubmitPhoto(params: {
  prompt: string;
  style: string;
  aspectRatio: string;
  referenceImageUrl?: string | null;
  numImages?: number;
}): Promise<{ jobId: string }> {
  const model = FAL_MODELS.photo!;
  const body: Record<string, unknown> = {
    prompt: `${params.prompt} — ${params.style} photography style`,
    image_size: aspectRatioToFalImageSize(params.aspectRatio),
    num_images: params.numImages ?? 1,
    enable_safety_checker: false,
  };
  if (params.referenceImageUrl) {
    body.image_url = params.referenceImageUrl;
  }

  const data = await fetchJson(`${FAL_QUEUE_BASE}/${model}`, {
    method: "POST",
    headers: falHeaders(),
    body: JSON.stringify(body),
  });

  return { jobId: data.request_id as string };
}

export async function falPollPhoto(requestId: string): Promise<ProviderStatus> {
  const model = FAL_MODELS.photo!;
  const statusData = await fetchJson(
    `${FAL_QUEUE_BASE}/${model}/requests/${requestId}/status`,
    { headers: falHeaders() },
  );

  const st: string = statusData.status;
  if (st === "COMPLETED") {
    // Fetch the result
    const result = await fetchJson(
      `${FAL_QUEUE_BASE}/${model}/requests/${requestId}`,
      { headers: falHeaders() },
    );
    const images: Array<{ url: string }> = result.images ?? [];
    if (!images[0]) return { status: "failed", error: "No images in response" };
    return {
      status: "completed",
      outputUrl: images[0].url,
      thumbnailUrl: images[0].url,
    };
  }
  if (st === "FAILED") {
    return { status: "failed", error: statusData.error ?? "fal.ai job failed" };
  }
  // IN_QUEUE or IN_PROGRESS
  const progress = st === "IN_PROGRESS" ? 50 : 20;
  return { status: "processing", progress };
}

export async function falSubmitVideo(params: {
  prompt: string;
  duration?: number;
  style?: string;
  sourceImageUrl?: string | null;
}): Promise<{ jobId: string }> {
  const model = FAL_MODELS.video!;
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    duration: String(params.duration ?? 5),
    aspect_ratio: "16:9",
  };
  if (params.sourceImageUrl) {
    body.image_url = params.sourceImageUrl;
  }

  const data = await fetchJson(`${FAL_QUEUE_BASE}/${model}`, {
    method: "POST",
    headers: falHeaders(),
    body: JSON.stringify(body),
  });

  return { jobId: data.request_id as string };
}

export async function falPollVideo(requestId: string): Promise<ProviderStatus> {
  const model = FAL_MODELS.video!;
  const statusData = await fetchJson(
    `${FAL_QUEUE_BASE}/${model}/requests/${requestId}/status`,
    { headers: falHeaders() },
  );

  const st: string = statusData.status;
  if (st === "COMPLETED") {
    const result = await fetchJson(
      `${FAL_QUEUE_BASE}/${model}/requests/${requestId}`,
      { headers: falHeaders() },
    );
    const video = result.video ?? result.videos?.[0];
    if (!video?.url) return { status: "failed", error: "No video URL in response" };
    return { status: "completed", outputUrl: video.url };
  }
  if (st === "FAILED") {
    return { status: "failed", error: statusData.error ?? "fal.ai video job failed" };
  }
  return { status: "processing", progress: st === "IN_PROGRESS" ? 50 : 15 };
}

export async function falSubmitUgc(params: {
  prompt: string;
  productDescription: string;
  avatarStyle: string;
  platform: string;
}): Promise<{ jobId: string }> {
  const model = FAL_MODELS.ugc!;
  const fullPrompt = [
    `UGC ad for ${params.platform}: ${params.productDescription}.`,
    `Style: ${params.avatarStyle} creator persona.`,
    params.prompt,
  ].join(" ");

  const data = await fetchJson(`${FAL_QUEUE_BASE}/${model}`, {
    method: "POST",
    headers: falHeaders(),
    body: JSON.stringify({ prompt: fullPrompt, video_size: "portrait_9_16" }),
  });
  return { jobId: data.request_id as string };
}

export async function falPollUgc(requestId: string): Promise<ProviderStatus> {
  const model = FAL_MODELS.ugc!;
  const statusData = await fetchJson(
    `${FAL_QUEUE_BASE}/${model}/requests/${requestId}/status`,
    { headers: falHeaders() },
  );

  const st: string = statusData.status;
  if (st === "COMPLETED") {
    const result = await fetchJson(
      `${FAL_QUEUE_BASE}/${model}/requests/${requestId}`,
      { headers: falHeaders() },
    );
    const video = result.video ?? result.videos?.[0];
    if (!video?.url) return { status: "failed", error: "No video in response" };
    return { status: "completed", outputUrl: video.url };
  }
  if (st === "FAILED") {
    return { status: "failed", error: statusData.error ?? "fal.ai UGC job failed" };
  }
  return { status: "processing", progress: st === "IN_PROGRESS" ? 50 : 15 };
}

export async function falSubmitMusicVideo(params: {
  prompt: string;
  audioUrl: string;
  style: string;
  beatSync: boolean;
}): Promise<{ jobId: string }> {
  const model = FAL_MODELS.music_video!;
  const fullPrompt = [
    `Music video: ${params.prompt}.`,
    `Visual style: ${params.style}.`,
    params.beatSync ? "Beat-synced cuts." : "",
  ].join(" ").trim();

  const data = await fetchJson(`${FAL_QUEUE_BASE}/${model}`, {
    method: "POST",
    headers: falHeaders(),
    body: JSON.stringify({ prompt: fullPrompt }),
  });
  return { jobId: data.request_id as string };
}

export async function falPollMusicVideo(requestId: string): Promise<ProviderStatus> {
  const model = FAL_MODELS.music_video!;
  const statusData = await fetchJson(
    `${FAL_QUEUE_BASE}/${model}/requests/${requestId}/status`,
    { headers: falHeaders() },
  );

  const st: string = statusData.status;
  if (st === "COMPLETED") {
    const result = await fetchJson(
      `${FAL_QUEUE_BASE}/${model}/requests/${requestId}`,
      { headers: falHeaders() },
    );
    const video = result.video ?? result.videos?.[0];
    if (!video?.url) return { status: "failed", error: "No video in response" };
    return { status: "completed", outputUrl: video.url };
  }
  if (st === "FAILED") {
    return { status: "failed", error: statusData.error ?? "fal.ai music video job failed" };
  }
  return { status: "processing", progress: st === "IN_PROGRESS" ? 50 : 15 };
}

// ─── Kling ────────────────────────────────────────────────────────────────────

// KLING_API_KEY may be "accessKeyId:accessKeySecret" — generate JWT for auth.
// If no colon present, treat as a plain Bearer token.
function klingJwt(): string {
  const raw = process.env.KLING_API_KEY ?? "";
  if (!raw.includes(":")) return raw; // bare token, use as-is

  const [accessKeyId, accessKeySecret] = raw.split(":");
  // Build a minimal HS256 JWT manually (no external dep)
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iss: accessKeyId, exp: now + 1800, nbf: now - 5 }),
  ).toString("base64url");

  const { createHmac } = require("crypto");
  const sig = createHmac("sha256", accessKeySecret!)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${sig}`;
}

const KLING_BASE = "https://api.klingai.com";

export async function klingSubmitVideo(params: {
  prompt: string;
  duration?: number;
  style?: string;
  sourceImageUrl?: string | null;
}): Promise<{ jobId: string }> {
  const token = klingJwt();
  const endpoint = params.sourceImageUrl
    ? `${KLING_BASE}/v1/videos/image2video`
    : `${KLING_BASE}/v1/videos/text2video`;

  const body: Record<string, unknown> = {
    model_name: "kling-v1",
    prompt: params.prompt,
    duration: String(params.duration ?? 5),
    aspect_ratio: "16:9",
  };
  if (params.sourceImageUrl) {
    body.image_url = params.sourceImageUrl;
  }

  const data = await fetchJson(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const taskId = data.data?.task_id ?? data.task_id;
  if (!taskId) throw new Error("No task_id in Kling response");
  return { jobId: String(taskId) };
}

export async function klingPollVideo(taskId: string): Promise<ProviderStatus> {
  const token = klingJwt();
  const data = await fetchJson(`${KLING_BASE}/v1/videos/text2video/${taskId}`, {
    headers: { "Authorization": `Bearer ${token}` },
  });

  const task = data.data ?? data;
  const taskStatus: string = task.task_status ?? task.status ?? "";

  if (taskStatus === "succeed" || taskStatus === "completed") {
    const works: Array<{ resource_list?: Array<{ resource_url?: string; url?: string }> }> =
      task.task_result?.videos ?? task.videos ?? [];
    const videoUrl = works[0]?.resource_list?.[0]?.resource_url
      ?? works[0]?.resource_list?.[0]?.url;
    if (!videoUrl) return { status: "failed", error: "No video URL in Kling response" };
    return { status: "completed", outputUrl: videoUrl };
  }
  if (taskStatus === "failed") {
    return { status: "failed", error: task.task_status_msg ?? "Kling job failed" };
  }
  // submitted / processing
  return { status: "processing", progress: taskStatus === "processing" ? 50 : 20 };
}

// ─── Seedance (ByteDance) ─────────────────────────────────────────────────────
// Seedance is ByteDance's video model, accessible via their API.
// API key format: plain Bearer token.

const SEEDANCE_BASE = "https://api.seedance.ai/v1";

export async function seedanceSubmitVideo(params: {
  prompt: string;
  duration?: number;
  sourceImageUrl?: string | null;
}): Promise<{ jobId: string }> {
  const body: Record<string, unknown> = {
    prompt: params.prompt,
    duration: params.duration ?? 5,
    resolution: "1080p",
    aspect_ratio: "16:9",
  };
  if (params.sourceImageUrl) {
    body.image_url = params.sourceImageUrl;
    body.mode = "image_to_video";
  } else {
    body.mode = "text_to_video";
  }

  const data = await fetchJson(`${SEEDANCE_BASE}/video/generate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.SEEDANCE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const jobId = data.job_id ?? data.id ?? data.request_id;
  if (!jobId) throw new Error("No job_id in Seedance response");
  return { jobId: String(jobId) };
}

export async function seedancePollVideo(jobId: string): Promise<ProviderStatus> {
  const data = await fetchJson(`${SEEDANCE_BASE}/video/status/${jobId}`, {
    headers: { "Authorization": `Bearer ${process.env.SEEDANCE_API_KEY}` },
  });

  const st: string = data.status ?? data.state ?? "";
  if (st === "completed" || st === "succeed" || st === "done") {
    const url = data.output_url ?? data.video_url ?? data.url;
    if (!url) return { status: "failed", error: "No video URL in Seedance response" };
    return { status: "completed", outputUrl: url };
  }
  if (st === "failed" || st === "error") {
    return { status: "failed", error: data.error ?? data.message ?? "Seedance job failed" };
  }
  return { status: "processing", progress: typeof data.progress === "number" ? data.progress : 30 };
}

// ─── Sync.so (lip-sync) ───────────────────────────────────────────────────────

export async function syncSubmitLipsync(params: {
  videoUrl: string;
  audioUrl: string;
}): Promise<{ jobId: string }> {
  const data = await fetchJson("https://api.sync.so/v2/generate", {
    method: "POST",
    headers: {
      "x-api-key": process.env.SYNC_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "lipsync-1.9.0-beta",
      input: [
        { type: "video", url: params.videoUrl },
        { type: "audio", url: params.audioUrl },
      ],
      options: { output_format: "mp4", sync_mode: "bounce" },
    }),
  });

  const jobId = data.id ?? data.job_id ?? data.request_id;
  if (!jobId) throw new Error("No job id in Sync.so response");
  return { jobId: String(jobId) };
}

export async function syncPollLipsync(jobId: string): Promise<ProviderStatus> {
  const data = await fetchJson(`https://api.sync.so/v2/generate/${jobId}`, {
    headers: { "x-api-key": process.env.SYNC_API_KEY! },
  });

  const st: string = data.status ?? "";
  if (st === "COMPLETED" || st === "completed") {
    const url = data.outputUrl ?? data.output_url ?? data.url;
    if (!url) return { status: "failed", error: "No output URL in Sync.so response" };
    return { status: "completed", outputUrl: url };
  }
  if (st === "FAILED" || st === "failed" || st === "ERROR") {
    return { status: "failed", error: data.error ?? "Sync.so job failed" };
  }
  return { status: "processing", progress: typeof data.progress === "number" ? data.progress : 30 };
}

// ─── HeyGen (lip-sync) ───────────────────────────────────────────────────────

export async function heygenSubmitLipsync(params: {
  videoUrl: string;
  audioUrl: string;
}): Promise<{ jobId: string }> {
  // HeyGen video translation / lip-sync endpoint
  const data = await fetchJson("https://api.heygen.com/v2/video_translate", {
    method: "POST",
    headers: {
      "X-Api-Key": process.env.HEYGEN_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      video_url: params.videoUrl,
      audio_url: params.audioUrl,
      title: "Aurora Lipsync",
    }),
  });

  const jobId = data.data?.video_translate_id ?? data.video_translate_id ?? data.id;
  if (!jobId) throw new Error("No job id in HeyGen response");
  return { jobId: String(jobId) };
}

export async function heygenPollLipsync(jobId: string): Promise<ProviderStatus> {
  const data = await fetchJson(
    `https://api.heygen.com/v2/video_translate/${jobId}`,
    { headers: { "X-Api-Key": process.env.HEYGEN_API_KEY! } },
  );

  const st: string = (data.data?.status ?? data.status ?? "").toLowerCase();
  if (st === "success" || st === "completed" || st === "done") {
    const url = data.data?.video_url ?? data.video_url ?? data.output_url;
    if (!url) return { status: "failed", error: "No video URL in HeyGen response" };
    return { status: "completed", outputUrl: url };
  }
  if (st === "failed" || st === "error") {
    return { status: "failed", error: data.data?.error ?? "HeyGen job failed" };
  }
  return { status: "processing", progress: typeof data.data?.progress === "number" ? data.data.progress : 30 };
}

// ─── Provider selection helpers ───────────────────────────────────────────────

export function hasFal(): boolean { return !!process.env.FAL_KEY; }
export function hasKling(): boolean { return !!process.env.KLING_API_KEY; }
export function hasSeedance(): boolean { return !!process.env.SEEDANCE_API_KEY; }
export function hasSync(): boolean { return !!process.env.SYNC_API_KEY; }
export function hasHeygen(): boolean { return !!process.env.HEYGEN_API_KEY; }

/**
 * Given a generation type and optional preferred provider, return which
 * provider to use and whether a real key exists.
 *
 * Returns null when no key is available → caller falls back to demo mode.
 */
export type ResolvedProvider = {
  name: string;
  submit: (...args: any[]) => Promise<{ jobId: string }>;
  poll: (jobId: string) => Promise<ProviderStatus>;
};

export function resolveVideoProvider(preferred: string | undefined | null): ResolvedProvider | null {
  if (preferred === "kling" && hasKling()) {
    return { name: "kling", submit: klingSubmitVideo, poll: klingPollVideo };
  }
  if (preferred === "seedance" && hasSeedance()) {
    return { name: "seedance", submit: seedanceSubmitVideo, poll: seedancePollVideo };
  }
  if (preferred === "fal" && hasFal()) {
    return { name: "fal-video", submit: falSubmitVideo, poll: falPollVideo };
  }
  // auto: pick first available
  if (hasKling()) return { name: "kling", submit: klingSubmitVideo, poll: klingPollVideo };
  if (hasSeedance()) return { name: "seedance", submit: seedanceSubmitVideo, poll: seedancePollVideo };
  if (hasFal()) return { name: "fal-video", submit: falSubmitVideo, poll: falPollVideo };
  return null;
}

export function resolveLipsyncProvider(preferred: string | undefined | null): ResolvedProvider | null {
  if (preferred === "sync" && hasSync()) {
    return { name: "sync", submit: syncSubmitLipsync, poll: syncPollLipsync };
  }
  if (preferred === "heygen" && hasHeygen()) {
    return { name: "heygen", submit: heygenSubmitLipsync, poll: heygenPollLipsync };
  }
  if (hasSync()) return { name: "sync", submit: syncSubmitLipsync, poll: syncPollLipsync };
  if (hasHeygen()) return { name: "heygen", submit: heygenSubmitLipsync, poll: heygenPollLipsync };
  return null;
}
