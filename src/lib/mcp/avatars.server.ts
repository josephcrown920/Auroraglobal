// Avatar (persona) data access for the Aurora MCP server.
// All access is scoped to a single user_id. We use the service-role client
// (supabaseAdmin, bypasses RLS) and scope manually, because the MCP route has
// already authenticated the caller's bearer token to a user id.
//
// Avatar LoRA training (HeyGen / Sync.so) is OPTIONAL and only attempted when
// the relevant API keys are present. Without them, an avatar is created as a
// plain, immediately-usable persona record (training_status = 'completed').

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Avatar } from "./types";

// The generated Supabase types don't include `avatars` yet (added by migration,
// types regenerate later). Use a narrow loose-typed handle for this one table.
type LooseClient = {
  from: (table: string) => {
    select: (cols: string) => any;
    insert: (row: Record<string, unknown>) => any;
  };
};
function db(): LooseClient {
  return supabaseAdmin as unknown as LooseClient;
}

export async function listAvatars(userId: string, limit = 20): Promise<Avatar[]> {
  const { data, error } = await db()
    .from("avatars")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`avatars fetch failed: ${error.message}`);
  return (data ?? []) as Avatar[];
}

export async function getAvatarByName(userId: string, name: string): Promise<Avatar | null> {
  const { data, error } = await db()
    .from("avatars")
    .select("*")
    .eq("user_id", userId)
    .ilike("name", `%${name}%`)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`avatar lookup failed: ${error.message}`);
  return (data as Avatar) ?? null;
}

// ─── Optional external LoRA training ──────────────────────────────────────────

async function submitHeyGenTraining(
  name: string,
  imageUrls: string[],
): Promise<{ trainingId: string; estimatedSeconds: number }> {
  const heygenKey = process.env.HEYGEN_API_KEY;
  if (!heygenKey) throw new Error("HEYGEN_API_KEY not set");
  const res = await fetch("https://api.heygen.com/v1/custom_avatar/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": heygenKey },
    body: JSON.stringify({ avatar_name: name, reference_images: imageUrls }),
  });
  if (!res.ok) throw new Error(`HeyGen API error [${res.status}]: ${await res.text()}`);
  const data = (await res.json()) as {
    avatar_id?: string;
    training_id?: string;
    estimated_processing_time?: number;
  };
  return {
    trainingId: data.training_id || data.avatar_id || "",
    estimatedSeconds: data.estimated_processing_time || 7200,
  };
}

async function submitSyncTraining(name: string, imageUrls: string[]): Promise<string> {
  const syncKey = process.env.SYNC_API_KEY;
  if (!syncKey) return "";
  try {
    const res = await fetch("https://api.sync.so/v1/models/train", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${syncKey}` },
      body: JSON.stringify({
        model_name: `${name.toLowerCase()}_lipsync`,
        reference_images: imageUrls,
        auto_optimize: true,
      }),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { model_id?: string; id?: string };
    return data.model_id || data.id || "";
  } catch {
    return "";
  }
}

export interface CreateAvatarInput {
  name: string;
  image_urls?: string[];
  trigger_word?: string;
  style?: string;
  lipsync?: boolean;
}

export async function createAvatar(userId: string, input: CreateAvatarInput): Promise<Avatar> {
  const images = input.image_urls ?? [];
  let loraId = "";
  let syncLoraId: string | null = null;
  let trainingStatus: Avatar["training_status"] = "completed";
  let trainingError: string | null = null;

  // Only attempt LoRA training if HeyGen is configured AND reference images given.
  if (process.env.HEYGEN_API_KEY && images.length > 0) {
    try {
      const hg = await submitHeyGenTraining(input.name, images);
      loraId = hg.trainingId;
      trainingStatus = "pending";
      if (input.lipsync) syncLoraId = (await submitSyncTraining(input.name, images)) || null;
    } catch (e) {
      trainingError = e instanceof Error ? e.message : String(e);
      trainingStatus = "failed";
    }
  }

  const row = {
    user_id: userId,
    name: input.name,
    handle: `@${input.name.toLowerCase().replace(/\s+/g, "")}.ai`,
    lora_id: loraId || null,
    sync_lora_id: syncLoraId,
    trigger_word: input.trigger_word ?? "style",
    style: input.style ?? "general",
    preview_url: images[0] ?? null,
    training_status: trainingStatus,
    training_error: trainingError,
    training_completed_at: trainingStatus === "completed" ? new Date().toISOString() : null,
  };

  const { data, error } = await db().from("avatars").insert(row).select("*").single();
  if (error) throw new Error(`avatar create failed: ${error.message}`);
  return data as Avatar;
}
