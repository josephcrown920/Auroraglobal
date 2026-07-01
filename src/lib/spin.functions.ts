import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAdmin } from "./admin.server";
import { z } from "zod";
import { orchestrate } from "./orchestrator.server";
import { fetchToBytes } from "./replicate.server";
import { assertTrustedUrl } from "./url-guard";
import { listAvatars } from "./mcp/avatars.server";
import { generateWithFallback } from "./llm-fallback.server";
import {
  SPIN_COUNT,
  VIRAL_SYSTEM_PROMPT,
  SpinPlanSchema,
  buildFallbackSpecs,
  normalizeSpecs,
  buildVariantPrompt,
  specLabel,
  type SpinSpec,
} from "./spin-engine";

// 1 Aura per spin piece — matches COST_IMAGE in studio.functions.ts.
// Charged upfront for all SPIN_COUNT pieces before the job is created; each
// successful render reuses that upfront charge (no second reservation), and each
// FAILED render refunds its 1 Aura, so the batch never over-charges.
const COST_SPIN_PIECE = 1;

// Nano Banana (Gemini 2.5 Flash image) — runs on the Replicate key alone and is
// the same default the Performance Shot studio uses. The face reference is passed
// as imageUrls so every varied scene stays locked to one identity.
const IMAGE_MODEL = "google/nano-banana";

// Legacy export kept for any importer that still references it (the count is now
// driven by SPIN_COUNT in spin-engine). No longer used to build variants.
export { SPIN_COUNT };

// The new spin columns (spec/prompt/kind/face_url/avatar_id) aren't in the
// generated Supabase types yet, so use a narrow loose-typed handle — same
// precedent as avatars.server.ts.
type LooseTable = {
  select: (cols?: string, opts?: { count?: "exact"; head?: boolean }) => any;
  insert: (rows: unknown) => any;
  update: (vals: unknown) => any;
};
type LooseClient = { from: (table: string) => LooseTable };

// ─── Avatar options for the identity picker ──────────────────────────────────

export const getSpinOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    let avatars: { id: string; name: string; previewUrl: string | null }[] = [];
    try {
      const rows = await listAvatars(userId, 50);
      avatars = rows
        .filter((a) => a.preview_url)
        .map((a) => ({ id: a.id, name: a.name, previewUrl: a.preview_url ?? null }));
    } catch {
      avatars = [];
    }
    return { count: SPIN_COUNT, avatars };
  });

// ─── Start a batch ───────────────────────────────────────────────────────────

const SpinInput = z.object({
  prompt: z.string().min(1).max(2000),
  avatarId: z.string().uuid().optional(),
});

export const spinThirty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SpinInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = supabase as unknown as LooseClient;

    // Resolve the identity the whole batch is locked to (optional).
    let avatarId: string | null = null;
    let faceUrl: string | null = null;
    let avatarName: string | null = null;
    let triggerWord: string | null = null;
    if (data.avatarId) {
      const avatars = await listAvatars(userId, 50);
      const a = avatars.find((x) => x.id === data.avatarId);
      if (!a) throw new Error("Avatar not found");
      avatarId = a.id;
      avatarName = a.name;
      triggerWord = a.trigger_word ?? null;
      if (a.preview_url) {
        assertTrustedUrl(a.preview_url); // SSRF guard before we ever pass it to a provider
        faceUrl = a.preview_url;
      }
    }

    // Charge credits upfront for every piece. deduct_credits is a single atomic
    // SQL UPDATE (WHERE credits >= _amount RETURNING) — no double-spend possible.
    // Admins bypass the charge entirely, consistent with all other charge points.
    const spinCost = SPIN_COUNT * COST_SPIN_PIECE;
    const creditRef = crypto.randomUUID();
    const adminUser = await isAdmin(userId);
    if (!adminUser) {
      const { data: charged, error: creditErr } = await supabaseAdmin.rpc("deduct_credits", {
        _user: userId,
        _amount: spinCost,
        _reason: "spin_batch",
        _ref: creditRef,
      });
      if (creditErr) throw new Error(creditErr.message);
      if (charged === false) throw new Error("Not enough Aura. Buy more from the Aura panel.");
    }

    const refund = async () => {
      if (!adminUser) {
        await supabaseAdmin.rpc("grant_credits", {
          _user: userId,
          _amount: spinCost,
          _reason: "refund_failed_generation",
          _ref: creditRef,
        });
      }
    };

    // Fan the single idea out into SPIN_COUNT genuinely-varied post specs.
    // LLM first (viral engine prompt), deterministic fallback on ANY failure so
    // the feature never regresses to near-identical outputs.
    const base = data.prompt.trim();
    let specs: SpinSpec[];
    try {
      const { output } = await generateWithFallback({
        system: VIRAL_SYSTEM_PROMPT,
        prompt:
          `Creator: ${avatarName ?? "one single creator"} — keep the EXACT same person (same face/identity) in every post. ` +
          `Topic / hook idea: "${base}". Platform: TikTok / Reels / Shorts. ` +
          `Generate exactly ${SPIN_COUNT} unique posts with MAXIMUM variation as JSON.`,
        schema: SpinPlanSchema,
      });
      specs = normalizeSpecs(output.posts ?? [], base, SPIN_COUNT);
    } catch {
      specs = buildFallbackSpecs(base, SPIN_COUNT);
    }

    const { data: job, error } = await db
      .from("spin_jobs")
      .insert({
        user_id: userId,
        prompt: base,
        total: SPIN_COUNT,
        status: "running",
        avatar_id: avatarId,
        face_url: faceUrl,
      })
      .select("id")
      .single();
    if (error || !job) {
      await refund();
      throw new Error(error?.message ?? "Failed to create spin job");
    }

    const rows = specs.map((spec, idx) => ({
      job_id: job.id,
      user_id: userId,
      idx,
      label: specLabel(spec),
      status: "queued" as const,
      kind: "image",
      spec,
      prompt: buildVariantPrompt(spec, { base, triggerWord, avatarName }),
    }));
    const { error: vErr } = await db.from("spin_variants").insert(rows);
    if (vErr) {
      await refund();
      throw new Error(vErr.message);
    }
    return { jobId: job.id as string };
  });

// ─── Poll ──────────────────────────────────────────────────────────────────

export const getSpinJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const db = supabase as unknown as LooseClient;
    const [{ data: job }, { data: variants }] = await Promise.all([
      db.from("spin_jobs").select("*").eq("id", data.jobId).single(),
      db
        .from("spin_variants")
        .select("id,idx,label,status,url,spec,kind")
        .eq("job_id", data.jobId)
        .order("idx", { ascending: true }),
    ]);
    if (!job) throw new Error("Job not found");
    return { job, variants: variants ?? [] };
  });

// ─── Render the next batch ───────────────────────────────────────────────────
// Picks up to `batch` queued variants, renders each as a real identity-locked
// image (varied scene) via the orchestrator, persists it to the studio bucket
// (provider URLs expire), and records a generations row for cost accounting.
// One bad render only errors THAT variant (and refunds its 1 Aura) — never the
// whole batch. The client calls this on an interval until the job is done.
export const tickSpinJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ jobId: z.string().uuid(), batch: z.number().min(1).max(3).default(2) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const db = supabase as unknown as LooseClient;
    const adminUser = await isAdmin(userId);

    // Reclaim variants stuck "running" for >3 min (a server died mid-render).
    const staleCutoff = new Date(Date.now() - 3 * 60_000).toISOString();
    await db
      .from("spin_variants")
      .update({ status: "queued" })
      .eq("job_id", data.jobId)
      .eq("user_id", userId)
      .eq("status", "running")
      .lt("updated_at", staleCutoff);

    // Load the job for its face reference, re-validating the stored URL (it
    // round-trips through the DB before reaching a provider).
    const { data: job } = await db
      .from("spin_jobs")
      .select("id,face_url")
      .eq("id", data.jobId)
      .eq("user_id", userId)
      .single();
    if (!job) throw new Error("Job not found");
    let faceUrl: string | null = (job.face_url as string | null) ?? null;
    if (faceUrl) {
      try {
        assertTrustedUrl(faceUrl);
      } catch {
        faceUrl = null;
      }
    }

    const { data: pending } = await db
      .from("spin_variants")
      .select("id,idx,label,prompt")
      .eq("job_id", data.jobId)
      .eq("user_id", userId)
      .eq("status", "queued")
      .order("idx", { ascending: true })
      .limit(data.batch);

    if (!pending || pending.length === 0) {
      const { count: remaining } = await db
        .from("spin_variants")
        .select("id", { count: "exact", head: true })
        .eq("job_id", data.jobId)
        .in("status", ["queued", "running"]);
      if ((remaining ?? 0) === 0) {
        await db.from("spin_jobs").update({ status: "done" }).eq("id", data.jobId);
      }
      return { processed: 0, done: (remaining ?? 0) === 0 };
    }

    await db
      .from("spin_variants")
      .update({ status: "running" })
      .in(
        "id",
        pending.map((p: { id: string }) => p.id),
      );

    await Promise.allSettled(
      pending.map(async (p: { id: string; idx: number; label: string; prompt: string | null }) => {
        try {
          const out = await orchestrate({
            kind: "image",
            model: IMAGE_MODEL,
            prompt: p.prompt || p.label,
            imageUrls: faceUrl ? [faceUrl] : undefined,
            userId,
            refId: p.id,
          });
          const { bytes, mime } = await fetchToBytes(out.url);
          const ext = (mime || "image/png").split("/")[1]?.split("+")[0] || "png";
          const path = `${userId}/spin/${data.jobId}/${p.idx}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("studio")
            .upload(path, bytes, { contentType: mime || "image/png", upsert: true });
          if (upErr) throw new Error(upErr.message);
          const publicUrl = supabase.storage.from("studio").getPublicUrl(path).data.publicUrl;

          // Record the generation so the admin cost dashboard stays accurate
          // (the 1 Aura was already deducted upfront — no second charge here).
          await supabaseAdmin.from("generations").insert({
            user_id: userId,
            prompt: p.prompt ?? "",
            kind: "image",
            mode: "performance",
            status: "succeeded",
            model: out.provider,
            input_images: faceUrl ? [faceUrl] : [],
            result_image_url: publicUrl,
            credits_cost: COST_SPIN_PIECE,
          } as never);

          await db.from("spin_variants").update({ status: "done", url: publicUrl }).eq("id", p.id);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "render failed";
          await db.from("spin_variants").update({ status: "error", error: msg }).eq("id", p.id);
          // Refund this one piece — the upfront charge already covered it.
          if (!adminUser) {
            await supabaseAdmin.rpc("grant_credits", {
              _user: userId,
              _amount: COST_SPIN_PIECE,
              _reason: "refund_failed_generation",
              _ref: p.id,
            });
          }
        }
      }),
    );

    return { processed: pending.length, done: false };
  });
