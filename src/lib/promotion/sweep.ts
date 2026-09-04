// Pure checkpoint logic for the resumable Promotion daily sweep — no
// server-only imports, so it stays unit-testable and safe anywhere.
//
// Model: one checkpoint row per UTC day (promotion_sweep_state). Each cron
// invocation resumes from persisted keyset cursors, works within a time
// budget, and answers "more" until the day is complete. Per-row failures are
// queued for ONE same-day retry pass; rows that fail again are terminal for
// the day (their last_error stays on the link row and tomorrow's run — a
// fresh checkpoint — retries them).

export const SWEEP_PAGE_SIZE = 400;
/** Comfortably under the daemon's 240s curl cap for the sync endpoint. */
export const SWEEP_TIME_BUDGET_MS = 150_000;
/**
 * Retry-list bound. Beyond it, failures increment retryOverflow (surfaced in
 * the sweep result) and are retried by the next day's fresh checkpoint —
 * never silently dropped.
 */
export const SWEEP_RETRY_CAP = 50_000;

export interface SweepRetryRef {
  user_id: string;
  platform: string;
}

export interface SweepCheckpoint {
  day: string;
  /** Last processed artist_platform_links.sweep_seq (0 = from the start). */
  linkCursor: number;
  /** Last processed tiktok_accounts.user_id ("" = from the start). */
  tiktokCursor: string;
  linksDone: boolean;
  tiktokDone: boolean;
  retriedToday: boolean;
  retry: SweepRetryRef[];
  /** Failures that did not fit in the retry list — retried tomorrow. */
  retryOverflow: number;
  synced: number;
  failed: number;
  skipped: number;
}

/** Valid uuid sorting before every real user id — the "from the start" cursor. */
export const TIKTOK_CURSOR_START = "00000000-0000-0000-0000-000000000000";

export function freshCheckpoint(day: string): SweepCheckpoint {
  return {
    day,
    linkCursor: 0,
    tiktokCursor: TIKTOK_CURSOR_START,
    linksDone: false,
    tiktokDone: false,
    retriedToday: false,
    retry: [],
    retryOverflow: 0,
    synced: 0,
    failed: 0,
    skipped: 0,
  };
}

export type SweepAction = "links" | "tiktok" | "retry" | "done";

/** What the runner works on next. Links always precede TikTok accounts so the
 *  TikTok phase can skip accounts already synced via a cached link row. */
export function nextSweepAction(s: SweepCheckpoint): SweepAction {
  if (!s.linksDone) return "links";
  if (!s.tiktokDone) return "tiktok";
  if (!s.retriedToday && s.retry.length > 0) return "retry";
  return "done";
}

/** Record a row outcome; failures queue for the end-of-day retry pass. */
export function recordOutcome(
  s: SweepCheckpoint,
  outcome: "synced" | "failed" | "skipped",
  ref?: SweepRetryRef,
): void {
  s[outcome] += 1;
  if (outcome === "failed" && ref) {
    if (s.retry.length >= SWEEP_RETRY_CAP) {
      s.retryOverflow += 1; // surfaced in the result; retried tomorrow
      return;
    }
    if (!s.retry.some((r) => r.user_id === ref.user_id && r.platform === ref.platform)) {
      s.retry.push(ref);
    }
  }
}

/** End the retry pass: remaining entries are terminal for the day. */
export function finishRetryPass(s: SweepCheckpoint): void {
  s.retriedToday = true;
  s.retry = [];
}

export function sweepComplete(s: SweepCheckpoint): boolean {
  return s.linksDone && s.tiktokDone && (s.retriedToday || s.retry.length === 0);
}
