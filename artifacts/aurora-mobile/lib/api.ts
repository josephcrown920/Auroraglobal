import {
  GALLERY_SUCCESS_STATUSES,
  mapGalleryRow,
  type GalleryRow,
  type Generation,
} from "@/lib/gallery-mapping";
import {
  base64ToBytes,
  inferImageMeta,
  referenceUploadPath,
} from "@/lib/reference-image";
import { supabase } from "@/lib/supabase";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_SGO6FEm9zbgYEOsFqlSX8Q_dFVMJf4x";

// Client-side price hints. The server (src/lib/pricing.ts) is the source of
// truth and does the real charge — these only drive UI copy and the
// "not enough Aura" pre-check, so keep them at the known base rates.
export const IMAGE_COST = 10;
export const VIDEO_COST_FROM = 100;
// Performance Shot (clip reskin): computeCost({features:["video","motion"]})
// = 400 full, preview = ceil(full × 0.5) = 200.
export const RESKIN_COST = 400;
export const RESKIN_PREVIEW_COST = 200;

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "https://auroraperformancestudio.com";
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return {
    Authorization: `Bearer ${session.access_token}`,
    apikey: SUPABASE_PUBLISHABLE_KEY,
    "Content-Type": "application/json",
  };
}

/**
 * fetch() with a hard deadline. React Native's fetch has no built-in
 * timeout, so a stalled connection (dead wifi, a provider hung mid-render)
 * would otherwise leave the UI spinning forever instead of surfacing a
 * retryable error. Generation calls get a long budget since video renders
 * can legitimately take minutes; short calls should pass a smaller one.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("Request timed out — check your connection and try again.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Permanently delete the signed-in user's account (server wipes profile,
 * credits, generations, uploads + the auth user). Required by App Store
 * 5.1.1(v) and Play's account-deletion policy. Caller signs out afterwards.
 */
export async function deleteAccount(): Promise<void> {
  const res = await fetchWithTimeout(
    `${getApiBase()}/api/public/account-delete`,
    {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ confirm: "DELETE" }),
    },
    30_000,
  );
  if (!res.ok) {
    let msg = `Account deletion failed (HTTP ${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      // keep the default message
    }
    throw new Error(msg);
  }
}

export type { Generation } from "@/lib/gallery-mapping";

// ─── Reference image upload ───────────────────────────────────────────────────
// Mirrors the web UploadSlot flow: upload into the user's own folder in the
// `studio` bucket, then hand the backend a 1h signed URL (a *.supabase.co
// host, which passes the server's SSRF allowlist and ownership guard).

/**
 * Upload a picked photo to the user's studio folder and return a signed URL
 * the generate endpoint will accept. Pass the ImagePicker asset's base64
 * (request it with `base64: true`); falls back to fetching the local URI.
 * Pass the asset's `mimeType` when available so HEIC/PNG picks keep the
 * right content type (the URI alone often has no useful extension).
 *
 * Decoding is strict (lib/reference-image.ts): malformed base64 throws
 * instead of silently uploading a truncated image.
 */
export async function uploadReferenceImage(
  localUri: string,
  base64?: string | null,
  mimeType?: string | null,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let bytes: ArrayBuffer;
  if (base64) {
    // Fresh exact-size Uint8Array → its .buffer is safe to hand to storage.
    bytes = base64ToBytes(base64).buffer as ArrayBuffer;
  } else {
    const res = await fetch(localUri);
    bytes = await res.arrayBuffer();
  }
  if (bytes.byteLength === 0) {
    throw new Error("Picked image is empty — try choosing it again.");
  }

  const meta = inferImageMeta(mimeType, localUri);

  const path = referenceUploadPath(user.id, meta.ext);
  const { error } = await supabase.storage.from("studio").upload(path, bytes, {
    contentType: meta.contentType,
    upsert: false,
  });
  if (error) throw error;

  const { data: signed, error: signErr } = await supabase.storage
    .from("studio")
    .createSignedUrl(path, 60 * 60);
  if (signErr || !signed?.signedUrl) {
    throw signErr ?? new Error("Could not sign upload URL");
  }
  return signed.signedUrl;
}

/**
 * Upload a picked performance clip to the user's studio folder and return a
 * signed URL the perform endpoint accepts. Keep clips short (≤ 30s) — the
 * cap here only guards against runaway memory on device.
 */
export async function uploadReferenceVideo(
  localUri: string,
  fileSizeBytes?: number | null,
): Promise<string> {
  if (fileSizeBytes && fileSizeBytes > 80 * 1024 * 1024) {
    throw new Error("Clip too large — keep it under 30 seconds.");
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const res = await fetch(localUri);
  const bytes = await res.arrayBuffer();
  // Authoritative cap — picker metadata (fileSize) is optional and absent on some platforms.
  if (bytes.byteLength > 80 * 1024 * 1024) {
    throw new Error("Clip too large — keep it under 30 seconds.");
  }

  const rawExt = localUri.split("?")[0].split(".").pop()?.toLowerCase() ?? "mp4";
  const ext = ["mp4", "mov", "webm", "m4v"].includes(rawExt) ? rawExt : "mp4";
  const contentType =
    ext === "mov"
      ? "video/quicktime"
      : ext === "webm"
        ? "video/webm"
        : "video/mp4";

  const path = referenceUploadPath(user.id, ext);
  const { error } = await supabase.storage.from("studio").upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw error;

  const { data: signed, error: signErr } = await supabase.storage
    .from("studio")
    .createSignedUrl(path, 60 * 60);
  if (signErr || !signed?.signedUrl) {
    throw signErr ?? new Error("Could not sign upload URL");
  }
  return signed.signedUrl;
}

// ─── Generation ───────────────────────────────────────────────────────────────

export type MotionPreset =
  | "orbit"
  | "push-in"
  | "pull-out"
  | "pan-left"
  | "pan-right"
  | "tilt-up"
  | "tilt-down"
  | "static"
  | "handheld";

export interface GenerateParams {
  kind: "image" | "video";
  prompt: string;
  /** Signed studio-bucket URLs (see uploadReferenceImage). */
  imageUrls?: string[];
  /** Video only: 3–15s (server enforces Free=10s cap). */
  duration?: number;
  resolution?: "480p" | "720p" | "1080p";
  motion?: MotionPreset;
  /**
   * Video only: id of a succeeded preview generation. Without it the server
   * forces a cheap 480p/≤5s preview pass and returns previewGenerationId —
   * pass that back here to render at full quality.
   */
  confirmPreviewId?: string;
  /**
   * Identifies one logical "Generate" tap so a retry of the exact same
   * action (not a fresh generation) never creates a second paid render.
   * Generate once per tap with randomUploadId() from reference-image.ts and
   * reuse it if you retry that same attempt; omit for a genuinely new one.
   */
  idempotencyKey?: string;
}

export interface GenerateResult {
  ok: boolean;
  /** Result media URL (image or video). */
  url: string | null;
  creditsCost?: number;
  provider?: string;
  /** True when the server rendered a preview pass instead of full quality. */
  preview?: boolean;
  /** Pass back as confirmPreviewId to render this at full quality. */
  previewGenerationId?: string;
}

export async function generateContent(params: GenerateParams): Promise<GenerateResult> {
  const headers = await getAuthHeaders();
  const base = getApiBase();

  const body: Record<string, unknown> = {
    kind: params.kind,
    prompt: params.prompt,
  };
  if (params.imageUrls?.length) body.imageUrls = params.imageUrls;
  if (params.duration) body.duration = params.duration;
  if (params.resolution) body.resolution = params.resolution;
  if (params.motion) body.motion = params.motion;
  if (params.confirmPreviewId) body.confirmPreviewId = params.confirmPreviewId;
  if (params.idempotencyKey) body.idempotencyKey = params.idempotencyKey;

  const res = await fetchWithTimeout(
    `${base}/api/public/generate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
    // Video renders legitimately run for minutes; images are much faster
    // but share the same endpoint, so budget for the slow case.
    180_000,
  );

  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.ok === false || json.error) {
    const msg: string = json?.error || json?.message || `HTTP ${res.status}`;
    if (
      res.status === 402 ||
      /credit|balance|insufficient|aura/i.test(msg)
    ) {
      throw new Error("out_of_credits");
    }
    throw new Error(msg);
  }

  return {
    ok: true,
    url: json.url ?? null,
    creditsCost: json.creditsCost,
    provider: json.provider,
    preview: json.preview === true,
    previewGenerationId: json.previewGenerationId,
  };
}

// ─── Perform Anywhere (Performance Shot reskin) ──────────────────────────────

export interface ReskinParams {
  /** Signed studio-bucket URL of the phone performance clip. */
  performanceVideoUrl: string;
  /** Signed studio-bucket URL of the identity photo (your character). */
  avatarImageUrl: string;
  /** New scene / location description. */
  location?: string;
  /** New outfit description. */
  outfit?: string;
  /** Extra creative direction. */
  prompt?: string;
  /** Succeeded preview generation id — unlocks the full-quality render. */
  confirmPreviewId?: string;
}

export interface ReskinResult {
  jobId: string;
  generationId: string;
  /** True when this run is the capped preview pass. */
  preview: boolean;
}

/**
 * Enqueue a Performance Shot: Aurora swaps the performer from your clip into
 * a new scene/outfit using your character photo. Async — poll the returned
 * generationId via getGenerationStatus until it succeeds.
 * Throws "motion_offline" when no motion-capable backend is connected.
 */
export async function generatePerformanceReskin(params: ReskinParams): Promise<ReskinResult> {
  const headers = await getAuthHeaders();
  const body: Record<string, unknown> = {
    performanceVideoUrl: params.performanceVideoUrl,
    avatarImageUrl: params.avatarImageUrl,
  };
  if (params.location) body.location = params.location;
  if (params.outfit) body.outfit = params.outfit;
  if (params.prompt) body.prompt = params.prompt;
  if (params.confirmPreviewId) body.confirmPreviewId = params.confirmPreviewId;

  const res = await fetchWithTimeout(
    `${getApiBase()}/api/public/perform`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    },
    180_000,
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.ok === false || json.error) {
    const msg: string = json?.error || `HTTP ${res.status}`;
    if (json?.code === "no_motion_backend" || res.status === 503) {
      throw new Error("motion_offline");
    }
    if (res.status === 402 || /credit|balance|insufficient|aura/i.test(msg)) {
      throw new Error("out_of_credits");
    }
    throw new Error(msg);
  }
  return {
    jobId: json.jobId,
    generationId: json.generationId,
    preview: json.preview === true,
  };
}

export interface GenerationStatus {
  status: string;
  videoUrl: string | null;
}

/** Poll a queued generation (own rows only — RLS enforced). */
export async function getGenerationStatus(generationId: string): Promise<GenerationStatus> {
  const { data, error } = await supabase
    .from("generations")
    .select("status, motion_video_url, result_video_url")
    .eq("id", generationId)
    .single();
  if (error) throw error;
  const row = data as {
    status: string;
    motion_video_url: string | null;
    result_video_url: string | null;
  };
  return {
    status: row.status,
    videoUrl: row.motion_video_url ?? row.result_video_url ?? null,
  };
}

// ─── Gallery / profile / ledger ──────────────────────────────────────────────

export async function getGallery(limit = 40): Promise<Generation[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // The live schema stores results split by medium (result_video_url /
  // motion_video_url / result_image_url) — there is no output_url column.
  // Success statuses are "complete" (sync paths) and "succeeded" (async
  // queue jobs); see gallery-mapping.ts.
  const { data, error } = await supabase
    .from("generations")
    .select(
      "id, created_at, result_video_url, motion_video_url, result_image_url, prompt, kind, status",
    )
    .eq("user_id", user.id)
    .in("status", [...GALLERY_SUCCESS_STATUSES])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) => mapGalleryRow(row as GalleryRow));
}

export interface UserProfile {
  credits_balance: number;
  display_name: string | null;
  avatar_url: string | null;
}

export async function getUserProfile(): Promise<UserProfile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .select("credits_balance, display_name, avatar_url")
    .eq("user_id", user.id)
    .single();

  if (error) throw error;
  return data as UserProfile;
}

export interface CreditTransaction {
  id: string;
  created_at: string;
  amount: number;
  description: string;
  balance_after: number;
}

export interface VideoSource {
  uri: string;
  headers: Record<string, string>;
}

/**
 * Playback source for a generated video, routed through the backend
 * faststart proxy. iOS AVPlayer needs the MP4 moov atom at the front of the
 * file (+faststart); provider URLs often have it last, which renders as a
 * black frame. The proxy checks box order and remuxes only when needed.
 */
export async function getVideoSource(generationId: string): Promise<VideoSource> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return {
    uri: `${getApiBase()}/api/public/faststart-video?id=${encodeURIComponent(generationId)}`,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_PUBLISHABLE_KEY,
    },
  };
}

export async function getCreditTransactions(limit = 20): Promise<CreditTransaction[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("credit_ledger")
    .select("id, created_at, amount, description, balance_after")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []) as CreditTransaction[];
}
