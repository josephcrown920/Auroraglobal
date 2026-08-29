// Aurora Soul: character-consistency studio.
//
// Ported from the reference `soulmagic` product (fal-ai/flux-lora-portrait-trainer
// for LoRA training, Flux LoRA inference for identity-locked images, direct
// Seedance API for character video). Everything here bills through Aurora's own
// credit ledger (reserveOrchestrateRecord) — no separate billing provider.
//
// Storage layout:
//   soul-training/<userId>/<soulId>/upload-*      — raw training photos
//   soul-training/<userId>/<soulId>/archive-*.zip — zipped bundle sent to fal
//   soul-generated/<userId>/<soulId>/image-*      — persisted image outputs (best-effort)
// Both buckets are PRIVATE — every read is a short-lived signed URL, never
// `getPublicUrl` (see supabase/migrations/20260826180100_soul_storage_buckets.sql).

import JSZip from "jszip";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { orchestrate } from "@/lib/orchestrator.server";
import { reserveOrchestrateRecord } from "@/lib/generate-core.server";
import {
  soulImageCost,
  soulVideoCost,
  SOUL_IMAGE_MODEL,
  SOUL_VIDEO_MODEL,
  SOUL_TRAINING_COST,
} from "@/lib/pricing";
import { CANONICAL_ORIGIN } from "@/lib/seo";

const MIN_TRAINING_IMAGES = 10;
// A training run that never resolves after this long is surfaced to the user
// as stale (retryable) rather than left silently "training" forever — same
// idea as the stale-pending detection in the soulmagic reference product.
const STALE_TRAINING_MS = 45 * 60_000;

export type SoulRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  trigger_word: string;
  status: "pending" | "training" | "ready" | "failed";
  progress: number;
  error_message: string | null;
  training_image_paths: string[];
  reference_image_paths: string[];
  fal_training_id: string | null;
  lora_url: string | null;
  created_at: string;
  updated_at: string;
};

export type SoulVideoJobRow = {
  id: string;
  user_id: string;
  soul_id: string;
  provider: string;
  model: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  prompt: string;
  aspect_ratio: string;
  duration_secs: number;
  provider_job_id: string | null;
  result_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

// ─── ownership + signing helpers ────────────────────────────────────────────

export async function getOwnedSoul(soulId: string, userId: string): Promise<SoulRow> {
  const { data, error } = await supabaseAdmin
    .from("souls" as never)
    .select("*")
    .eq("id" as never, soulId)
    .eq("user_id" as never, userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Soul not found");
  return data as SoulRow;
}

/** True when a "training" soul has stalled past the stale threshold. */
export function isStaleTraining(soul: SoulRow): boolean {
  if (soul.status !== "training") return false;
  return Date.now() - new Date(soul.updated_at).getTime() > STALE_TRAINING_MS;
}

async function signPath(bucket: "soul-training" | "soul-generated", path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) throw new Error(`sign failed (${bucket}): ${error?.message ?? "no url"}`);
  return data.signedUrl;
}

// ─── credit reservation helpers (training has no `generations` row, so it
// uses plain reserve_credits/commit_reservation/release_reservation rather
// than finalize_sync_render — same pattern as growth-tools.functions.ts's
// non-media LLM jobs) ────────────────────────────────────────────────────────

type CreditRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

async function reserveSoulCredits(userId: string, amount: number, reason: string, ref: string): Promise<boolean> {
  const client = supabaseAdmin as unknown as CreditRpcClient;
  const { data, error } = await client.rpc("reserve_credits", {
    _user: userId,
    _amount: amount,
    _reason: reason,
    _ref: ref,
  });
  if (error) throw new Error(error.message);
  return !!data;
}

async function commitSoulReservation(ref: string): Promise<void> {
  const client = supabaseAdmin as unknown as CreditRpcClient;
  const { error } = await client.rpc("commit_reservation", { _ref: ref });
  if (error) throw new Error(`Failed to commit training credits (reservation ${ref}): ${error.message}`);
}

async function releaseSoulReservation(userId: string, amount: number, reason: string, ref: string): Promise<void> {
  const client = supabaseAdmin as unknown as CreditRpcClient;
  const { error } = await client.rpc("release_reservation", {
    _user: userId,
    _amount: amount,
    _reason: reason,
    _ref: ref,
  });
  // Never swallow a release failure — that is a real credit leak.
  if (error) throw new Error(`Failed to release reservation ${ref}: ${error.message}`);
}

async function defaultDownloadTrainingImage(path: string): Promise<ArrayBuffer | null> {
  const { data, error } = await supabaseAdmin.storage.from("soul-training").download(path);
  if (error || !data) return null;
  return data.arrayBuffer();
}

async function defaultUploadZip(zipPath: string, bytes: ArrayBuffer): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from("soul-training")
    .upload(zipPath, Buffer.from(bytes), { contentType: "application/zip", upsert: true });
  if (error) throw new Error(`zip upload failed: ${error.message}`);
}

async function defaultSignZipUrl(zipPath: string): Promise<string> {
  return signPath("soul-training", zipPath, 6 * 3600);
}

async function defaultUpdateSoul(soulId: string, patch: Record<string, unknown>): Promise<SoulRow> {
  const { data, error } = await supabaseAdmin
    .from("souls" as never)
    .update(patch as never)
    .eq("id" as never, soulId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SoulRow;
}

async function defaultMarkSoulFailed(soulId: string, message: string): Promise<void> {
  await supabaseAdmin
    .from("souls" as never)
    .update({ status: "failed", error_message: message } as never)
    .eq("id" as never, soulId);
}

type SoulClaimClient = {
  from: (t: string) => {
    update: (patch: Record<string, unknown>) => {
      eq: (
        col: string,
        val: string,
      ) => {
        eq: (
          col: string,
          val: string,
        ) => {
          or: (filter: string) => {
            select: (c: string) => { maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }> };
          };
        };
      };
    };
  };
};

/**
 * Atomically transition a Soul (pending / failed / stale-training) into
 * "training". This is a conditional UPDATE, not a read-then-write — two
 * concurrent trainSoul calls for the same Soul can both pass the earlier
 * read-only eligibility check, but only one of these UPDATEs can match a row
 * (the other loses its WHERE clause the instant the first commits), so only
 * one caller ever reserves credits or calls fal for a given Soul. Returns
 * null when this call lost the race — the caller must NOT reserve credits or
 * touch the provider in that case.
 */
async function defaultClaimSoulForTraining(soulId: string, userId: string): Promise<SoulRow | null> {
  const staleCutoff = new Date(Date.now() - STALE_TRAINING_MS).toISOString();
  const client = supabaseAdmin as unknown as SoulClaimClient;
  const { data, error } = await client
    .from("souls")
    .update({ status: "training", progress: 5, error_message: null })
    .eq("id", soulId)
    .eq("user_id", userId)
    .or(`status.eq.pending,status.eq.failed,and(status.eq.training,updated_at.lt.${staleCutoff})`)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SoulRow | null) ?? null;
}

class InsufficientSoulCreditsError extends Error {}

// ─── training ────────────────────────────────────────────────────────────────

export type TrainSoulResult =
  | { ok: true; soul: SoulRow }
  | { ok: false; error: string; insufficient?: boolean };

/**
 * Injectable seams for unit testing the credit-reservation and fal-kickoff
 * decision logic without a live Supabase connection or real provider spend.
 * Every field defaults to the real implementation — callers (soul.functions.ts)
 * never need to pass deps.
 */
export type TrainSoulDeps = {
  getOwnedSoul?: (soulId: string, userId: string) => Promise<SoulRow>;
  claimSoulForTraining?: (soulId: string, userId: string) => Promise<SoulRow | null>;
  reserveCredits?: (userId: string, amount: number, reason: string, ref: string) => Promise<boolean>;
  commitReservation?: (ref: string) => Promise<void>;
  releaseReservation?: (userId: string, amount: number, reason: string, ref: string) => Promise<void>;
  downloadTrainingImage?: (path: string) => Promise<ArrayBuffer | null>;
  uploadZip?: (zipPath: string, bytes: ArrayBuffer) => Promise<void>;
  signZipUrl?: (zipPath: string) => Promise<string>;
  updateSoul?: (soulId: string, patch: Record<string, unknown>) => Promise<SoulRow>;
  markSoulFailed?: (soulId: string, message: string) => Promise<void>;
  fetchImpl?: typeof fetch;
};

export async function trainSoul(soulId: string, userId: string, deps: TrainSoulDeps = {}): Promise<TrainSoulResult> {
  const getOwnedSoulImpl = deps.getOwnedSoul ?? getOwnedSoul;
  const claimSoulForTraining = deps.claimSoulForTraining ?? defaultClaimSoulForTraining;
  const reserveCredits = deps.reserveCredits ?? reserveSoulCredits;
  const commitReservation = deps.commitReservation ?? commitSoulReservation;
  const releaseReservation = deps.releaseReservation ?? releaseSoulReservation;
  const downloadTrainingImage = deps.downloadTrainingImage ?? defaultDownloadTrainingImage;
  const uploadZip = deps.uploadZip ?? defaultUploadZip;
  const signZipUrl = deps.signZipUrl ?? defaultSignZipUrl;
  const updateSoul = deps.updateSoul ?? defaultUpdateSoul;
  const markSoulFailed = deps.markSoulFailed ?? defaultMarkSoulFailed;
  const fetchImpl = deps.fetchImpl ?? fetch;

  const soul0 = await getOwnedSoulImpl(soulId, userId);

  // Cheap, non-authoritative early exits — avoid a DB write for the common
  // case. The claim below is what actually enforces these rules atomically.
  if (soul0.status === "training" && !isStaleTraining(soul0)) {
    return { ok: false, error: "This soul is already training." };
  }
  if (soul0.training_image_paths.length < MIN_TRAINING_IMAGES) {
    return {
      ok: false,
      error: `At least ${MIN_TRAINING_IMAGES} training photos are required (got ${soul0.training_image_paths.length}).`,
    };
  }
  const soulE2eMock = process.env.AURORA_SOUL_E2E_MOCK === "1";
  const falKey = process.env.FAL_KEY;
  if (!falKey && !soulE2eMock) return { ok: false, error: "AI training is not configured (FAL_KEY missing)." };

  // Atomically transition pending/failed/stale-training → training. Only one
  // concurrent caller can win this conditional UPDATE for a given Soul, so
  // only one caller ever reserves credits or calls fal below — the earlier
  // read-only checks above can't prevent a genuine race, this can.
  const soul = await claimSoulForTraining(soulId, userId);
  if (!soul) {
    return { ok: false, error: "This soul is already training." };
  }

  if (soulE2eMock) {
    const updated = await updateSoul(soulId, {
      status: "training",
      progress: 10,
      error_message: null,
      fal_training_id: `e2e-${crypto.randomUUID()}`,
    });
    return { ok: true, soul: updated };
  }

  // From here on the Soul is committed to "training" in the DB. Every exit
  // path (including insufficient credits) MUST reconcile that via
  // markSoulFailed, or a claimed Soul is stuck "training" until the stale
  // threshold — so every failure funnels through the single catch below
  // instead of returning early.
  let reservationRef: string | null = null;
  let reservedNotYetCommitted = false;
  try {
    // Reserve credits BEFORE doing any paid provider work. A stale-training
    // retry re-reserves fresh credits — each attempt is a real, independent
    // fal.ai training run (same principle as re-enqueuing a failed render job).
    reservationRef = crypto.randomUUID();
    const reserved = await reserveCredits(userId, SOUL_TRAINING_COST, "soul_training", reservationRef);
    if (!reserved) {
      throw new InsufficientSoulCreditsError("Insufficient credits to start training.");
    }
    reservedNotYetCommitted = true;

    // 1. Zip every training image from the private bucket.
    const zip = new JSZip();
    let count = 0;
    for (const path of soul.training_image_paths) {
      const bytes = await downloadTrainingImage(path);
      if (!bytes) continue; // skip a missing/removed upload rather than failing the whole batch
      zip.file(`img_${count++}.jpg`, bytes);
    }
    if (count < MIN_TRAINING_IMAGES) {
      throw new Error(`Only ${count} training photos could be read from storage (need ${MIN_TRAINING_IMAGES}).`);
    }
    const zipBytes = await zip.generateAsync({ type: "arraybuffer" });
    const zipPath = `${userId}/${soulId}/archive-${Date.now()}.zip`;
    await uploadZip(zipPath, zipBytes);
    const zipUrl = await signZipUrl(zipPath);

    // 2. Kick off fal.ai LoRA training. trigger_word is passed as the trainer's
    //    subject token so the trained LoRA actually associates the stored
    //    custom token with this identity — inference prompts prefix every
    //    request with the same trigger_word (see generateSoulImage/Video), so
    //    the two must stay in sync or the LoRA has no reason to respond to it.
    //    The webhook (src/routes/api/soul/fal-webhook.ts) receives the
    //    terminal result asynchronously — this call only confirms the job was
    //    accepted, which is also the point real fal.ai compute spend begins,
    //    so the reservation is committed right after a successful accept.
    const webhookSecret = process.env.SOUL_FAL_WEBHOOK_SECRET;
    const webhookUrl = webhookSecret
      ? `${CANONICAL_ORIGIN}/api/soul/fal-webhook?secret=${encodeURIComponent(webhookSecret)}`
      : `${CANONICAL_ORIGIN}/api/soul/fal-webhook`;
    const res = await fetchImpl("https://queue.fal.run/fal-ai/flux-lora-portrait-trainer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${falKey}` },
      body: JSON.stringify({
        images_data_url: zipUrl,
        trigger_word: soul.trigger_word,
        learning_rate: 0.00009,
        steps: 2500,
        multiresolution_training: true,
        subject_crop: true,
        create_masks: true,
        data_archive_format: "zip",
        webhook_url: webhookUrl,
      }),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      throw new Error(`Training request failed [${res.status}]: ${body}`);
    }
    const json = (await res.json()) as { request_id?: string };
    if (!json.request_id) {
      throw new Error("Training request returned no request_id.");
    }

    // fal accepted the job — real compute spend starts now regardless of the
    // eventual training outcome, so the reservation is committed (not
    // released) even though the training result itself is still pending.
    await commitReservation(reservationRef);
    reservedNotYetCommitted = false;

    const updated = await updateSoul(soulId, {
      status: "training",
      progress: 10,
      error_message: null,
      fal_training_id: json.request_id,
    });
    return { ok: true, soul: updated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Training failed to start.";
    const insufficient = err instanceof InsufficientSoulCreditsError ? true : undefined;
    // Only release while the reservation is still open. Once committed above,
    // the fal spend is real regardless of what happens next (e.g. a DB write
    // failure) — releasing an already-committed reservation would refund
    // credits for a job that actually started.
    if (reservedNotYetCommitted && reservationRef) {
      await releaseReservation(userId, SOUL_TRAINING_COST, "release_soul_training", reservationRef).catch(
        (relErr) => {
          console.error(`[soul] failed to release reservation ${reservationRef} after training error:`, relErr);
        },
      );
    }
    // The atomic claim above already flipped this Soul to "training" — every
    // failure path must reconcile it back or it stays stuck there until the
    // stale-training threshold.
    await markSoulFailed(soulId, message);
    return { ok: false, error: message, insufficient };
  }
}

/**
 * Applied by the fal.ai training webhook once training completes (success or
 * failure). Idempotent by request_id — a duplicate webhook delivery is a
 * harmless no-op once the soul is already terminal.
 */
export async function applyTrainingResult(
  requestId: string,
  outcome: { ok: true; loraUrl: string } | { ok: false; error: string },
): Promise<{ applied: boolean }> {
  const { data, error } = await supabaseAdmin
    .from("souls" as never)
    .select("id,status")
    .eq("fal_training_id" as never, requestId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { applied: false }; // unknown request id — nothing to update
  const soul = data as { id: string; status: string };
  if (soul.status === "ready" || soul.status === "failed") return { applied: false }; // already terminal

  if (outcome.ok) {
    await supabaseAdmin
      .from("souls" as never)
      .update({ status: "ready", progress: 100, lora_url: outcome.loraUrl, error_message: null } as never)
      .eq("id" as never, soul.id);
  } else {
    await supabaseAdmin
      .from("souls" as never)
      .update({ status: "failed", error_message: outcome.error } as never)
      .eq("id" as never, soul.id);
  }
  return { applied: true };
}

// ─── image generation ───────────────────────────────────────────────────────

export type SoulImageResult = {
  index: number;
  status: "succeeded" | "failed";
  url?: string;
  generationId?: string;
  error?: string;
  insufficient?: boolean;
};

export async function generateSoulImage(
  soulId: string,
  userId: string,
  prompt: string,
  aspectRatio: string,
  numOutputs: number,
): Promise<{ results: SoulImageResult[] }> {
  const soul = await getOwnedSoul(soulId, userId);
  if (soul.status !== "ready" || !soul.lora_url) {
    throw new Error("This soul isn't trained yet — finish training before generating images.");
  }
  const count = Math.max(1, Math.min(4, Math.round(numOutputs)));
  if (process.env.AURORA_SOUL_E2E_MOCK === "1") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#12091f"/><circle cx="256" cy="190" r="92" fill="#c084fc"/><rect x="126" y="318" width="260" height="110" rx="55" fill="#22d3ee"/><text x="256" y="468" fill="white" font-size="30" text-anchor="middle" font-family="Arial">Aurora Soul E2E</text></svg>`;
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return {
      results: Array.from({ length: count }, (_, index) => ({
        index,
        status: "succeeded" as const,
        url,
        generationId: `e2e-${crypto.randomUUID()}`,
      })),
    };
  }
  const perImageCost = soulImageCost();
  const fullPrompt = `${soul.trigger_word}, ${prompt}`.trim();

  const results: SoulImageResult[] = [];
  for (let i = 0; i < count; i++) {
    try {
      const outcome = await reserveOrchestrateRecord({
        userId,
        kind: "image",
        cost: perImageCost,
        reason: "soul_image",
        prompt: fullPrompt,
        model: SOUL_IMAGE_MODEL,
        pinnedModelOnly: true,
        aspectRatio,
        params: { loraUrl: soul.lora_url, triggerWord: soul.trigger_word, numOutputs: 1 },
      });
      if (!outcome.ok) {
        results.push({ index: i, status: "failed", error: outcome.error, insufficient: outcome.insufficient });
        // An insufficient-credit failure will repeat for every remaining
        // image — stop the batch instead of burning API calls uselessly.
        if (outcome.insufficient) break;
        continue;
      }
      results.push({ index: i, status: "succeeded", url: outcome.url, generationId: outcome.generationId });
    } catch (err) {
      results.push({ index: i, status: "failed", error: err instanceof Error ? err.message : "Generation failed" });
    }
  }
  return { results };
}

// ─── video generation ───────────────────────────────────────────────────────

export type SoulVideoResult =
  | { ok: true; jobId: string; url: string }
  | { ok: false; jobId: string; error: string; insufficient?: boolean };

export async function generateSoulVideo(
  soulId: string,
  userId: string,
  prompt: string,
  durationSeconds: number,
  aspectRatio: string,
): Promise<SoulVideoResult> {
  const soul = await getOwnedSoul(soulId, userId);
  if (soul.status !== "ready" || !soul.lora_url) {
    throw new Error("This soul isn't trained yet — finish training before generating video.");
  }
  const duration = Math.max(4, Math.min(30, Math.round(durationSeconds)));
  const cost = soulVideoCost(duration);
  const fullPrompt = `${soul.trigger_word}, ${prompt}`.trim();

  // Up to 3 signed reference stills so Seedance has an identity anchor.
  const referencePaths = soul.training_image_paths.slice(0, 3);
  const referenceUrls: string[] = [];
  for (const path of referencePaths) {
    try {
      referenceUrls.push(await signPath("soul-training", path, 3600));
    } catch {
      // best-effort — video still proceeds on prompt + trigger word alone
    }
  }

  const { data: jobRow, error: insErr } = await supabaseAdmin
    .from("soul_video_jobs" as never)
    .insert({
      user_id: userId,
      soul_id: soulId,
      provider: "seedance",
      model: SOUL_VIDEO_MODEL,
      status: "processing",
      progress: 5,
      prompt: fullPrompt,
      aspect_ratio: aspectRatio,
      duration_secs: duration,
    } as never)
    .select("*")
    .single();
  if (insErr) throw new Error(insErr.message);
  const jobId = (jobRow as SoulVideoJobRow).id;

  try {
    const outcome = await reserveOrchestrateRecord({
      userId,
      kind: "video",
      cost,
      reason: "soul_video",
      prompt: fullPrompt,
      model: SOUL_VIDEO_MODEL,
      pinnedModelOnly: true,
      duration,
      aspectRatio,
      imageUrls: referenceUrls,
    });
    if (!outcome.ok) {
      await supabaseAdmin
        .from("soul_video_jobs" as never)
        .update({ status: "failed", error_message: outcome.error } as never)
        .eq("id" as never, jobId);
      return { ok: false, jobId, error: outcome.error, insufficient: outcome.insufficient };
    }
    await supabaseAdmin
      .from("soul_video_jobs" as never)
      .update({ status: "completed", progress: 100, result_url: outcome.url } as never)
      .eq("id" as never, jobId);
    return { ok: true, jobId, url: outcome.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video generation failed.";
    await supabaseAdmin
      .from("soul_video_jobs" as never)
      .update({ status: "failed", error_message: message } as never)
      .eq("id" as never, jobId);
    return { ok: false, jobId, error: message };
  }
}

export async function getSoulVideoJobStatus(jobId: string, userId: string): Promise<SoulVideoJobRow> {
  const { data, error } = await supabaseAdmin
    .from("soul_video_jobs" as never)
    .select("*")
    .eq("id" as never, jobId)
    .eq("user_id" as never, userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Video job not found");
  return data as SoulVideoJobRow;
}

// ─── vibe matcher ────────────────────────────────────────────────────────────

export type VibeResult = {
  name: string;
  description: string;
  moodTags: string[];
  colorPalette: string[];
  lightingStyle: string;
  cameraStyle: string;
};

export const VIBE_FALLBACK: VibeResult = {
  name: "Custom Vibe",
  description: "A distinct visual mood extracted from your reference.",
  moodTags: [],
  colorPalette: [],
  lightingStyle: "natural",
  cameraStyle: "eye-level",
};

/** Tolerant JSON extraction — LLMs sometimes wrap JSON in prose or code fences. */
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("no JSON object found");
  return JSON.parse(candidate.slice(start, end + 1));
}

export function coerceVibeResult(value: unknown): VibeResult {
  if (typeof value !== "object" || value === null) return VIBE_FALLBACK;
  const v = value as Record<string, unknown>;
  const asStringArray = (x: unknown): string[] =>
    Array.isArray(x) ? x.filter((i): i is string => typeof i === "string").slice(0, 8) : [];
  return {
    name: typeof v.name === "string" && v.name.trim() ? v.name.trim().slice(0, 60) : VIBE_FALLBACK.name,
    description:
      typeof v.description === "string" && v.description.trim()
        ? v.description.trim().slice(0, 400)
        : VIBE_FALLBACK.description,
    moodTags: asStringArray(v.moodTags),
    colorPalette: asStringArray(v.colorPalette),
    lightingStyle: typeof v.lightingStyle === "string" ? v.lightingStyle.slice(0, 80) : VIBE_FALLBACK.lightingStyle,
    cameraStyle: typeof v.cameraStyle === "string" ? v.cameraStyle.slice(0, 80) : VIBE_FALLBACK.cameraStyle,
  };
}

/**
 * Analysis-only — routed through Aurora's own text/vision gateway (never
 * Lovable AI Gateway). Not billed: same policy as reshoot.functions.ts's
 * best-effort subject analysis, a preset suggestion isn't a rendered asset.
 */
export async function vibeMatch(imageUrl: string, userId: string): Promise<VibeResult> {
  try {
    const res = await orchestrate({
      kind: "text",
      imageUrls: [imageUrl],
      userId,
      prompt:
        "Look at this reference image and extract a reusable visual 'vibe' preset for an AI " +
        "photo/video generator. Respond with ONLY a JSON object (no prose, no code fences) " +
        "matching exactly this shape: " +
        '{"name": string, "description": string, "moodTags": string[], "colorPalette": string[] (hex codes), "lightingStyle": string, "cameraStyle": string}',
    });
    const text = res.text?.trim();
    if (!text) return VIBE_FALLBACK;
    return coerceVibeResult(extractJsonObject(text));
  } catch {
    return VIBE_FALLBACK;
  }
}
