// Locked digital likeness — server functions.
//
// - `lockLikeness` : persist a primary reference + optional extra refs and an
//   auto-generated identity spec (face/build/hair/wardrobe/energy). This is
//   the "lock" step — the character is frozen and can be reused across shoots.
// - `listLikenesses` / `deleteLikeness` : CRUD.
// - `runLikenessShoot` : hold identity + outfit + scene constant, vary only
//   camera + pose from the SHOOT_DECK, and render N stills in parallel. Each
//   image is charged independently (1 Aura), so a failed shot only refunds its
//   own reservation and partial success is fine.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { orchestrate } from "@/lib/orchestrator.server";
import {
  LIKENESS_COST_PER_IMAGE,
  LIKENESS_MAX_SHOTS,
  LIKENESS_MODEL,
  SHOOT_DECK,
  buildShotPrompt,
  type ShootBrief,
  type ShootShot,
} from "@/lib/likeness-shoot";

export { LIKENESS_COST_PER_IMAGE, LIKENESS_MAX_SHOTS, SHOOT_DECK };
export type { ShootBrief, ShootShot };

type LikenessRow = {
  id: string;
  user_id: string;
  name: string;
  primary_path: string;
  extra_paths: string[];
  spec: { description?: string } | null;
  locked_at: string;
  created_at: string;
};

export type LikenessWithUrl = LikenessRow & { signedUrl: string };

/**
 * Ownership guard for raw studio-bucket object paths (not URLs): the top-level
 * folder must be the caller's own user id. Without this, a crafted request
 * could lock (and have the LLM describe) another user's private photo just by
 * knowing its storage path. Mirrors assertOwnStudioUpload in url-guard.ts,
 * which handles the URL form of the same rule.
 */
function assertOwnStudioPath(path: string, userId: string): void {
  // Reject traversal / re-encoding tricks outright — `..`, encoded slashes or
  // dots, and backslashes can only be attempts to escape the folder.
  if (/(?:^|\/)\.\.(?:\/|$)|%2f|%2e|\\/i.test(path)) throw new Error("Invalid photo path");
  const owner = path.replace(/^\/+/, "").split("/")[0];
  if (owner !== userId) throw new Error("Not your photo");
}

async function signPath(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from("studio")
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) throw new Error(`sign failed: ${error?.message ?? "no url"}`);
  return data.signedUrl;
}

/** Best-effort vision pass: read the reference and describe identity so the
 *  shoot prompts can reinforce likeness. Reference image remains authoritative. */
async function analyzeLikeness(imageUrl: string, userId: string): Promise<string | null> {
  try {
    const res = await orchestrate({
      kind: "text",
      model: "lovable/gemini-2.5-flash",
      imageUrls: [imageUrl],
      userId,
      prompt:
        "Look at this portrait and describe the subject in 3-4 tight sentences for a " +
        "music-video shoot identity lock: face shape, hair, build/physique, skin tone, " +
        "distinctive tattoos or accessories, wardrobe if visible, and overall energy. " +
        "Be concrete and visual. No commentary, no preamble.",
    });
    const text = res.text?.trim();
    return text && text.length > 0 ? text.slice(0, 900) : null;
  } catch {
    return null;
  }
}

// ─── Save (lock) ─────────────────────────────────────────────────────────────

export const lockLikeness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        primaryPath: z.string().min(1).max(500),
        extraPaths: z.array(z.string().min(1).max(500)).max(6).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    assertOwnStudioPath(data.primaryPath, context.userId);
    for (const p of data.extraPaths ?? []) assertOwnStudioPath(p, context.userId);

    const primaryUrl = await signPath(data.primaryPath, 600);
    const description = await analyzeLikeness(primaryUrl, context.userId);

    const { data: row, error } = await supabaseAdmin
      .from("likeness_locks" as never)
      .insert({
        user_id: context.userId,
        name: data.name.trim(),
        primary_path: data.primaryPath,
        extra_paths: data.extraPaths ?? [],
        spec: { description: description ?? "" },
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as LikenessRow;
  });

// ─── List / Delete ───────────────────────────────────────────────────────────

export const listLikenesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("likeness_locks" as never)
      .select("*")
      .eq("user_id" as never, context.userId)
      .order("created_at" as never, { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as LikenessRow[];
    return await Promise.all(
      rows.map(async (r) => {
        try {
          return { ...r, signedUrl: await signPath(r.primary_path) } as LikenessWithUrl;
        } catch {
          return { ...r, signedUrl: "" } as LikenessWithUrl;
        }
      }),
    );
  });

export const deleteLikeness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: row, error: fErr } = await supabaseAdmin
      .from("likeness_locks" as never)
      .select("primary_path")
      .eq("id" as never, data.id)
      .eq("user_id" as never, context.userId)
      .maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!row) throw new Error("Likeness not found");

    const { error: delErr } = await supabaseAdmin
      .from("likeness_locks" as never)
      .delete()
      .eq("id" as never, data.id)
      .eq("user_id" as never, context.userId);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });

// ─── Run shoot ───────────────────────────────────────────────────────────────

export type ShootResult = {
  shotId: string;
  label: string;
  beat: ShootShot["beat"];
  status: "succeeded" | "failed";
  url?: string;
  generationId?: string;
  error?: string;
};

const RunShootSchema = z.object({
  likenessId: z.string().uuid(),
  wardrobe: z.string().min(4).max(500),
  scene: z.string().min(4).max(500),
  song: z.string().max(200).optional(),
  bpm: z.number().int().min(40).max(220).optional(),
  shotIds: z.array(z.string().min(1).max(60)).min(1).max(LIKENESS_MAX_SHOTS),
});

export const runLikenessShoot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RunShootSchema.parse(d))
  .handler(async ({ context, data }): Promise<{ results: ShootResult[] }> => {
    const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");

    const { data: row, error } = await supabaseAdmin
      .from("likeness_locks" as never)
      .select("*")
      .eq("id" as never, data.likenessId)
      .eq("user_id" as never, context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Likeness not found");
    const lock = row as LikenessRow;

    const refUrl = await signPath(lock.primary_path, 3600);
    const spec = lock.spec?.description ?? null;
    const brief: ShootBrief = {
      wardrobe: data.wardrobe.trim(),
      scene: data.scene.trim(),
      song: data.song?.trim() || undefined,
      bpm: data.bpm,
    };

    const shots = data.shotIds
      .map((id) => SHOOT_DECK.find((s) => s.id === id))
      .filter((s): s is ShootShot => !!s);
    if (shots.length === 0) throw new Error("No valid shots selected");

    const settled = await Promise.allSettled(
      shots.map((shot) =>
        reserveOrchestrateRecord({
          userId: context.userId,
          kind: "image",
          prompt: `[Likeness shoot / ${shot.label}] ${buildShotPrompt(shot, brief, spec)}`,
          model: LIKENESS_MODEL,
          imageUrls: [refUrl],
          cost: LIKENESS_COST_PER_IMAGE,
          reason: "likeness_shoot",
        }),
      ),
    );

    const results: ShootResult[] = settled.map((outcome, i) => {
      const shot = shots[i];
      const meta = { shotId: shot.id, label: shot.label, beat: shot.beat };
      if (outcome.status === "rejected") {
        const err = outcome.reason instanceof Error ? outcome.reason.message : "Render failed";
        return { ...meta, status: "failed", error: err };
      }
      const r = outcome.value;
      if (!r.ok) return { ...meta, status: "failed", error: r.error };
      return { ...meta, status: "succeeded", url: r.url, generationId: r.generationId };
    });

    return { results };
  });
