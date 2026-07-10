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
  generateSplitReality,
} from "./studio.functions";

export type JobPollResult = {
  status: string;
  resultImageUrl: string | null;
  resultVideoUrl: string | null;
  error: string | null;
};

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150; // ~5 minutes

const TERMINAL_OK = new Set(["succeeded", "complete"]);
const TERMINAL_FAIL = new Set(["failed", "cancelled"]);

export async function pollJobUntilDone(
  statusFn: (opts: { data: { jobId: string } }) => Promise<Awaited<ReturnType<typeof getJobStatus>>>,
  jobId: string,
): Promise<JobPollResult> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
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
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    "This is taking longer than expected — it's still running in the background and will appear in your Gallery once it finishes.",
  );
}

type EnqueueResult = { jobId: string; generationId: string } & Record<string, unknown>;

type SplitSide = { jobId: string; generationId: string; variant: string } & Record<string, unknown>;
type SplitEnqueueResult = { mode: "characters" | "mirror"; left: SplitSide; right: SplitSide };

/** Split Reality enqueues TWO jobs (left/right halves); poll both to completion
 *  and reconstruct the old { mode, left: {id,url,variant}, right } shape. */
export function useSplitJobPollingFn<TInput>(
  enqueueFn: (opts: { data: TInput }) => Promise<SplitEnqueueResult>,
) {
  const enqueue = useServerFn(enqueueFn);
  const statusFn = useServerFn(getJobStatus);
  return async (opts: { data: TInput }) => {
    const res = await enqueue(opts);
    const [l, r] = await Promise.all([
      pollJobUntilDone(statusFn, res.left.jobId),
      pollJobUntilDone(statusFn, res.right.jobId),
    ]);
    if (!l.resultImageUrl || !r.resultImageUrl) throw new Error("Split Reality render finished without an image");
    return {
      mode: res.mode,
      left: { id: res.left.generationId, url: l.resultImageUrl, variant: res.left.variant },
      right: { id: res.right.generationId, url: r.resultImageUrl, variant: res.right.variant },
    };
  };
}

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
    const polled = await pollJobUntilDone(statusFn, enqueued.jobId);
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

/** Old shape: { mode, left: {id,url,variant}, right: {id,url,variant} } */
export function useSplitRealityJobFn() {
  return useSplitJobPollingFn(generateSplitReality);
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
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(
    "This is taking longer than expected — the run is still going in the background; check Recent runs in a bit.",
  );
}
