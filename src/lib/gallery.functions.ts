import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DeleteInput = z.object({ id: z.string().uuid() });

/**
 * Permanently delete one generation row owned by the caller. We use the
 * admin client *scoped by userId* so we can also strip the underlying
 * storage object — RLS on `generations` still wouldn't let other users'
 * rows leak because we filter on `auth.uid()` from the middleware.
 */
export const deleteGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DeleteInput.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("generations")
      .select("id, user_id, result_image_url, result_video_url")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Not found");

    // Best-effort storage cleanup — never fail the request because of it.
    for (const url of [row.result_image_url, row.result_video_url]) {
      if (!url) continue;
      const match = url.match(/\/storage\/v1\/object\/public\/studio\/(.+)$/);
      if (match) {
        await supabaseAdmin.storage.from("studio").remove([decodeURIComponent(match[1])]).catch(() => {});
      }
    }

    const { error: delErr } = await supabaseAdmin
      .from("generations")
      .delete()
      .eq("id", row.id)
      .eq("user_id", userId);
    if (delErr) throw new Error(delErr.message);

    return { ok: true as const, id: row.id };
  });
