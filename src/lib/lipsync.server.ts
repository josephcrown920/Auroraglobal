import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { orchestrate, hasActiveWorkerForKind, assertFreeModeServable } from "./orchestrator.server";
import { buildLatentSyncRequest } from "./lipsync-workflows.server";
import { computeCost } from "./pricing";
import { isAdmin } from "./admin.server";

export type Engine = "sync-v2" | "wav2lip" | "latentsync";

// Engine → model key. "latentsync" is self-hosted: it carries no hosted-API
// model, so it routes ONLY to the registered GPU worker pool (capability lipsync).
const MODEL: Record<Engine, string> = {
  "sync-v2": "fal-ai/sync-lipsync/v2",
  "wav2lip": "fal-ai/wav2lip",
  "latentsync": "latentsync",
};

// Engines that must run on the user's own GPU worker pool (no hosted fallback).
const SELF_HOSTED: ReadonlySet<Engine> = new Set<Engine>(["latentsync"]);

export async function runLipsyncJob(opts: {
  userId: string;
  videoUrl: string;
  audioUrl: string;
  engine: Engine;
}) {
  const selfHosted = SELF_HOSTED.has(opts.engine);
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
      video_url: opts.videoUrl,
      audio_url: opts.audioUrl,
      engine: opts.engine,
      status: "running",
    })
    .select("id")
    .single();
  if (insertErr || !row) throw new Error(insertErr?.message ?? "Failed to create job");

  // Charge credits before orchestration — mirrors the lipSyncVideo path in
  // studio.functions.ts. Uses the same computeCost(lipsync, model) so both paths
  // charge the same Aura amount for the same engine. Deduct_credits is atomic
  // (single SQL UPDATE WHERE credits >= _amount) so no double-spend under concurrency.
  // Admins bypass the charge entirely — consistent with all other charge points.
  const lipsyncCost = computeCost({ features: ["lipsync"], model: MODEL[opts.engine] }).total;
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
    // Self-hosted LatentSync carries a ComfyUI graph + flat params so it runs on
    // every worker protocol (comfyui reads the graph; custom/runpod/hfspace read
    // the flat fields). Hosted engines never get these.
    const selfHostedParts = selfHosted
      ? buildLatentSyncRequest({ videoUrl: opts.videoUrl, audioUrl: opts.audioUrl })
      : undefined;
    const out = await orchestrate({
      kind: "lipsync",
      model: MODEL[opts.engine],
      selfHostedOnly: selfHosted,
      videoUrl: opts.videoUrl,
      audioUrl: opts.audioUrl,
      userId: opts.userId,
      refId: row.id,
      ...(selfHostedParts ?? {}),
    });
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
    // Refund: orchestration failed after charging — give credits back.
    // Admins were never charged, so skip the refund for them.
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
