import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function newDeviceCode() {
  return randomBytes(32).toString("base64url");
}

export function newUserCode() {
  // 8-char human-friendly, no ambiguous chars
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += alphabet[buf[i] % alphabet.length];
  return s.slice(0, 4) + "-" + s.slice(4);
}

export function newApiKeyPlain() {
  return "aurk_" + randomBytes(24).toString("base64url");
}

export function hashKey(plain: string) {
  return createHash("sha256").update(plain).digest("hex");
}

/** Look up the user that owns a given API key, updating last_used_at. */
export async function userIdForApiKey(plain: string): Promise<string | null> {
  if (!plain.startsWith("aurk_")) return null;
  const h = hashKey(plain);
  const { data } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", h)
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return data.user_id;
}