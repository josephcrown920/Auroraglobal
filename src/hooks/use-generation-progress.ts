import { useEffect, useMemo, useRef, useState } from "react";

export type GenerationState =
  | "idle"
  | "queued"
  | "processing"
  | "finalizing"
  | "done"
  | "error";

/**
 * Backend job status strings used across Aurora's async job system.
 * Maps to GenerationState for unified display.
 */
export type BackendJobStatus =
  | "queued"
  | "processing"
  | "finalizing"
  | "complete"
  | "failed"
  | null
  | undefined;

export interface GenerationProgressResult {
  state: GenerationState;
  progress: number;
  label: string;
  isActive: boolean;
}

const PHASE_LABELS: Record<GenerationState, string> = {
  idle: "",
  queued: "Queued…",
  processing: "Generating…",
  finalizing: "Almost there…",
  done: "Done",
  error: "Something went wrong",
};

/** Progress targets for each backend state (actual job states drive these). */
const JOB_STATUS_PROGRESS: Record<NonNullable<BackendJobStatus>, number> = {
  queued: 12,
  processing: 55,
  finalizing: 88,
  complete: 100,
  failed: 0,
};

const JOB_STATUS_STATE: Record<NonNullable<BackendJobStatus>, GenerationState> = {
  queued: "queued",
  processing: "processing",
  finalizing: "finalizing",
  complete: "done",
  failed: "error",
};

/**
 * Read previously persisted generation state from localStorage.
 * Returns `{ startedAt, estimatedMs }` or null if absent/stale.
 */
function readPersisted(
  key: string,
): { startedAt: number; estimatedMs: number } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { startedAt?: number; estimatedMs?: number };
    if (!parsed.startedAt) return null;
    const age = Date.now() - parsed.startedAt;
    if (age > 10 * 60 * 1000) {
      localStorage.removeItem(key);
      return null;
    }
    return { startedAt: parsed.startedAt, estimatedMs: parsed.estimatedMs ?? 15_000 };
  } catch {
    return null;
  }
}

interface UseGenerationProgressOptions {
  /**
   * For blocking mutations: pass TanStack Query mutation booleans directly.
   * Progress is driven by a synthetic ticker while isPending is true.
   */
  isPending?: boolean;
  isError?: boolean;
  isSuccess?: boolean;

  /**
   * For async GPU jobs: pass the actual backend job status string.
   * When provided, overrides the synthetic ticker and maps backend states
   * (queued / processing / finalizing / complete / failed) directly to
   * progress values and GenerationState labels.
   */
  jobStatus?: BackendJobStatus;

  /** Custom labels per state. Falls back to PHASE_LABELS defaults. */
  labels?: Partial<Record<GenerationState, string>>;

  /**
   * Approximate expected duration in ms — used to pace synthetic progress fill.
   * Also used to restore progress position on re-mount when persistKey is set.
   * Default: 15 000.
   */
  estimatedMs?: number;

  /**
   * localStorage key for cross-navigation persistence.
   * When set the hook writes startedAt on start, reads it on mount to
   * resume progress, and clears it on terminal state.
   */
  persistKey?: string;

  /**
   * Set to true for mutations that merely enqueue a GPU job rather than
   * awaiting the result synchronously. When true, mutation success maps to
   * "queued" state (progress ~12%) rather than "done" (100%) — prevents
   * a misleading "complete" bar when the work hasn't actually finished yet.
   */
  asyncEnqueue?: boolean;
}

/**
 * Unified generation progress hook for all Aurora generation pages.
 *
 * Supports two modes:
 *  1. Blocking mutations: drives progress with a synthetic ticker while isPending.
 *  2. Async GPU jobs: drives progress from real backend status via jobStatus prop.
 *
 * Cross-navigation persistence: when persistKey is set, writes startedAt to
 * localStorage on start, restores progress on remount (calculating elapsed %),
 * and clears on terminal state.
 */
export function useGenerationProgress(
  opts: UseGenerationProgressOptions,
): GenerationProgressResult {
  const {
    isPending = false,
    isError = false,
    isSuccess = false,
    jobStatus,
    labels = {},
    estimatedMs = 15_000,
    persistKey,
    asyncEnqueue = false,
  } = opts;

  // --- Restore persisted state on first mount ---------------------------------
  const restoredRef = useRef<{ progress: number; state: GenerationState } | null>(null);
  if (restoredRef.current === null && persistKey) {
    const persisted = readPersisted(persistKey);
    if (persisted) {
      const age = Date.now() - persisted.startedAt;
      const fraction = Math.min(0.9, age / Math.max(persisted.estimatedMs, 3_000));
      const restoredProgress = Math.round(5 + fraction * 85);
      restoredRef.current = { progress: restoredProgress, state: "processing" };
    }
  }
  // Track whether we actually restored (so the stale-clear effect has a stable ref)
  const didRestoreRef = useRef(restoredRef.current !== null);

  const [state, setState] = useState<GenerationState>(
    restoredRef.current?.state ?? "idle",
  );
  const [progress, setProgress] = useState(
    restoredRef.current?.progress ?? 0,
  );

  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPendingRef = useRef(isPending);

  const clearTicker = () => {
    if (tickerRef.current !== null) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  };

  // --- Clear stale persisted state if no active work is detected on mount -----
  // If a generation completed while the user was navigated away, the bar would
  // freeze at some in-progress value. After a short grace window, if neither
  // isPending nor a live jobStatus is driving the bar, reset to idle.
  useEffect(() => {
    if (!persistKey || !didRestoreRef.current) return;
    const t = setTimeout(() => {
      // On mount's first tick: if no live signal, clear the restored state
      if (!prevPendingRef.current && (jobStatus == null)) {
        setState("idle");
        setProgress(0);
        try { localStorage.removeItem(persistKey); } catch {}
      }
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run only on mount

  // --- Real backend jobStatus drives state directly ---------------------------
  useEffect(() => {
    if (jobStatus === undefined || jobStatus === null) return;

    const mappedState = JOB_STATUS_STATE[jobStatus];
    const targetProgress = JOB_STATUS_PROGRESS[jobStatus];

    setState(mappedState);

    if (mappedState === "done") {
      clearTicker();
      setProgress(100);
      if (persistKey) {
        try { localStorage.removeItem(persistKey); } catch {}
      }
      const t = setTimeout(() => {
        setState("idle");
        setProgress(0);
      }, 2200);
      return () => clearTimeout(t);
    }

    if (mappedState === "error") {
      clearTicker();
      setProgress(0);
      if (persistKey) {
        try { localStorage.removeItem(persistKey); } catch {}
      }
      return;
    }

    // For queued/processing/finalizing: set a floor, then let the ticker
    // fill in the gap smoothly so the bar never appears frozen.
    setProgress((prev) => Math.max(prev, targetProgress));

    // Persist start time when work begins (jobStatus mode) so cross-navigation
    // restoration works even when the hook is driven by real backend status.
    if (persistKey && (mappedState === "queued" || mappedState === "processing")) {
      try {
        const existing = readPersisted(persistKey);
        if (!existing) {
          localStorage.setItem(
            persistKey,
            JSON.stringify({ startedAt: Date.now(), estimatedMs }),
          );
        }
      } catch {}
    }

    // Keep ticking if we're mid-flight so the bar doesn't stall
    if (mappedState === "processing" && tickerRef.current === null) {
      const fillTo = JOB_STATUS_PROGRESS.finalizing; // 88
      tickerRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= fillTo) {
            clearTicker();
            return prev;
          }
          return Math.min(fillTo, prev + 0.4 + Math.random() * 0.3);
        });
      }, 800);
    }

    return clearTicker;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobStatus, persistKey, estimatedMs]);

  // --- Synthetic ticker for blocking mutations --------------------------------
  useEffect(() => {
    // Skip this effect if jobStatus is controlling state
    if (jobStatus !== undefined && jobStatus !== null) return;

    const wasActive = prevPendingRef.current;
    prevPendingRef.current = isPending;

    if (isPending && !wasActive) {
      // Generation just started
      clearTicker();

      // If we have a restored position, start from there; else from 5
      const startFrom = restoredRef.current?.progress ?? 5;
      setProgress(startFrom);
      setState("queued");

      if (persistKey) {
        try {
          localStorage.setItem(
            persistKey,
            JSON.stringify({ startedAt: Date.now(), estimatedMs }),
          );
        } catch {}
      }

      const tickInterval = 600;
      const targetMs = Math.max(estimatedMs, 3_000);
      const stepsTo95 = (targetMs / tickInterval) * 0.9;

      tickerRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            setState("finalizing");
            return prev;
          }
          const fraction = prev / 95;
          const delta =
            ((1 - fraction) * 90) / stepsTo95 + Math.random() * 0.5;
          const next = Math.min(95, prev + delta);
          if (next > 30) setState("processing");
          return next;
        });
      }, tickInterval);

      return clearTicker;
    }

    if (!isPending && wasActive) {
      // Mutation just settled
      clearTicker();
      if (persistKey) {
        try { localStorage.removeItem(persistKey); } catch {}
      }

      if (isSuccess) {
        if (asyncEnqueue) {
          // Mutation success = job enqueued on GPU, NOT generation complete.
          // Show "queued" state at low progress to avoid misleading 100% bar.
          setState("queued");
          setProgress(12);
        } else {
          setProgress(100);
          setState("done");
          const t = setTimeout(() => {
            setState("idle");
            setProgress(0);
          }, 2200);
          return () => clearTimeout(t);
        }
      }

      if (isError) {
        setState("error");
        setProgress(0);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, isError, isSuccess, estimatedMs, persistKey, asyncEnqueue, jobStatus]);

  const resolvedLabels = { ...PHASE_LABELS, ...labels };

  return {
    state,
    progress: Math.round(progress),
    label: resolvedLabels[state] ?? "",
    isActive: state !== "idle",
  };
}

/**
 * Map lipsync page's local status strings to BackendJobStatus for the shared hook.
 */
export function lipsyncStatusToJobStatus(
  status: "idle" | "uploading" | "syncing" | "rendering" | "done" | "error",
): BackendJobStatus {
  switch (status) {
    case "idle": return null;
    case "uploading": return "queued";
    case "syncing": return "processing";
    case "rendering": return "finalizing";
    case "done": return "complete";
    case "error": return "failed";
  }
}

/**
 * Check whether a generation was in-progress when the user last navigated away.
 * Returns the elapsed milliseconds since it started, or null if no record exists.
 * @deprecated Use readPersisted (internal) via the hook's persistKey restoration instead.
 */
export function getPersistedProgressAge(persistKey: string): number | null {
  const record = readPersisted(persistKey);
  if (!record) return null;
  return Date.now() - record.startedAt;
}
