import { supabase } from "@/lib/supabase";

export type GenerationKind = "image" | "video" | "lipsync" | "upscale";

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

function apiBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  return `https://${domain}`;
}

/** Fetch the current user's generations from the generations table. */
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

export interface GenerateImageParams {
  prompt: string;
}

/** POST /api/public/generate with the user's bearer token. */
export async function generateImage(params: GenerateImageParams): Promise<GenerateResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("You must be signed in to generate.");

  const res = await fetch(`${apiBaseUrl()}/api/public/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ kind: "image", prompt: params.prompt }),
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
