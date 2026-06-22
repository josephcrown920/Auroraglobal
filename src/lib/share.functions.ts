import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Owner action — toggle a generation public and mint a share token. */
export const publishGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Ownership check (RLS already scopes, but be explicit)
    const { data: row, error } = await supabase
      .from("generations")
      .select("id, user_id, share_token, is_public")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || row.user_id !== userId) throw new Error("Not found");
    const token = row.share_token ?? crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const { error: upErr } = await supabase
      .from("generations")
      .update({ is_public: true, share_token: token })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return { token, url: `/r/${token}` };
  });

/** Owner action — unpublish. */
export const unpublishGeneration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("generations")
      .update({ is_public: false })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public read — anyone can view by share token if is_public is true. */
export const getPublicShare = createServerFn({ method: "GET" })
  .inputValidator(z.object({ token: z.string().min(8).max(64) }).parse)
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("generations")
      .select("id, prompt, mode, kind, model, result_image_url, result_video_url, created_at, share_token, is_public, user_id")
      .eq("share_token", data.token)
      .eq("is_public", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { found: false as const };

    // Get author display name (no email)
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("user_id", row.user_id)
      .maybeSingle();

    return {
      found: true as const,
      share: {
        id: row.id,
        prompt: row.prompt,
        mode: row.mode,
        kind: row.kind,
        model: row.model,
        result_image_url: row.result_image_url,
        result_video_url: row.result_video_url,
        created_at: row.created_at,
        token: row.share_token,
        author: (prof?.display_name as string | undefined) ?? "Aurora creator",
      },
    };
  });
