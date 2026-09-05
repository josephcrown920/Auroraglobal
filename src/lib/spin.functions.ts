import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAdmin } from "./admin.server";
import { z } from "zod";
import { orchestrate } from "./orchestrator.server";
import { fetchToBytes } from "./replicate.server";
import { compressImageBytes } from "./compress.server";
import { assertTrustedUrl, assertOwnedReferenceImage } from "./url-guard";
import { listAvatars } from "./mcp/avatars.server";
import { routedGenerate } from "./ai-router";
import { hfTextToSpeech } from "./hf.server";
import { UGC_TTS_MODEL } from "./ugc.server";
import {
  SPIN_COUNT,
  SPIN_PIECE_COST,
  SPIN_VIDEO_PIECE_COST,
  SPIN_VIDEO_DURATION_SECONDS,
  SPIN_VIDEO_MODEL,
  SPIN_VIDEO_LIPSYNC_MODEL,
  SPIN_VIDEO_COST,
  SPIN_CLIP_MODEL,
  SPIN_CLIP_DURATION,
  spinTotalCost,
  assignVideoSlots,
  VIRAL_SYSTEM_PROMPT,
  SpinPlanSchema,
  SPIN_TEMPLATES,
  buildFallbackSpecs,
  normalizeSpecs,
  buildVariantPrompt,
  buildVariantVideoMotionPrompt,
  specLabel,
  type SpinSpec,
  type SpinSpecWithVideo,
  type SpinTemplateId,
  type SpinMode,
} from "./spin-engine";

// 10 Aura per spin piece — shared client-safe constant (also drives the cost
// labels on /spin and the template cards). Charged upfront for all SPIN_COUNT
// pieces before the job is created; each successful render reuses that upfront
// charge (no second reservation), and each FAILED render refunds its 10 Aura,
// so the batch never over-charges.
const COST_SPIN_PIECE = SPIN_PIECE_COST;

// Gemini 3.1 Flash Image — the same identity-preserving model the reshoot tool
// uses (RESHOOT_MODEL). nano-banana behaved as a light image-EDIT model: with a
// tight face reference it anchored to the reference framing and returned
// near-identical low-res face crops, ignoring each spec's scene/outfit/location.
// The face reference is passed as imageUrls so every varied scene stays locked
// to one identity; dispatch is via the direct Gemini API adapter with an
// identity-preserving fal edit-endpoint fallback (orchestrator.server.ts).
const IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";

// Legacy export kept for any importer that still references it (the count is now
// driven by SPIN_COUNT in spin-engine). No longer used to build variants.
export { SPIN_COUNT };

// The new spin columns (spec/prompt/kind/face_url/avatar_id) aren't in the
// generated Supabase types yet, so use a narrow loose-typed handle — same
// precedent as avatars.server.ts.
type LooseResult = { data: unknown; count?: number | null; error: { message: string } | null };
interface LooseChain {
  select(cols?: string, opts?: { count?: "exact"; head?: boolean }): LooseChain;
  insert(rows: unknown): LooseChain;
  update(vals: unknown): LooseChain;
  delete(): LooseChain;
  upsert(rows: unknown, opts?: Record<string, unknown>): LooseChain;
  eq(col: string, val: unknown): LooseChain;
  neq(col: string, val: unknown): LooseChain;
  in(col: string, vals: unknown[]): LooseChain;
  not(col: string, op: string, val: unknown): LooseChain;
  gte(col: string, val: unknown): LooseChain;
  lt(col: string, val: unknown): LooseChain;
  is(col: string, val: unknown): LooseChain;
  or(filter: string): LooseChain;
  order(col: string, opts?: { ascending?: boolean }): LooseChain;
  limit(n: number): LooseChain;
  maybeSingle(): Promise<LooseResult>;
  single(): Promise<LooseResult>;
  then<T>(onfulfilled?: ((value: LooseResult) => T | PromiseLike<T>) | null): Promise<T>;
}
type LooseClient = { from: (table: string) => LooseChain };

// Same pattern as jobs.server.ts's private uploadBytesToStudio — used here only
// to stash the ONE shared TTS audio track for a Video Mode batch. `orchestrate`
// re-signs private studio refs before handing them to a provider.
async function uploadBytesToStudio(path: string, bytes: Uint8Array | Buffer, contentType: string): Promise<string> {
  const { error } = await supabaseAdmin.storage.from("studio").upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`studio upload failed: ${error.message}`);
  return supabaseAdmin.storage.from("studio").getPublicUrl(path).data.publicUrl;
}

// ─── Smoke-test helper ────────────────────────────────────────────────────────
/**
 * Creates a 1-variant spin job, renders the single piece via the EXACT
 * production renderSpinPiece path (same orchestrate() call, same studio
 * upload), then marks it done. Admin callers bypass credit deduction.
 * Used only by the smoke test runner — not exposed to any public route.
 */
export async function runSmokeSpinOne(
  userId: string,
  faceUrl: string,
): Promise<{ url: string; provider: string; jobId: string; variantId: string }> {
  const db = supabaseAdmin as unknown as LooseClient;
  const base = "smoke test: confident creator lifestyle post";
  const spec = buildFallbackSpecs(base, 1, "default")[0];
  const prompt = buildVariantPrompt(spec, {
    base,
    triggerWord: null,
    avatarName: null,
    templateId: "default",
  });

  // 1. Create a minimal spin_jobs row (no credit charge — caller is admin).
  const { data: jobRaw } = await db
    .from("spin_jobs")
    .insert({
      user_id: userId,
      prompt: base,
      total: 1,
      status: "running",
      avatar_id: null,
      face_url: faceUrl,
      mode: "photo",
      script: null,
      product_url: null,
      audio_url: null,
    })
    .select("id")
    .single();
  const job = jobRaw as { id: string } | null;
  if (!job) throw new Error("smoke: failed to create spin job");

  // 2. Enqueue 1 variant (same columns spinThirty uses).
  const { data: insertedRowRaw } = await db
    .from("spin_variants")
    .insert([{
      job_id: job.id,
      user_id: userId,
      idx: 0,
      label: specLabel(spec),
      status: "queued",
      kind: "image",
      spec,
      prompt,
    }])
    .select("id")
    .single();
  const insertedRow = insertedRowRaw as { id: string } | null;
  if (!insertedRow) throw new Error("smoke: failed to create spin variant");

  // 3. Claim the variant via the same CAS the tick functions use.
  const { data: claimedRaw } = await db
    .from("spin_variants")
    .update({ status: "running" })
    .eq("id", insertedRow.id)
    .eq("status", "queued")
    .select("id,idx,label,prompt,spec");
  const claimed0 = (claimedRaw ?? []) as SpinPiece[];
  if (!claimed0.length) throw new Error("smoke: failed to claim spin variant");

  // 4. Render via the production renderSpinPiece function.
  const ctx: SpinJobCtx = {
    jobId: job.id,
    userId,
    mode: "photo",
    faceUrl,
    productUrl: null,
    audioUrl: null,
  };
  const piece: SpinPiece = {
    id: insertedRow.id,
    idx: 0,
    label: specLabel(spec),
    prompt,
  };
  const { publicUrl, provider } = await renderSpinPiece(ctx, piece);

  // 5. Mark done (same fence logic as production).
  await db
    .from("spin_variants")
    .update({ status: "done", url: publicUrl })
    .eq("id", insertedRow.id)
    .eq("status", "running");
  await db.from("spin_jobs").update({ status: "done" }).eq("id", job.id);

  return { url: publicUrl, provider, jobId: job.id, variantId: insertedRow.id };
}

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
    return { count: SPIN_COUNT, avatars, templates: SPIN_TEMPLATES };
  });

// ─── Start a batch ───────────────────────────────────────────────────────────

const TEMPLATE_IDS = SPIN_TEMPLATES.map((t) => t.id) as [SpinTemplateId, ...SpinTemplateId[]];

const SpinInput = z.object({
  prompt: z.string().min(1).max(2000),
  avatarId: z.string().uuid().optional(),
  // A reference photo the user just uploaded, used directly to lock identity
  // across all SPIN_COUNT posts — no separate "create an avatar" step
  // required. Takes priority over avatarId when both are somehow present.
  faceUrl: z.string().url().optional(),
  templateId: z.enum(TEMPLATE_IDS).optional().default("default"),
  // Video Mode: 30 talking-portrait videos instead of 30 stills. Restricted to
  // the Product Showcase template only — see spin-engine.ts SPIN_VIDEO_PIECE_COST
  // for why (a real held-object anchor is required for the identity+product lock
  // across every clip). Enforced server-side below, never trusted from the client.
  mode: z.enum(["photo", "video"]).optional().default("photo"),
  script: z.string().trim().min(1).max(600).optional(),
  productUrl: z.string().url().optional(),
  // Per-variant video slider: 0–50 posts rendered as short i2v clips (budget
  // seedance-2.0-fast, 5 Aura each) instead of stills. Orthogonal to `mode`
  // (which controls the premium Product Showcase video pipeline). Only applies
  // when mode === "photo" — ignored for the full video mode batch.
  videoCount: z.number().int().min(0).max(SPIN_COUNT).default(0),
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
    if (data.faceUrl) {
      // Direct reference photo the user just uploaded — no saved avatar
      // required. Must be their own upload (studio bucket), not an arbitrary
      // remote URL, or this becomes an SSRF/impersonation vector.
      await assertOwnedReferenceImage(data.faceUrl, userId);
      faceUrl = data.faceUrl;
    } else if (data.avatarId) {
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

    // Video Mode is restricted to the Product Showcase template — enforced
    // server-side (never trust the client). This mirrors the requiresHeldObject
    // flag: a talking product-in-hand video needs the exact held-object anchor
    // that only that template's pose bank + prompt guarantee.
    const mode: SpinMode = data.mode ?? "photo";
    if (mode === "video") {
      if (data.templateId !== "product_showcase") {
        throw new Error("Video Mode is only available for the Product Showcase template.");
      }
      if (!data.script) throw new Error("Video Mode requires a script for the avatar to speak.");
      if (!data.productUrl) throw new Error("Video Mode requires a product photo.");
      assertTrustedUrl(data.productUrl); // SSRF guard before this reaches any provider
    }
    const script = mode === "video" ? (data.script as string).trim() : null;
    const productUrl = mode === "video" ? (data.productUrl as string) : null;

    // Generate the spoken-audio track ONCE for the whole batch — every one of
    // the 30 clips speaks the identical script, only the visuals vary — so we
    // synthesize a single track up front and reuse it across every lip-sync
    // stage at tick time, instead of paying for 30 redundant TTS calls.
    // Failing BEFORE any credits are charged: a premium video batch must never
    // silently degrade to a talking-but-mute clip after the user already paid.
    let audioUrl: string | null = null;
    if (mode === "video" && script) {
      if (!process.env.HF_TOKEN) {
        throw new Error("Video Mode needs voice synthesis configured (missing HF_TOKEN). Contact support.");
      }
      try {
        const tts = await hfTextToSpeech(UGC_TTS_MODEL, script);
        audioUrl = await uploadBytesToStudio(
          `${userId}/spin/audio/${crypto.randomUUID()}.flac`,
          Buffer.from(tts.bytes),
          tts.contentType,
        );
      } catch (e) {
        throw new Error(`Failed to synthesize the script's voice track: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Charge credits upfront for every piece. deduct_credits is a single atomic
    // SQL UPDATE (WHERE credits >= _amount RETURNING) — no double-spend possible.
    // Admins bypass the charge entirely, consistent with all other charge points.
    // Video Mode pieces are priced through the real stacked engine (image +
    // premium video + premium lip-sync at 15s) — see SPIN_VIDEO_PIECE_COST.
    // Slider-mode video pieces cost SPIN_VIDEO_COST each (budget i2v).
    const effectiveVideoCount = mode === "video" ? 0 : Math.min(data.videoCount ?? 0, SPIN_COUNT);
    const costPerPiece = mode === "video" ? SPIN_VIDEO_PIECE_COST : COST_SPIN_PIECE;
    const spinCost =
      mode === "video"
        ? SPIN_COUNT * costPerPiece
        : spinTotalCost(SPIN_COUNT - effectiveVideoCount, effectiveVideoCount);
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
          _actor: null,
        });
      }
    };

    // Fan the single idea out into SPIN_COUNT genuinely-varied post specs.
    // LLM first (viral engine prompt), deterministic fallback on ANY failure so
    // the feature never regresses to near-identical outputs.
    const templateId = data.templateId;
    const template = SPIN_TEMPLATES.find((t) => t.id === templateId);
    const base = data.prompt.trim();
    let specs: SpinSpec[];
    try {
      const { output } = await routedGenerate({
        system: VIRAL_SYSTEM_PROMPT,
        prompt:
          `Creator: ${avatarName ?? "one single creator"} — keep the EXACT same person (same face/identity) in every post. ` +
          `Topic / hook idea: "${base}". Platform: TikTok / Reels / Shorts. ` +
          (template && template.id !== "default"
            ? `Template aesthetic: "${template.label}" — ${template.blurb} Every outfit, location and pose choice must fit this aesthetic. `
            : "") +
          (template?.requiresHeldObject
            ? "The reference photo shows the creator holding a specific product — every post must keep that exact same product visibly in her hand/frame, varying only outfit/location/angle/pose around it. "
            : "") +
          (effectiveVideoCount > 0
            ? `${effectiveVideoCount} of the ${SPIN_COUNT} posts will be rendered as short VIDEO CLIPS — prefer these content types for those slots: Talking-head hook, POV scenario, Behind-the-scenes, Story-style post. The remaining ${SPIN_COUNT - effectiveVideoCount} will be STILL IMAGES — prefer: Carousel cover, Caption hook visual, Meme edit. `
            : "") +
          `Generate exactly ${SPIN_COUNT} unique posts with MAXIMUM variation as JSON.`,
        schema: SpinPlanSchema,
        category: "SOCIAL_CONTENT",
      });
      specs = normalizeSpecs(output.posts ?? [], base, SPIN_COUNT, templateId);
    } catch {
      specs = buildFallbackSpecs(base, SPIN_COUNT, templateId);
    }

    const { data: jobRaw2, error } = await db
      .from("spin_jobs")
      .insert({
        user_id: userId,
        prompt: base,
        total: SPIN_COUNT,
        status: "running",
        avatar_id: avatarId,
        face_url: faceUrl,
        mode,
        script,
        product_url: productUrl,
        audio_url: audioUrl,
      })
      .select("id")
      .single();
    const job = jobRaw2 as { id: string } | null;
    if (error || !job) {
      await refund();
      throw new Error(error?.message ?? "Failed to create spin job");
    }

    // Assign video slots for the slider feature (photo mode only).
    // In video mode all variants are already "video" (premium pipeline).
    const specsWithVideo: SpinSpecWithVideo[] =
      mode === "video" ? specs : assignVideoSlots(specs, effectiveVideoCount);

    const rows = specsWithVideo.map((spec, idx) => ({
      job_id: job.id,
      user_id: userId,
      idx,
      label: specLabel(spec),
      status: "queued" as const,
      kind: mode === "video" ? "video" : spec.isVideo ? "video" : "image",
      spec,
      prompt: buildVariantPrompt(spec, { base, triggerWord, avatarName, templateId }),
    }));
    const { error: vErr } = await db.from("spin_variants").insert(rows);
    if (vErr) {
      await refund();
      throw new Error(vErr.message);
    }
    return { jobId: job.id };
  });

// ─── Poll ──────────────────────────────────────────────────────────────────

export const getSpinJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: job }, { data: variantRows }] = await Promise.all([
      supabase
        .from("spin_jobs")
        .select("id,status,user_id,mode,face_url,product_url,audio_url")
        .eq("id", data.jobId)
        .single(),
      supabase
        .from("spin_variants")
        .select("id,idx,label,status,url,spec,kind")
        .eq("job_id", data.jobId)
        .order("idx", { ascending: true }),
    ]);
    if (!job) throw new Error("Job not found");
    return { job, variants: variantRows ?? [] };
  });

// ─── Cron-driven continuation (admin-scoped, no browser tab required) ───────
// tickSpinJob above only ever runs while a browser tab is open and driving the
// poll loop in spin.tsx — close the tab, background it, or lose the network
// mid-batch and the job stalls forever at whatever count it reached (confirmed
// live: a job left at "queued" for every variant, hours after being started).
// This admin-scoped twin does the same claim → orchestrate → finalize work but
// sweeps ALL users' "running" spin_jobs, so the existing per-minute
// `/api/public/jobs/tick` cron (already scheduled via pg_cron) keeps every
// batch moving to completion even if nobody is looking at /spin.
export async function advanceSpinQueueAdmin(
  maxJobs = 5,
  batchPerJob = 3,
): Promise<{ jobsAdvanced: number; variantsProcessed: number }> {
  const db = supabaseAdmin as unknown as LooseClient;

  // Reclaim variants stuck "running" for >3 min across every job (a server
  // died mid-render) so they get picked up again below.
  const staleCutoff = new Date(Date.now() - 3 * 60_000).toISOString();
  await db
    .from("spin_variants")
    .update({ status: "queued" })
    .eq("status", "running")
    .lt("updated_at", staleCutoff);

  const { data: runningJobs } = await db
    .from("spin_jobs")
    .select("id,user_id,face_url,mode,product_url,audio_url")
    .eq("status", "running")
    .order("created_at", { ascending: true })
    .limit(maxJobs);

  let jobsAdvanced = 0;
  let variantsProcessed = 0;

  for (const job of (runningJobs ?? []) as {
    id: string;
    user_id: string;
    face_url: string | null;
    mode: SpinMode | null;
    product_url: string | null;
    audio_url: string | null;
  }[]) {
    let faceUrl: string | null = job.face_url ?? null;
    if (faceUrl) {
      try {
        assertTrustedUrl(faceUrl);
      } catch {
        faceUrl = null;
      }
    }
    let productUrl: string | null = job.product_url ?? null;
    if (productUrl) {
      try {
        assertTrustedUrl(productUrl);
      } catch {
        productUrl = null;
      }
    }
    const mode: SpinMode = job.mode ?? "photo";
    const ctx: SpinJobCtx = { jobId: job.id, userId: job.user_id, mode, faceUrl, productUrl, audioUrl: job.audio_url ?? null };

    const { data: pendingRaw } = await db
      .from("spin_variants")
      .select("id,idx,label,prompt,spec,kind")
      .eq("job_id", job.id)
      .eq("status", "queued")
      .order("idx", { ascending: true })
      .limit(batchPerJob);
    const pending = (pendingRaw ?? []) as SpinPiece[];

    if (pending.length === 0) {
      const { count: remaining } = await db
        .from("spin_variants")
        .select("id", { count: "exact", head: true })
        .eq("job_id", job.id)
        .in("status", ["queued", "running"]);
      if ((remaining ?? 0) === 0) {
        await db.from("spin_jobs").update({ status: "done" }).eq("id", job.id);
        jobsAdvanced += 1;
      }
      continue;
    }

    const { data: claimedRows } = await db
      .from("spin_variants")
      .update({ status: "running" })
      .in(
        "id",
        pending.map((p) => p.id),
      )
      .eq("status", "queued")
      .select("id,idx,label,prompt,spec,kind");
    const claimed = (claimedRows ?? []) as SpinPiece[];
    if (claimed.length === 0) continue;
    jobsAdvanced += 1;

    await Promise.allSettled(
      claimed.map(async (p) => {
        variantsProcessed += 1;
        const variantCost =
          mode === "video"
            ? SPIN_VIDEO_PIECE_COST
            : p.kind === "video"
              ? SPIN_VIDEO_COST
              : COST_SPIN_PIECE;
        try {
          const { publicUrl, provider, kind } = await renderSpinPiece(ctx, p);

          const { data: won } = await db
            .from("spin_variants")
            .update({ status: "done", url: publicUrl })
            .eq("id", p.id)
            .eq("status", "running")
            .select("id");
          if (((won ?? []) as { id: string }[]).length > 0) {
            await supabaseAdmin.from("generations").insert({
              user_id: job.user_id,
              prompt: p.prompt ?? "",
              kind,
              mode: "performance",
              status: "succeeded",
              model: provider,
              input_images: faceUrl ? [faceUrl] : [],
              // Route to the correct URL column based on media type so the
              // gallery renders images and plays videos correctly.
              ...(kind === "video"
                ? { result_video_url: publicUrl }
                : { result_image_url: publicUrl }),
              credits_cost: variantCost,
            } as never);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "render failed";
          const { data: lost } = await db
            .from("spin_variants")
            .update({ status: "error", error: msg })
            .eq("id", p.id)
            .eq("status", "running")
            .select("id");
          if (((lost ?? []) as { id: string }[]).length > 0) {
            const admin = await isAdmin(job.user_id);
            if (!admin) {
              await supabaseAdmin.rpc("grant_credits", {
                _user: job.user_id,
                _amount: variantCost,
                _reason: "refund_failed_generation",
                _ref: p.id,
                _actor: null,
              });
            }
          }
        }
      }),
    );
  }

  return { jobsAdvanced, variantsProcessed };
}

// ─── Piece renderer (shared by tickSpinJob + advanceSpinQueueAdmin) ─────────
// Photo mode: one identity-locked image via the orchestrator.
// Video mode (Product Showcase only): a real 3-stage render per piece —
// styled still (image, face+product refs) → image→video (forced premium
// model, 15s) → lip-sync onto the ONE shared script audio (forced premium
// model) — mirroring runUGCAd's pipeline in jobs.server.ts. Every stage is
// required; a lip-sync failure throws rather than silently shipping a mute
// clip, since the piece was charged the full premium video price.
type SpinJobCtx = {
  jobId: string;
  userId: string;
  mode: SpinMode;
  faceUrl: string | null;
  productUrl: string | null;
  audioUrl: string | null;
};
type SpinPiece = {
  id: string;
  idx: number;
  label: string;
  prompt: string | null;
  spec?: SpinSpec | null;
  kind?: "image" | "video" | null;
};

async function renderSpinPiece(
  ctx: SpinJobCtx,
  piece: SpinPiece,
): Promise<{ publicUrl: string; provider: string; kind: "image" | "video" }> {
  const refImages = [ctx.faceUrl, ctx.productUrl].filter((u): u is string => !!u);
  const variantKind = piece.kind ?? (ctx.mode === "video" ? "video" : "image");

  if (ctx.mode !== "video" && variantKind !== "video") {
    // Standard photo mode — render as an identity-locked still. editStrict
    // constrains fallback to edit-capable models only: a text-to-image
    // fallback (seedream/pollinations/t2i GPU pool) would ignore the face
    // reference and silently ship a stranger. Failing is better.
    const out = await orchestrate({
      kind: "image",
      model: IMAGE_MODEL,
      prompt: piece.prompt || piece.label,
      imageUrls: refImages.length ? refImages : undefined,
      editStrict: refImages.length > 0,
      userId: ctx.userId,
      refId: piece.id,
    });
    const { bytes: rawBytes, mime: rawMime } = await fetchToBytes(out.url);
    const img = await compressImageBytes(rawBytes, rawMime || "image/png");
    const path = `${ctx.userId}/spin/${ctx.jobId}/${piece.idx}.${img.ext}`;
    const publicUrl = await uploadBytesToStudio(path, img.bytes, img.mime);
    return { publicUrl, provider: out.provider, kind: "image" };
  }

  if (ctx.mode !== "video" && variantKind === "video") {
    // Slider-mode i2v: render the still first, then animate it as a short clip.
    // No lipsync — this is the budget path (seedance-2.0-fast, 5 Aura).
    const still = await orchestrate({
      kind: "image",
      model: IMAGE_MODEL,
      prompt: piece.prompt || piece.label,
      imageUrls: ctx.faceUrl ? [ctx.faceUrl] : undefined,
      editStrict: !!ctx.faceUrl,
      userId: ctx.userId,
      refId: piece.id,
    });
    const clip = await orchestrate({
      kind: "video",
      model: SPIN_CLIP_MODEL,
      prompt: piece.spec ? `${piece.spec.motion} ${piece.spec.scene}` : `Short ${SPIN_CLIP_DURATION}s clip: ${piece.label}`,
      imageUrls: [still.url],
      duration: SPIN_CLIP_DURATION,
      userId: ctx.userId,
      refId: piece.id,
      // Seedance adapters gate on forSubscriber:true — set it so the pinned
      // model is actually eligible. pinnedModelOnly prevents silent fallback
      // to an unrelated video provider if Seedance is temporarily unavailable.
      forSubscriber: true,
      pinnedModelOnly: true,
    });
    const { bytes, mime } = await fetchToBytes(clip.url);
    const ext = mime.includes("webm") ? "webm" : "mp4";
    const path = `${ctx.userId}/spin/${ctx.jobId}/${piece.idx}.${ext}`;
    const publicUrl = await uploadBytesToStudio(path, bytes, mime || "video/mp4");
    return { publicUrl, provider: clip.provider, kind: "video" };
  }

  if (!ctx.audioUrl) throw new Error("video mode requires a shared script audio track");

  // Stage 1 — styled still holding the product (identity + product locked).
  const still = await orchestrate({
    kind: "image",
    model: IMAGE_MODEL,
    prompt: piece.prompt || piece.label,
    imageUrls: refImages.length ? refImages : undefined,
    editStrict: refImages.length > 0,
    userId: ctx.userId,
    refId: piece.id,
  });

  // Stage 2 — animate the still (forced premium model, fixed 15s — no per-piece mixing).
  const motionPrompt = piece.spec ? buildVariantVideoMotionPrompt(piece.spec) : `Animate this photo: ${piece.label}.`;
  const clip = await orchestrate({
    kind: "video",
    model: SPIN_VIDEO_MODEL,
    prompt: motionPrompt,
    imageUrls: [still.url],
    duration: SPIN_VIDEO_DURATION_SECONDS,
    userId: ctx.userId,
    refId: piece.id,
  });

  // Stage 3 — lip-sync the shared script audio onto the clip (forced premium model).
  const final = await orchestrate({
    kind: "lipsync",
    model: SPIN_VIDEO_LIPSYNC_MODEL,
    videoUrl: clip.url,
    audioUrl: ctx.audioUrl,
    userId: ctx.userId,
    refId: piece.id,
  });

  const { bytes, mime } = await fetchToBytes(final.url);
  const ext = mime.includes("webm") ? "webm" : "mp4";
  const path = `${ctx.userId}/spin/${ctx.jobId}/${piece.idx}.${ext}`;
  const publicUrl = await uploadBytesToStudio(path, bytes, mime || "video/mp4");
  return { publicUrl, provider: final.provider, kind: "video" };
}

// ─── Render the next batch ───────────────────────────────────────────────────
// Picks up to `batch` queued variants, renders each as a real identity-locked
// image (varied scene) via the orchestrator, persists it to the studio bucket
// (provider URLs expire), and records a generations row for cost accounting.
// One bad render only errors THAT variant (and refunds its 10 Aura) — never the
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

    // Load the job for its face/product references, re-validating the stored
    // URLs (they round-trip through the DB before reaching a provider).
    type SpinJobRow2 = { id: string; face_url: string | null; mode: string | null; product_url: string | null; audio_url: string | null };
    const { data: jobRaw3 } = await db
      .from("spin_jobs")
      .select("id,face_url,mode,product_url,audio_url")
      .eq("id", data.jobId)
      .eq("user_id", userId)
      .single();
    const job3 = jobRaw3 as SpinJobRow2 | null;
    if (!job3) throw new Error("Job not found");
    let faceUrl: string | null = job3.face_url ?? null;
    if (faceUrl) {
      try {
        assertTrustedUrl(faceUrl);
      } catch {
        faceUrl = null;
      }
    }
    let productUrl: string | null = job3.product_url ?? null;
    if (productUrl) {
      try {
        assertTrustedUrl(productUrl);
      } catch {
        productUrl = null;
      }
    }
    const mode: SpinMode = (job3.mode as SpinMode | null) ?? "photo";
    const ctx: SpinJobCtx = {
      jobId: data.jobId,
      userId,
      mode,
      faceUrl,
      productUrl,
      audioUrl: job3.audio_url ?? null,
    };

    const { data: pendingRaw2 } = await db
      .from("spin_variants")
      .select("id,idx,label,prompt,spec,kind")
      .eq("job_id", data.jobId)
      .eq("user_id", userId)
      .eq("status", "queued")
      .order("idx", { ascending: true })
      .limit(data.batch);
    const pending2 = (pendingRaw2 ?? []) as SpinPiece[];

    if (pending2.length === 0) {
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

    // Atomically CLAIM the batch (compare-and-swap on status). If two tabs or
    // devices drive the same job — the resumable jobId-in-URL invites this —
    // only one claimer wins each row; the loser gets zero rows back and simply
    // polls again. This is what prevents double provider spend / double refunds.
    const { data: claimedRows } = await db
      .from("spin_variants")
      .update({ status: "running" })
      .in(
        "id",
        pending2.map((p) => p.id),
      )
      .eq("status", "queued")
      .select("id,idx,label,prompt,spec,kind");
    const claimed = (claimedRows ?? []) as SpinPiece[];
    if (claimed.length === 0) return { processed: 0, done: false };

    await Promise.allSettled(
      claimed.map(async (p) => {
        // Per-variant cost: premium video mode = SPIN_VIDEO_PIECE_COST; slider
        // video variant = SPIN_VIDEO_COST; image variant = COST_SPIN_PIECE.
        const variantCost =
          mode === "video"
            ? SPIN_VIDEO_PIECE_COST
            : p.kind === "video"
              ? SPIN_VIDEO_COST
              : COST_SPIN_PIECE;
        try {
          const { publicUrl, provider, kind } = await renderSpinPiece(ctx, p);

          // FINALIZE with a status fence: only the worker that flips
          // running → done records the generation. If this render raced a
          // stale-reclaim (another worker re-claimed and finished first), the
          // CAS returns zero rows and we record nothing — no double counting.
          const { data: won } = await db
            .from("spin_variants")
            .update({ status: "done", url: publicUrl })
            .eq("id", p.id)
            .eq("status", "running")
            .select("id");
          if (((won ?? []) as { id: string }[]).length > 0) {
            // Record the generation so the admin cost dashboard stays accurate
            // (the piece was already deducted upfront — no second charge here).
            await supabaseAdmin.from("generations").insert({
              user_id: userId,
              prompt: p.prompt ?? "",
              kind,
              mode: "performance",
              status: "succeeded",
              model: provider,
              input_images: faceUrl ? [faceUrl] : [],
              // Route to the correct URL column based on media type so the
              // gallery renders images and plays videos correctly.
              ...(kind === "video"
                ? { result_video_url: publicUrl }
                : { result_image_url: publicUrl }),
              credits_cost: variantCost,
            } as never);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : "render failed";
          // Same fence on the failure path: refund ONLY if we won the terminal
          // write — a raced duplicate must never mint a second refund.
          const { data: lost } = await db
            .from("spin_variants")
            .update({ status: "error", error: msg })
            .eq("id", p.id)
            .eq("status", "running")
            .select("id");
          if (!adminUser && ((lost ?? []) as { id: string }[]).length > 0) {
            await supabaseAdmin.rpc("grant_credits", {
              _user: userId,
              _amount: variantCost,
              _reason: "refund_failed_generation",
              _ref: p.id,
              _actor: null,
            });
          }
        }
      }),
    );

    return { processed: claimed.length, done: false };
  });
