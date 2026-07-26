"use server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

export type SiteImageRow = {
  key: string;
  url: string;
  label: string;
  section: string;
  default_url: string;
  updated_at: string;
};

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden — admin only");
}

// Cast to bypass Supabase generated types until types.ts is regenerated after migration
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- site_images table not yet in generated types.ts; cast until next type regen
const db = supabaseAdmin as any;

export const getSiteImages = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await db
    .from("site_images")
    .select("key, url, label, section, default_url, updated_at")
    .order("section")
    .order("key");
  if (error) throw new Error(error.message);
  return (data ?? []) as SiteImageRow[];
});

export const adminUpdateSiteImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string(), url: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await db
      .from("site_images")
      .upsert({ key: data.key, url: data.url, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminResetSiteImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: row, error: fetchErr } = await db
      .from("site_images")
      .select("default_url")
      .eq("key", data.key)
      .single();
    if (fetchErr) throw new Error(fetchErr.message);
    const { error } = await db
      .from("site_images")
      .update({ url: row.default_url, updated_at: new Date().toISOString() })
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
