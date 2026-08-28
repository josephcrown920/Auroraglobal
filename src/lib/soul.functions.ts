// Aurora Soul — client-callable server functions. Business logic lives in
// soul.server.ts; this file is the thin, auth-gated RPC surface (per the
// server-file/client-stub split — *.server.ts is stripped from the client
// bundle, so anything createServerFn-exposed to the browser must live here).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertFeatureAccess } from "@/lib/feature-visibility.server";
import {
  getOwnedSoul,
  isStaleTraining,
  trainSoul as trainSoulCore,
  generateSoulImage as generateSoulImageCore,
  generateSoulVideo as generateSoulVideoCore,
  getSoulVideoJobStatus as getSoulVideoJobStatusCore,
  vibeMatch as vibeMatchCore,
  type SoulRow,
  type SoulVideoJobRow,
  type SoulImageResult,
  type SoulVideoResult,
  type VibeResult,
} from "@/lib/soul.server";
import { soulImageCost, soulVideoCost } from "@/lib/pricing";

export { soulImageCost, soulVideoCost };
export type { SoulRow, SoulVideoJobRow, SoulImageResult, SoulVideoResult, VibeResult };

export type SoulWithMeta = SoulRow & { stale: boolean };

// ─── CRUD ────────────────────────────────────────────────────────────────────

export const createSoul = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ name: z.string().min(1).max(100), description: z.string().max(500).optional() })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertFeatureAccess(context.userId, "soul");
    const { data: row, error } = await supabaseAdmin
      .from("souls" as never)
      .insert({
        user_id: context.userId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        trigger_word: `sks-${Math.random().toString(36).slice(2, 8)}`,
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as SoulRow;
  });

export const listSouls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SoulWithMeta[]> => {
    await assertFeatureAccess(context.userId, "soul");
    const { data, error } = await supabaseAdmin
      .from("souls" as never)
      .select("*")
      .eq("user_id" as never, context.userId)
      .order("created_at" as never, { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data as SoulRow[]).map((s) => ({ ...s, stale: isStaleTraining(s) }));
  });

export const getSoul = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ soulId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<SoulWithMeta> => {
    await assertFeatureAccess(context.userId, "soul");
    const soul = await getOwnedSoul(data.soulId, context.userId);
    return { ...soul, stale: isStaleTraining(soul) };
  });

export const deleteSoul = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ soulId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertFeatureAccess(context.userId, "soul");
    const soul = await getOwnedSoul(data.soulId, context.userId);
    const { error } = await supabaseAdmin
      .from("souls" as never)
      .delete()
      .eq("id" as never, data.soulId)
      .eq("user_id" as never, context.userId);
    if (error) throw new Error(error.message);
    // Best-effort storage cleanup — the DB row is the source of truth either way.
    try {
      const paths = [...soul.training_image_paths, ...soul.reference_image_paths];
      if (paths.length) await supabaseAdmin.storage.from("soul-training").remove(paths);
    } catch {
      // ignore
    }
    return { ok: true };
  });

/** Record an already-uploaded training photo (client uploads directly to the
 * private soul-training bucket via its own-folder RLS policy, then calls this
 * to attach the path to the soul + an ownership audit row). */
export const addSoulTrainingImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ soulId: z.string().uuid(), storagePath: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertFeatureAccess(context.userId, "soul");
    const soul = await getOwnedSoul(data.soulId, context.userId);
    // The upload path must live under the caller's own folder — matches the
    // storage RLS policy and prevents attaching another user's asset path.
    if (!data.storagePath.startsWith(`${context.userId}/`)) {
      throw new Error("Invalid storage path for this account");
    }
    const { error: assetErr } = await supabaseAdmin.from("soul_reference_assets" as never).insert({
      user_id: context.userId,
      soul_id: data.soulId,
      storage_path: data.storagePath,
      label: "training",
    } as never);
    if (assetErr) throw new Error(assetErr.message);

    const nextPaths = [...soul.training_image_paths, data.storagePath];
    const { data: updated, error: updErr } = await supabaseAdmin
      .from("souls" as never)
      .update({ training_image_paths: nextPaths } as never)
      .eq("id" as never, data.soulId)
      .select("*")
      .single();
    if (updErr) throw new Error(updErr.message);
    return updated as SoulRow;
  });

// ─── training ────────────────────────────────────────────────────────────────

export const trainSoul = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ soulId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertFeatureAccess(context.userId, "soul");
    return trainSoulCore(data.soulId, context.userId);
  });

// ─── generation ──────────────────────────────────────────────────────────────

export const generateSoulImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        soulId: z.string().uuid(),
        prompt: z.string().min(1).max(1000),
        aspectRatio: z.string().max(20).default("1:1"),
        numOutputs: z.number().int().min(1).max(4).default(1),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertFeatureAccess(context.userId, "soul");
    return generateSoulImageCore(data.soulId, context.userId, data.prompt, data.aspectRatio, data.numOutputs);
  });

export const generateSoulVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        soulId: z.string().uuid(),
        prompt: z.string().min(1).max(1000),
        durationSeconds: z.number().min(4).max(30).default(5),
        aspectRatio: z.string().max(20).default("9:16"),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertFeatureAccess(context.userId, "soul");
    return generateSoulVideoCore(data.soulId, context.userId, data.prompt, data.durationSeconds, data.aspectRatio);
  });

export const getSoulVideoJobStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertFeatureAccess(context.userId, "soul");
    return getSoulVideoJobStatusCore(data.jobId, context.userId);
  });

export const listSoulVideoJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ soulId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ context, data }): Promise<SoulVideoJobRow[]> => {
    await assertFeatureAccess(context.userId, "soul");
    let query = supabaseAdmin
      .from("soul_video_jobs" as never)
      .select("*")
      .eq("user_id" as never, context.userId)
      .order("created_at" as never, { ascending: false })
      .limit(50);
    if (data.soulId) query = query.eq("soul_id" as never, data.soulId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows as SoulVideoJobRow[];
  });

// ─── vibe matcher ────────────────────────────────────────────────────────────

export const vibeMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ imageUrl: z.string().url() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertFeatureAccess(context.userId, "soul");
    return vibeMatchCore(data.imageUrl, context.userId);
  });
