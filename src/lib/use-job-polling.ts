// Client-side helper that turns an enqueue-only server fn (returns
// {jobId, generationId, ...}) back into a promise that resolves once the
// underlying job/generation finishes — so every existing mutationFn/onSuccess
// callsite that expected an inline blocking render keeps working unchanged.
//
// This is intentionally still a blocking await from the CALLER's point of
// view, but the actual work is decoupled: the enqueue call returns almost
// immediately, and the render itself is driven by the jobs/tick worker
// (independent of this request/tab). If the tab closes mid-poll, the job
// keeps progressing server-side and will show up in Gallery/My Jobs when the
// user comes back — closing the loop on task #273.
import { useServerFn } from "@tanstack/react-start";
import { getJobStatus } from "./jobs.functions";
import {
  generatePerformanceShot,
  generateVideoFromImage,
  lipSyncVideo,
} from "./studio.functions";
import { splitRealityGenerate } from "./split-reality.functions";
import { backoffMs } from "./poll-backoff";
import { supabase } from "@/integrations/supabase/client";

export type JobPollResult = {
  status: string;
  resultImageUrl: string | null;
  resultVideoUrl: string | null;
  error: string | null;
};

/** Non-terminal snapshot pushed to a progress observer on every poll (task #284):
 *  the job's live status plus REAL server-reported percent/stage when present. */
export type JobProgressUpdate = {
  status: string;
  pct: number | null;
  stage: string | null;
};

export type JobPollOptions = {
  /** Called on each non-terminal poll with the job's real progress snapshot. */
  onProgress?: (u: JobProgressUpdate) => void;
};

// 5-minute outer timeout preserved as a wall-clock deadline.
// With 2s/×1.5/15s backoff: ~23 attempts exhaust the 5-min budget; the
// deadline is the authoritative gate so this never exceeds the SLA even if
// the interval strategy changes.
const POLL_BUDGET_MS = 5 * 60_000;
const MAX_POLL_ATTEMPTS = 25; // safety cap (belt-and-suspenders above deadline)
// Progress-observed polls cap the interval much lower so the bar tracks real
// server percent responsively — which needs a higher attempt cap to cover the
// same 5-minute wall clock (deadline remains the authoritative gate).
const OBSERVED_POLL_CAP_MS = 3_500;
const OBSERVED_MAX_POLL_ATTEMPTS = 120;

const TERMINAL_OK = new Set(["succeeded", "complete"]);
const TERMINAL_FAIL = new Set(["failed", "cancelled"]);

/**
 * Poll a job until it reaches a terminal status.
 *
 * Two concurrent paths race to detect completion:
 *  1. **Realtime** (fast-path): subscribes to `postgres_changes` on the
 *     `generations` row; resolves the moment a terminal UPDATE arrives.
 *     Requires `generationId` to be passed.
 *  2. **Poll loop** (fallback): exponential backoff starting at 2 s, ×1.5 per
 *     attempt, capped at 15 s — ~80 % fewer requests than the old flat 2 s
 *     interval. Always runs concurrently with Realtime as a safety net.
 *     When a progress observer is attached, the cap tightens to 3.5 s so the
 *     bar tracks real server-reported percent (task #284).
 *
 * Whichever path settles first wins (Promise.race). The loser is cleaned up
 * via a shared abort signal; the Realtime channel is always unsubscribed on
 * settle.
 */
export async function pollJobUntilDone(
  statusFn: (opts: { data: { jobId: string } }) => Promise<Awaited<ReturnType<typeof getJobStatus>>>,
  jobId: string,
  generationId?: string,
  opts?: JobPollOptions,
): Promise<JobPollResult> {
  const abort = { cancelled: false };
  let rtChannel: ReturnType<typeof supabase.channel> | null = null;
  const observed = typeof opts?.onProgress === "function";
  const maxAttempts = observed ? OBSERVED_MAX_POLL_ATTEMPTS : MAX_POLL_ATTEMPTS;

  function pollLoop(): Promise<JobPollResult> {
    return (async () => {
      const deadline = Date.now() + POLL_BUDGET_MS;
      for (let attempt = 0; attempt < maxAttempts && Date.now() < deadline; attempt++) {
        if (abort.cancelled) throw new Error("cancelled");
        const { job, generation } = await statusFn({ data: { jobId } });
        const status = generation?.status ?? job.status;
        if (TERMINAL_OK.has(status ?? "")) {
          return {
            status: status!,
            resultImageUrl: generation?.result_image_url ?? null,
            resultVideoUrl: generation?.result_video_url ?? null,
            error: null,
          };
        }
        if (TERMINAL_FAIL.has(status ?? "") || TERMINAL_FAIL.has(job.status ?? "")) {
          throw new Error(generation?.error || job.error || "Generation failed");
        }
        // Non-terminal: surface the job's real progress to the observer.
        if (observed) {
          try {
            opts!.onProgress!({
              status: job.status ?? "queued",
              pct: job.progress_pct ?? null,
              stage: job.progress_stage ?? null,
            });
          } catch {
            // Observers are cosmetic — never let one break the poll loop.
          }
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        const interval = observed
          ? Math.min(backoffMs(attempt), OBSERVED_POLL_CAP_MS)
          : backoffMs(attempt);
        await new Promise<void>((r) => setTimeout(r, Math.min(interval, remaining)));
      }
      throw new Error(
        "This is taking longer than expected — it's still running in the background and will appear in your Gallery once it finishes.",
      );
    })();
  }

  function realtimePath(): Promise<JobPollResult> {
    return new Promise<JobPollResult>((resolve, reject) => {
      rtChannel = supabase
        .channel(`aurora:gen:${generationId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "generations",
            filter: `id=eq.${generationId}`,
          },
          (payload) => {
            if (abort.cancelled) return;
            const row = payload.new as Record<string, unknown>;
            const s = String(row.status ?? "");
            if (TERMINAL_OK.has(s)) {
              resolve({
                status: s,
                resultImageUrl: (row.result_image_url as string | null) ?? null,
                resultVideoUrl: (row.result_video_url as string | null) ?? null,
                error: null,
              });
            } else if (TERMINAL_FAIL.has(s)) {
              reject(new Error((row.error as string | null) || "Generation failed"));
            }
          },
        )
        .subscribe();
    });
  }

  try {
    if (generationId) {
      return await Promise.race([pollLoop(), realtimePath()]);
    }
    return await pollLoop();
  } finally {
    abort.cancelled = true;
    if (rtChannel) {
      supabase.removeChannel(rtChannel).catch(() => {});
    }
  }
}

type EnqueueResult = { jobId: string; generationId: string } & Record<string, unknown>;


/** Wrap a single-job enqueue-only server fn so callers can keep using it as
 *  if it blocked until the render finished. `mapResult` shapes the final
 *  return value to match whatever the old inline server fn used to return.
 *  `opts.onProgress` (task #284) receives real job progress on every poll. */
export function useJobPollingFn<TInput, TResult>(
  enqueueFn: (opts: { data: TInput }) => Promise<EnqueueResult>,
  mapResult: (enqueued: EnqueueResult, polled: JobPollResult) => TResult,
  opts?: JobPollOptions,
) {
  const enqueue = useServerFn(enqueueFn);
  const statusFn = useServerFn(getJobStatus);
  return async (callOpts: { data: TInput }): Promise<TResult> => {
    // Reset the observer at call start so a stale high-water percent from the
    // PREVIOUS render can never floor the new bar (consumers keep the latest
    // update in state across runs).
    try {
      opts?.onProgress?.({ status: "queued", pct: null, stage: null });
    } catch {
      // Observers are cosmetic.
    }
    const enqueued = await enqueue(callOpts);
    const polled = await pollJobUntilDone(
      statusFn,
      enqueued.jobId,
      enqueued.generationId,
      opts,
    );
    return mapResult(enqueued, polled);
  };
}

// ── Drop-in replacements for the converted studio server fns ──────────────
// Each returns the same shape the old inline (blocking) server fn returned,
// so existing mutation/onSuccess code at every call site works unchanged.

/** Old shape: { id, resultUrl } */
export function usePerformanceShotJobFn(opts?: JobPollOptions) {
  return useJobPollingFn(generatePerformanceShot, (enq, p) => {
    if (!p.resultImageUrl) throw new Error("Render finished without an image");
    return { id: enq.generationId, resultUrl: p.resultImageUrl };
  }, opts);
}

/** Old shape: { id, videoUrl, preview } */
export function useVideoFromImageJobFn(opts?: JobPollOptions) {
  return useJobPollingFn(generateVideoFromImage, (enq, p) => {
    if (!p.resultVideoUrl) throw new Error("Render finished without a video");
    return { id: enq.generationId, videoUrl: p.resultVideoUrl, preview: Boolean(enq.preview) };
  }, opts);
}

/** Old shape: { id, videoUrl } */
export function useLipSyncJobFn(opts?: JobPollOptions) {
  return useJobPollingFn(lipSyncVideo, (enq, p) => {
    if (!p.resultVideoUrl) throw new Error("Lip sync finished without a video");
    return { id: enq.generationId, videoUrl: p.resultVideoUrl };
  }, opts);
}


// ── ComfyUI runs ───────────────────────────────────────────────────────────
// Comfy runs poll their own `comfy_runs` row (the worker mirrors the job's
// terminal outcome onto it), not the jobs table — the run row is what the
// /comfy history list and canvas node already render from.

type ComfyRunRow = {
  id: string;
  status: string;
  output_url: string | null;
  output_kind: string | null;
  error: string | null;
} & Record<string, unknown>;

// ── Split Reality ───────────────────────────────────────────────────────────
// splitRealityGenerate is a BLOCKING server fn (both sides run inline in
// parallel via Promise.all). No job polling needed — just wrap with
// useServerFn and return the result directly.

export type SideResult = { id: string; url: string; variant: string };
export type SplitRealityOutput = { left: SideResult; right: SideResult };

export function useSplitRealityJobFn() {
  return useServerFn(splitRealityGenerate);
}

export async function pollComfyRunUntilDone(
  getRunFn: (opts: { data: { id: string } }) => Promise<{ run: ComfyRunRow }>,
  runId: string,
): Promise<ComfyRunRow> {
  const deadline = Date.now() + POLL_BUDGET_MS;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && Date.now() < deadline; attempt++) {
    const { run } = await getRunFn({ data: { id: runId } });
    if (run.status === "succeeded") return run;
    if (run.status === "failed") throw new Error(run.error || "ComfyUI run failed");
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise<void>((r) => setTimeout(r, Math.min(backoffMs(attempt), remaining)));
  }
  throw new Error(
    "This is taking longer than expected — the run is still going in the background; check Recent runs in a bit.",
  );
}
