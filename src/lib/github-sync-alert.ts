/**
 * Pure decision logic for the GitHub-sync operator alert.
 *
 * The github-sync daemon (scripts/github-sync-daemon.sh) writes a local status
 * snapshot to .local/.github-sync-status.json. The cron-called monitor route
 * (/api/public/github-sync-monitor) reads that file and uses these helpers to
 * decide when the operator should be emailed. Kept as a pure module (no fs,
 * no Supabase) so the timing/dedup rules are unit-testable.
 *
 * Rules:
 *  - No status file → the sync feature is NOT CONFIGURED in this environment
 *    (task-agent clones idle before ever writing status; the main workspace
 *    only writes it while the daemon runs). Never alert in that case.
 *  - failure_reason set with failures recorded → sync is BROKEN.
 *  - Heartbeat older than SYNC_STALL_THRESHOLD_MS → the daemon itself died,
 *    which is also broken sync (nothing is pushing commits).
 *  - Alert only after the sync has been broken for BROKEN_ALERT_THRESHOLD_MS
 *    measured against the monitor's own last-healthy timestamp — the daemon's
 *    consecutive_failures counter is NOT a clock (auth backoff cycles skip
 *    increments), so time is measured, not counted.
 *  - One alert per outage (alert_sent_at / recovery_sent_at pattern shared
 *    with uptime_monitor_state); a recovery email closes the outage.
 */

/** Daemon heartbeat older than this → daemon considered dead. Daemon polls every 30 s. */
export const SYNC_STALL_THRESHOLD_MS = 10 * 60_000;

/** How long the sync must stay broken before the operator is emailed. */
export const BROKEN_ALERT_THRESHOLD_MS = 60 * 60_000;

export interface SyncEvaluation {
  /** False when the status file is absent/unreadable — never alert then. */
  configured: boolean;
  broken: boolean;
  /** Human-readable reason for the email/state row, null when healthy. */
  reason: string | null;
}

/**
 * Interpret the daemon's status snapshot.
 * `raw` is the parsed JSON of .local/.github-sync-status.json, or null when
 * the file does not exist or failed to parse.
 */
export function evaluateGitHubSync(raw: unknown, nowMs: number): SyncEvaluation {
  if (raw === null || typeof raw !== "object") {
    return { configured: false, broken: false, reason: null };
  }
  const r = raw as {
    last_check_at?: unknown;
    last_success_at?: unknown;
    consecutive_failures?: unknown;
    failure_reason?: unknown;
  };

  const lastCheckAt = typeof r.last_check_at === "string" ? Date.parse(r.last_check_at) : NaN;
  const failures = typeof r.consecutive_failures === "number" ? r.consecutive_failures : 0;
  const failureReason = typeof r.failure_reason === "string" ? r.failure_reason : null;

  // Daemon heartbeat gone stale → the daemon died (or its workflow stopped).
  if (!Number.isFinite(lastCheckAt) || nowMs - lastCheckAt > SYNC_STALL_THRESHOLD_MS) {
    const ageMin = Number.isFinite(lastCheckAt)
      ? Math.round((nowMs - lastCheckAt) / 60_000)
      : null;
    return {
      configured: true,
      broken: true,
      reason:
        ageMin === null
          ? "daemon stalled — status heartbeat unreadable"
          : `daemon stalled — no heartbeat for ${ageMin} min`,
    };
  }

  if (failureReason !== null && failures > 0) {
    return {
      configured: true,
      broken: true,
      reason: `${failureReason} — ${failures} consecutive failed sync attempt(s)`,
    };
  }

  return { configured: true, broken: false, reason: null };
}

export interface AlertTransitionInput {
  broken: boolean;
  nowMs: number;
  /** From the monitor state row (uptime_monitor_state id='github_sync'). */
  prevLastOkAt: string | null;
  prevAlertSentAt: string | null;
  prevRecoverySentAt: string | null;
}

export interface AlertTransition {
  sendAlert: boolean;
  sendRecovery: boolean;
  /** Value to persist as last_ok_at (ISO). */
  nextLastOkAt: string | null;
  /** Milliseconds the sync has been broken (0 when healthy). */
  brokenForMs: number;
}

/**
 * Decide whether this check should email the operator.
 * Mirrors the wasOutage dedup used by the uptime monitor: one alert per
 * outage, recovery closes it, nothing repeats in between.
 */
export function decideAlertTransition(input: AlertTransitionInput): AlertTransition {
  const { broken, nowMs, prevLastOkAt, prevAlertSentAt, prevRecoverySentAt } = input;
  const nowIso = new Date(nowMs).toISOString();

  const wasOutage =
    prevAlertSentAt !== null &&
    (prevRecoverySentAt === null || prevAlertSentAt > prevRecoverySentAt);

  if (!broken) {
    return {
      sendAlert: false,
      sendRecovery: wasOutage,
      nextLastOkAt: nowIso,
      brokenForMs: 0,
    };
  }

  // First-ever observation and it is already broken: start the clock now
  // rather than alerting immediately — "broken for over an hour" must be
  // measured, not assumed.
  const lastOkMs = prevLastOkAt !== null ? Date.parse(prevLastOkAt) : NaN;
  const effectiveLastOkMs = Number.isFinite(lastOkMs) ? lastOkMs : nowMs;
  const brokenForMs = Math.max(0, nowMs - effectiveLastOkMs);

  return {
    sendAlert: brokenForMs >= BROKEN_ALERT_THRESHOLD_MS && !wasOutage,
    sendRecovery: false,
    nextLastOkAt: Number.isFinite(lastOkMs) ? prevLastOkAt : nowIso,
    brokenForMs,
  };
}
