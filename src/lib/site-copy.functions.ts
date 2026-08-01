"use server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- site_copy not yet in generated types.ts
const db = supabaseAdmin as any;

export type SiteCopyRow = {
  key: string;
  value: string;
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

/** Fetch all copy overrides as an array of rows (key, value, updated_at).
 *  Used by the admin panel so it can show timestamps and reset buttons. */
export const getSiteCopy = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await db
    .from("site_copy")
    .select("key, value, updated_at")
    .order("key");
  if (error) {
    // Table absent in some envs — return empty rather than crashing
    const missingTable =
      error.code === "PGRST205" ||
      /could not find the table ['"]?public\.site_copy/i.test(error.message);
    if (missingTable) return [] as SiteCopyRow[];
    throw new Error(error.message);
  }
  return (data ?? []) as SiteCopyRow[];
});

/** Upsert a single copy override. Admin-gated. */
export const adminSetSiteCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ key: z.string().min(1), value: z.string() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await db.from("site_copy").upsert(
      { key: data.key, value: data.value, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Delete a copy override, restoring the hardcoded default. Admin-gated. */
export const adminDeleteSiteCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await db.from("site_copy").delete().eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
