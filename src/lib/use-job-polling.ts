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
import { backoffMs } from "./poll-backoff";
import { supabase } from "@/integrations/supabase/client";

export type JobPollResult = {
  status: string;
  resultImageUrl: string | null;
  resultVideoUrl: string | null;
  error: string | null;
};

const MAX_POLL_ATTEMPTS = 150; // ~5 minutes (backoff means actual wall time is longer)

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
 *
 * Whichever path settles first wins (Promise.race). The loser is cleaned up
 * via a shared abort signal; the Realtime channel is always unsubscribed on
 * settle.
 */
export async function pollJobUntilDone(
  statusFn: (opts: { data: { jobId: string } }) => Promise<Awaited<ReturnType<typeof getJobStatus>>>,
  jobId: string,
  generationId?: string,
): Promise<JobPollResult> {
  const abort = { cancelled: false };
  let rtChannel: ReturnType<typeof supabase.channel> | null = null;

  function pollLoop(): Promise<JobPollResult> {
    return (async () => {
      for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
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
        await new Promise<void>((r) => setTimeout(r, backoffMs(attempt)));
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
 *  return value to match whatever the old inline server fn used to return. */
export function useJobPollingFn<TInput, TResult>(
  enqueueFn: (opts: { data: TInput }) => Promise<EnqueueResult>,
  mapResult: (enqueued: EnqueueResult, polled: JobPollResult) => TResult,
) {
  const enqueue = useServerFn(enqueueFn);
  const statusFn = useServerFn(getJobStatus);
  return async (opts: { data: TInput }): Promise<TResult> => {
    const enqueued = await enqueue(opts);
    const polled = await pollJobUntilDone(
      statusFn,
      enqueued.jobId,
      enqueued.generationId,
    );
    return mapResult(enqueued, polled);
  };
}

// ── Drop-in replacements for the converted studio server fns ──────────────
// Each returns the same shape the old inline (blocking) server fn returned,
// so existing mutation/onSuccess code at every call site works unchanged.

/** Old shape: { id, resultUrl } */
export function usePerformanceShotJobFn() {
  return useJobPollingFn(generatePerformanceShot, (enq, p) => {
    if (!p.resultImageUrl) throw new Error("Render finished without an image");
    return { id: enq.generationId, resultUrl: p.resultImageUrl };
  });
}

/** Old shape: { id, videoUrl, preview } */
export function useVideoFromImageJobFn() {
  return useJobPollingFn(generateVideoFromImage, (enq, p) => {
    if (!p.resultVideoUrl) throw new Error("Render finished without a video");
    return { id: enq.generationId, videoUrl: p.resultVideoUrl, preview: Boolean(enq.preview) };
  });
}

/** Old shape: { id, videoUrl } */
export function useLipSyncJobFn() {
  return useJobPollingFn(lipSyncVideo, (enq, p) => {
    if (!p.resultVideoUrl) throw new Error("Lip sync finished without a video");
    return { id: enq.generationId, videoUrl: p.resultVideoUrl };
  });
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

export async function pollComfyRunUntilDone(
  getRunFn: (opts: { data: { id: string } }) => Promise<{ run: ComfyRunRow }>,
  runId: string,
): Promise<ComfyRunRow> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const { run } = await getRunFn({ data: { id: runId } });
    if (run.status === "succeeded") return run;
    if (run.status === "failed") throw new Error(run.error || "ComfyUI run failed");
    await new Promise<void>((r) => setTimeout(r, backoffMs(attempt)));
  }
  throw new Error(
    "This is taking longer than expected — the run is still going in the background; check Recent runs in a bit.",
  );
}
