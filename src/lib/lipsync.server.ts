import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { orchestrate, hasActiveWorkerForKind, assertFreeModeServable } from "./orchestrator.server";
import { buildLatentSyncRequest } from "./lipsync-workflows.server";
import { lipsyncEngineCost, XAI_UGC_RELIP_MODEL } from "./pricing";
import { isAdmin } from "./admin.server";

export type Engine = "sync-v2" | "wav2lip" | "latentsync" | "xai-ugc";

// Engine → model key. "latentsync" is self-hosted: it carries no hosted-API
// model, so it routes ONLY to the registered GPU worker pool (capability lipsync).
// "xai-ugc" is a two-stage chain: xAI video adapter renders the talking-head clip
// from the still photo, then a MANDATORY relip stage syncs the lips to the user's
// uploaded audio (xAI's own generated voice is never shipped — voice consistency).
const MODEL: Record<Engine, string> = {
  "sync-v2": "fal-ai/sync-lipsync/v2",
  "wav2lip": "fal-ai/wav2lip",
  "latentsync": "latentsync",
  "xai-ugc": "xai/grok-imagine-video-1.5",
};

// Engines that must run on the user's own GPU worker pool (no hosted fallback).
const SELF_HOSTED: ReadonlySet<Engine> = new Set<Engine>(["latentsync"]);

// Hardcoded UGC prompt for xAI grok-imagine-video-1.5.
// Creates a realistic walking talking-head UGC video from a still photo.
export const XAI_UGC_PROMPT =
  "Create a realistic UGC-style video from the reference image of the person. " +
  "The person walks slowly and naturally toward the camera while speaking directly " +
  "to the viewer with natural facial expressions, head movement, and realistic lip-sync.\n" +
  "Camera: Handheld selfie-style shot, slight natural movement, vertical 9:16 format.\n" +
  "Movement: The person starts a bit further away and walks casually toward the camera, " +
  "maintaining eye contact, with natural body sway and subtle gestures.\n" +
  "Style: Authentic UGC / TikTok / Instagram Reels style — natural lighting, casual and " +
  "relatable, high realism, slight film grain, not overly polished.\n" +
  "Script (speak naturally, conversational tone):\n" +
  "\"Hey guys, I just had to show you this. It's honestly been a game changer for me. " +
  "The quality is insane, and it smells absolutely incredible. If you're thinking about " +
  "getting one, just do it — you won't regret it.\"\n" +
  "Make the lip movements perfectly synchronized with the spoken audio. Natural blinking, " +
  "micro-expressions, and realistic walking motion. 8–10 seconds duration, smooth motion, " +
  "high quality, photorealistic";

export async function runLipsyncJob(opts: {
  userId: string;
  videoUrl: string;
  audioUrl: string;
  engine: Engine;
  /** Required for xai-ugc: the still photo to animate */
  imageUrl?: string;
}) {
  const selfHosted = SELF_HOSTED.has(opts.engine);
  const isXaiUgc = opts.engine === "xai-ugc";

  if (isXaiUgc && !opts.imageUrl) {
    throw new Error("xAI UGC engine requires a still photo. Upload a selfie or portrait.");
  }

  if (selfHosted && !(await hasActiveWorkerForKind("lipsync"))) {
    throw new Error(
      "No self-hosted LatentSync worker is online. Register a GPU worker with the 'lipsync' capability in Admin → Workers, or pick the Studio/Fast engine.",
    );
  }
  // Free GPU only mode: lip-sync has no $0 hosted fallback — fail fast (before any
  // job row) when no free worker is online, since no paid engine can be reached.
  await assertFreeModeServable("lipsync");

  const { data: row, error: insertErr } = await supabaseAdmin
    .from("lipsync_jobs")
    .insert({
      user_id: opts.userId,
      video_url: isXaiUgc ? (opts.imageUrl ?? opts.videoUrl) : opts.videoUrl,
      audio_url: opts.audioUrl,
      engine: opts.engine,
      status: "running",
    })
    .select("id")
    .single();
  if (insertErr || !row) throw new Error(insertErr?.message ?? "Failed to create job");

  // Charge credits before orchestration. xai-ugc is billed as a two-stage
  // chain (xAI video + mandatory relip) — lipsyncEngineCost is the single
  // source shared with the UI quote.
  const lipsyncCost = lipsyncEngineCost(opts.engine);
  const adminUser = await isAdmin(opts.userId);
  if (!adminUser) {
    const { data: charged, error: creditErr } = await supabaseAdmin.rpc("deduct_credits", {
      _user: opts.userId,
      _amount: lipsyncCost,
      _reason: "lipsync",
      _ref: row.id,
    });
    if (creditErr) {
      await supabaseAdmin
        .from("lipsync_jobs")
        .update({ status: "error", error: creditErr.message.slice(0, 500) })
        .eq("id", row.id);
      throw new Error(creditErr.message);
    }
    if (charged === false) {
      await supabaseAdmin
        .from("lipsync_jobs")
        .update({ status: "error", error: "Insufficient credits" })
        .eq("id", row.id);
      throw new Error("Not enough Aura. Buy more from the Aura panel.");
    }
  }

  try {
    let out: Awaited<ReturnType<typeof orchestrate>>;

    if (isXaiUgc) {
      // xAI UGC — two mandatory stages:
      //   1. xAI image→video: still photo → walking talking-head UGC clip.
      //   2. Relip to the USER'S audio: xAI invents its own (inconsistent)
      //      voice, so the clip is always re-synced to the uploaded track —
      //      the character's voice must stay identical across renders.
      // Both stages are required (see pipeline-stage strictness): a failure in
      // either fails the whole job with a refund — never a wrong-voice output.
      const xaiClip = await orchestrate({
        kind: "video",
        model: MODEL["xai-ugc"],
        // Never fall back to another video model: the user explicitly chose the
        // xAI UGC engine — a seedance/kling substitute would not be a UGC
        // talking-head and must not be silently delivered (or charged for).
        pinnedModelOnly: true,
        prompt: XAI_UGC_PROMPT,
        imageUrls: [opts.imageUrl!],
        duration: 10,
        resolution: "720p",
        userId: opts.userId,
        refId: row.id,
      });
      out = await orchestrate({
        kind: "lipsync",
        model: XAI_UGC_RELIP_MODEL,
        videoUrl: xaiClip.url,
        // Pass the original still photo through too: HeyGen's real API can
        // only lip-sync from a photo (photo-avatar + audio), not re-lip an
        // already-rendered video like sync.so/wav2lip can.
        imageUrls: [opts.imageUrl!],
        audioUrl: opts.audioUrl,
        userId: opts.userId,
        refId: row.id,
      });
    } else {
      // Standard lipsync engines (sync-v2, wav2lip, latentsync)
      const selfHostedParts = selfHosted
        ? buildLatentSyncRequest({ videoUrl: opts.videoUrl, audioUrl: opts.audioUrl })
        : undefined;
      out = await orchestrate({
        kind: "lipsync",
        model: MODEL[opts.engine],
        selfHostedOnly: selfHosted,
        videoUrl: opts.videoUrl,
        audioUrl: opts.audioUrl,
        userId: opts.userId,
        refId: row.id,
        ...(selfHostedParts ?? {}),
      });
    }

    await supabaseAdmin
      .from("lipsync_jobs")
      .update({ status: "done", result_url: out.url })
      .eq("id", row.id);
    return { id: row.id, status: "done" as const, resultUrl: out.url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from("lipsync_jobs")
      .update({ status: "error", error: msg.slice(0, 500) })
      .eq("id", row.id);
    if (!adminUser) {
      await supabaseAdmin.rpc("grant_credits", {
        _user: opts.userId,
        _amount: lipsyncCost,
        _reason: "refund_failed_generation",
        _ref: row.id,
      });
    }
    return { id: row.id, status: "error" as const, error: msg };
  }
}

export async function fetchLipsyncJob(id: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("lipsync_jobs")
    .select("id,status,result_url,error,engine")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  return data;
}
