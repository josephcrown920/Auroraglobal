import { supabase } from "@/lib/supabase";

export type GenerationKind = "image" | "video" | "lipsync" | "upscale";

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

export const CREDIT_COST: Record<GenerationKind, number> = {
  image: 1,
  upscale: 1,
  lipsync: 3,
  video: 5,
};

export interface GenerationRow {
  id: string;
  user_id: string;
  prompt: string | null;
  kind: GenerationKind | string;
  status: string;
  input_images: string[] | null;
  audio_url: string | null;
  model: string | null;
  result_image_url: string | null;
  result_video_url: string | null;
  credits_cost: number | null;
  created_at: string;
}

export interface GenerateResponse {
  ok: boolean;
  url?: string;
  provider?: string;
  endpoint?: string;
  latencyMs?: number;
  estimatedCostUsd?: number;
  error?: string;
}

/** Parameters for POST /api/public/generate. */
export interface GenerateParams {
  kind: GenerationKind;
  /** Required for image and video; optional for upscale. */
  prompt?: string;
  /** Input image URLs (for video i2v or upscale). */
  imageUrls?: string[];
  /** Audio URL for lipsync. */
  audioUrl?: string;
  /** Source video URL for lipsync. */
  videoUrl?: string;
  /** Video duration in seconds (3-12). */
  duration?: number;
  /** Camera motion preset for video generation. */
  motion?: MotionPreset;
}

function apiBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  return `https://${domain}`;
}

/** Fetch the current user's generations, newest first. */
export async function fetchGenerations(): Promise<GenerationRow[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("generations")
    .select(
      "id, user_id, prompt, kind, status, input_images, audio_url, model, result_image_url, result_video_url, credits_cost, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []) as GenerationRow[];
}

/**
 * POST /api/public/generate — unified for all four generation types:
 *   image   (1 cr): prompt → image URL
 *   video   (5 cr): prompt + optional motion/duration → video URL
 *   lipsync (3 cr): videoUrl + audioUrl → video URL
 *   upscale (1 cr): imageUrls[0] → upscaled image URL
 */
export async function generate(params: GenerateParams): Promise<GenerateResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("You must be signed in to generate.");

  const body: Record<string, unknown> = { kind: params.kind };
  if (params.prompt) body.prompt = params.prompt;
  if (params.imageUrls?.length) body.imageUrls = params.imageUrls;
  if (params.audioUrl) body.audioUrl = params.audioUrl;
  if (params.videoUrl) body.videoUrl = params.videoUrl;
  if (params.duration) body.duration = params.duration;
  if (params.motion) body.motion = params.motion;

  const res = await fetch(`${apiBaseUrl()}/api/public/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  let json: GenerateResponse;
  try {
    json = (await res.json()) as GenerateResponse;
  } catch {
    throw new Error(`Unexpected response (${res.status})`);
  }
  if (!res.ok || json.ok === false) {
    throw new Error(json.error ?? `Generation failed (${res.status})`);
  }
  return json;
}
