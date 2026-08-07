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

export type SiteCopyHistoryRow = {
  id: number;
  key: string;
  value: string;
  changed_by: string;
  changed_at: string;
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
    const { data: current, error: currentError } = await db
      .from("site_copy")
      .select("value")
      .eq("key", data.key)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);

    // Keep the value being replaced so an admin can restore it later.
    if (current) {
      const { error: historyError } = await db.from("site_copy_history").insert({
        key: data.key,
        value: current.value,
        changed_by: context.userId,
      });
      if (historyError) throw new Error(historyError.message);
    }

    const { error } = await db.from("site_copy").upsert(
      { key: data.key, value: data.value, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);

    const { data: historyRows, error: historyListError } = await db
      .from("site_copy_history")
      .select("id")
      .eq("key", data.key)
      .order("changed_at", { ascending: false })
      .order("id", { ascending: false });
    if (historyListError) throw new Error(historyListError.message);

    const staleIds = ((historyRows ?? []) as { id: number }[]).slice(10).map((row) => row.id);
    if (staleIds.length > 0) {
      const { error: pruneError } = await db
        .from("site_copy_history")
        .delete()
        .in("id", staleIds);
      if (pruneError) throw new Error(pruneError.message);
    }

    return { ok: true };
  });

/** Fetch the latest previous values for one copy key. Admin-gated. */
export const getSiteCopyHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await db
      .from("site_copy_history")
      .select("id, key, value, changed_by, changed_at")
      .eq("key", data.key)
      .order("changed_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return (rows ?? []) as SiteCopyHistoryRow[];
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
