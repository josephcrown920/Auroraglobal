/**
 * Wardrobe server functions — list, add, and delete saved outfit/look
 * references.  Each item stores a studio-bucket storage_path and signs a
 * fresh URL at read time so the link never expires.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// wardrobe_items isn't in the generated types yet (added by migration).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any;

export type WardrobeItem = {
  id: string;
  storage_path: string;
  label: string;
  created_at: string;
  url: string; // 24-hour signed URL
};

/** Return up to 20 saved looks for the signed-in user, newest first. */
export const listWardrobeItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await db
      .from("wardrobe_items")
      .select("id, storage_path, label, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);

    const rows: { id: string; storage_path: string; label: string; created_at: string }[] =
      data ?? [];

    // Generate 24-hour signed URLs in parallel.
    const items = await Promise.all(
      rows.map(async (row) => {
        const { data: signed } = await supabaseAdmin.storage
          .from("studio")
          .createSignedUrl(row.storage_path, 72 * 60 * 60); // 72 h — must outlive any queue wait
        return signed?.signedUrl
          ? ({ ...row, url: signed.signedUrl } as WardrobeItem)
          : null;
      }),
    );
    return items.filter((i): i is WardrobeItem => i !== null);
  });

/** Persist a newly uploaded outfit path.  Called client-side after the file
 *  is uploaded to the studio bucket so we hold only the storage_path. */
export const addWardrobeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        storagePath: z.string().min(1),
        label: z.string().max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Ownership check: storagePath must live under the caller's user-id folder
    // inside the studio bucket (e.g. "{userId}/wardrobe/{uuid}.jpg").
    // Reject traversal tricks and foreign-user prefixes outright so that
    // listWardrobeItems cannot sign URLs for assets the caller doesn't own.
    const firstSegment = data.storagePath.split("/")[0];
    if (
      firstSegment !== context.userId ||
      /(?:^|\/)\.\.(?:\/|$)|%2f|%2e/i.test(data.storagePath)
    ) {
      throw new Error("Storage path does not belong to you");
    }

    const { data: item, error } = await db
      .from("wardrobe_items")
      .insert({ user_id: context.userId, storage_path: data.storagePath, label: data.label ?? "" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return item as { id: string };
  });

/** Delete one of the caller's wardrobe items by id. */
export const deleteWardrobeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await db
      .from("wardrobe_items")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
