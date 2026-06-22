import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const lookupDeviceCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userCode: z.string().min(4).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("cli_device_codes")
      .select("id, status, expires_at")
      .eq("user_code", data.userCode.toUpperCase().trim())
      .maybeSingle();
    if (!row) return { found: false as const };
    return {
      found: true as const,
      id: row.id,
      status: row.status,
      expired: new Date(row.expires_at).getTime() < Date.now(),
    };
  });

export const approveDeviceCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userCode: z.string().min(4).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const userCode = data.userCode.toUpperCase().trim();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { newApiKeyPlain, hashKey } = await import("@/lib/cli-device.server");
    const { data: row } = await supabaseAdmin
      .from("cli_device_codes")
      .select("id, status, expires_at")
      .eq("user_code", userCode)
      .maybeSingle();
    if (!row) throw new Error("Code not found");
    if (row.status !== "pending") throw new Error("Code already used");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("Code expired");

    const plain = newApiKeyPlain();
    // Persist the API key under the approving user's account.
    await supabaseAdmin.from("api_keys").insert({
      user_id: context.userId,
      name: "Aurora CLI",
      key_hash: hashKey(plain),
      key_prefix: plain.slice(0, 10),
    });
    await supabaseAdmin
      .from("cli_device_codes")
      .update({ status: "approved", user_id: context.userId, api_key_plain: plain })
      .eq("id", row.id);
    return { ok: true };
  });