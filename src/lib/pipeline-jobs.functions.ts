// Unified job-queue feed for the Locked Likeness pipeline: likeness locks,
// music-synced deck renders (generations tagged with reason='likeness_shoot'),
// and ad-variation renders (ad_variations rows) — plus any raw `jobs` row the
// user has queued/processing. Powers the `/jobs` dashboard.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
// @ts-nocheck — live DB tables aren't yet in generated Supabase types
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PipelineJob = {
  id: string;
  stage: "likeness_lock" | "deck_render" | "ad_variation" | "queued_job";
  label: string;
  status: "queued" | "processing" | "succeeded" | "failed" | "cancelled";
  createdAt: string;
  finishedAt?: string | null;
  url?: string | null;
  error?: string | null;
  meta?: Record<string, string | number | boolean | null>;
};

/** Aggregated view of an ad_variations batch — the unit the Orchestration
 *  Engine and Ad Variations tools produce. Powers the progress timeline. */
export type PipelineBatch = {
  batchId: string;
  total: number;
  succeeded: number;
  failed: number;
  processing: number;
  percent: number;
  status: "processing" | "succeeded" | "failed";
  startedAt: string;
  finishedAt: string | null;
  /** Human-readable current step (e.g. "Rendering 16:9 · shot 4/8"). */
  currentStep: string;
  /** Seconds. null while we don't have enough signal to guess. */
  estimatedRemainingSec: number | null;
  /** First succeeded asset URL — used by in-app notifications. */
  firstAssetUrl: string | null;
};


function normalizeGenStatus(s: string | null | undefined): PipelineJob["status"] {
  if (!s) return "queued";
  const v = s.toLowerCase();
  if (["succeeded", "success", "completed", "done"].includes(v)) return "succeeded";
  if (["failed", "error"].includes(v)) return "failed";
  if (["cancelled", "canceled"].includes(v)) return "cancelled";
  if (["processing", "running", "in_progress"].includes(v)) return "processing";
  return "queued";
}

export const listPipelineJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ jobs: PipelineJob[]; batches: PipelineBatch[] }> => {
    const uid = context.userId;

    const [locksRes, gensRes, adsRes, jobsRes] = await Promise.all([
      (supabaseAdmin as any)
        .from("likeness_locks")
        .select("id, name, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(20),
      (supabaseAdmin as any)
        .from("generations")
        .select("id, prompt, status, error, result_image_url, result_video_url, created_at, model")
        .eq("user_id", uid)
        .in("mode", ["performance", "preview"])
        .or(
          "prompt.ilike.%Likeness shoot%,prompt.ilike.%[Ad variation%,prompt.ilike.%[Aspect render%",
        )
        .order("created_at", { ascending: false })
        .limit(60),
      (supabaseAdmin as any)
        .from("ad_variations")
        .select("id, kind, aspect, text_value, url, status, error, created_at, batch_id")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(60),
      (supabaseAdmin as any)
        .from("jobs")
        .select("id, kind, status, error, created_at, finished_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const jobs: PipelineJob[] = [];

    for (const r of locksRes.data ?? []) {
      jobs.push({
        id: `lock:${r.id}`,
        stage: "likeness_lock",
        label: `Locked likeness — ${r.name}`,
        status: "succeeded",
        createdAt: r.created_at,
      });
    }

    for (const r of gensRes.data ?? []) {
      const isAspect = /^\[Aspect render/i.test(r.prompt ?? "");
      const stage: PipelineJob["stage"] = isAspect ? "ad_variation" : "deck_render";
      const label = (r.prompt ?? "").split("]")[0].replace(/^\[/, "").slice(0, 80) || "Shot";
      jobs.push({
        id: `gen:${r.id}`,
        stage,
        label,
        status: normalizeGenStatus(r.status),
        createdAt: r.created_at,
        url: r.result_image_url ?? r.result_video_url ?? null,
        error: r.error,
        meta: { model: r.model },
      });
    }

    for (const r of adsRes.data ?? []) {
      jobs.push({
        id: `ad:${r.id}`,
        stage: "ad_variation",
        label:
          r.kind === "hook"
            ? `Hook: ${(r.text_value ?? "").slice(0, 60)}`
            : r.kind === "caption"
              ? `Caption: ${(r.text_value ?? "").slice(0, 60)}`
              : r.kind === "aspect_render"
                ? `Aspect ${r.aspect ?? ""}`
                : `Thumbnail`,
        status: r.status === "failed" ? "failed" : "succeeded",
        createdAt: r.created_at,
        url: r.url,
        error: r.error,
        meta: { batchId: r.batch_id, kind: r.kind },
      });
    }

    for (const r of jobsRes.data ?? []) {
      jobs.push({
        id: `job:${r.id}`,
        stage: "queued_job",
        label: `${r.kind} job`,
        status: normalizeGenStatus(r.status),
        createdAt: r.created_at,
        finishedAt: r.finished_at,
        error: r.error,
      });
    }

    jobs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    // ── Batch aggregation: group ad_variations rows by batch_id ───────────
    const byBatch = new Map<string, any[]>();
    for (const r of adsRes.data ?? []) {
      const bid = (r as any).batch_id;
      if (!bid) continue;
      const arr = byBatch.get(bid) ?? [];
      arr.push(r);
      byBatch.set(bid, arr);
    }
    const batches: PipelineBatch[] = [];
    for (const [batchId, rows] of byBatch) {
      const total = rows.length;
      const succeeded = rows.filter((r) => r.status === "succeeded").length;
      const failed = rows.filter((r) => r.status === "failed").length;
      const processing = total - succeeded - failed;
      const percent = total > 0 ? Math.round(((succeeded + failed) / total) * 100) : 0;
      const status: PipelineBatch["status"] =
        processing > 0 ? "processing" : failed === total ? "failed" : "succeeded";

      const times = rows.map((r) => new Date(r.created_at).getTime()).sort((a, b) => a - b);
      const startedAt = new Date(times[0] ?? Date.now()).toISOString();
      const finishedAt =
        processing === 0 ? new Date(times[times.length - 1] ?? Date.now()).toISOString() : null;

      const activeRow =
        rows.find((r) => r.status !== "succeeded" && r.status !== "failed") ??
        rows[rows.length - 1];
      const kindLabel =
        activeRow?.kind === "hook"
          ? "Writing hooks"
          : activeRow?.kind === "caption"
            ? "Writing captions"
            : activeRow?.kind === "aspect_render"
              ? `Rendering ${activeRow?.aspect ?? ""}`
              : "Preparing";
      const currentStep =
        status === "processing"
          ? `${kindLabel} · ${succeeded + failed}/${total}`
          : status === "succeeded"
            ? "Complete"
            : "Failed";

      let estimatedRemainingSec: number | null = null;
      if (processing > 0 && succeeded + failed > 0) {
        const elapsedSec = (Date.now() - (times[0] ?? Date.now())) / 1000;
        const perItem = elapsedSec / (succeeded + failed);
        estimatedRemainingSec = Math.max(1, Math.round(perItem * processing));
      }

      const firstAssetUrl =
        rows.find((r) => r.status === "succeeded" && r.url)?.url ?? null;

      batches.push({
        batchId, total, succeeded, failed, processing, percent, status,
        startedAt, finishedAt, currentStep, estimatedRemainingSec, firstAssetUrl,
      });
    }
    batches.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));

    return { jobs: jobs.slice(0, 150), batches };
  });
