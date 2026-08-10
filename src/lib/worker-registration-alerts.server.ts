/**
 * Worker registration alert computation.
 *
 * Pure functions that derive actionable operator alerts from existing DB rows
 * (gpu_workers + worker_register_attempts). No DB access — callers pass data
 * in so these functions are fully unit-testable without mocking Supabase.
 *
 * Alert kinds:
 *   auth_failure        — registration attempted but the secret didn't match;
 *                         includes fingerprint details so the operator can
 *                         diagnose which secret the worker is using.
 *   never_registered    — recent failed attempts from an endpoint that has no
 *                         gpu_workers row yet (bad payload, network error, etc.)
 *   pending_stale       — a gpu_workers row stuck in pending_approval beyond
 *                         PENDING_STALE_MINUTES; the worker did register but
 *                         the operator hasn't reviewed it yet.
 *   unreachable         — a previously-active worker that was auto-paused by the
 *                         health cron because its /health probe failed.
 */

import { normalizeWorkerBase } from "./gpu-worker-health";

// ── Tunables ──────────────────────────────────────────────────────────────────

/** How long (minutes) a pending_approval row is allowed to sit before alerting. */
export const PENDING_STALE_MINUTES = 30;

/** Look-back window (hours) for failed register attempts. */
export const ATTEMPT_WINDOW_HOURS = 4;

// ── Types ─────────────────────────────────────────────────────────────────────

export type WorkerAlertKind =
  | "auth_failure"
  | "never_registered"
  | "pending_stale"
  | "unreachable";

export type WorkerAlert = {
  kind: WorkerAlertKind;
  /** "error" = blocks jobs right now; "warning" = action needed soon. */
  severity: "error" | "warning";
  title: string;
  /** Actionable guidance for the operator. */
  detail: string;
  /** Set when the alert maps to an existing gpu_workers row. */
  workerId?: string;
  workerName?: string;
  endpoint?: string;
  /** Number of failed registration attempts (auth_failure / never_registered). */
  attemptCount?: number;
  /** ISO timestamp of the most recent attempt or relevant event. */
  lastAttemptAt?: string;
  /** ISO timestamp when the worker first entered pending_approval. */
  pendingSince?: string;
};

// We use loose Record types so callers can pass raw Supabase rows without
// having to import generated DB types into a pure computation module.
type DbWorker = Record<string, unknown>;
type DbAttempt = Record<string, unknown>;

// ── Core computation ──────────────────────────────────────────────────────────

/**
 * Derive operator alerts from the current DB snapshot.
 *
 * @param workers   All rows from `gpu_workers` (auth_token stripped).
 * @param attempts  Recent rows from `worker_register_attempts`.
 * @param nowMs     Current time in ms (injectable for testing; defaults to Date.now()).
 */
export function computeWorkerAlerts(
  workers: DbWorker[],
  attempts: DbAttempt[],
  nowMs: number = Date.now(),
): WorkerAlert[] {
  const alerts: WorkerAlert[] = [];
  const pendingCutoff = nowMs - PENDING_STALE_MINUTES * 60_000;
  const attemptCutoff = nowMs - ATTEMPT_WINDOW_HOURS * 3_600_000;

  // Build a map from normalised endpoint → existing worker row so we can
  // correlate register_attempts to gpu_workers rows by URL.
  const workerByEndpoint = new Map<string, DbWorker>();
  for (const w of workers) {
    const ep = normalizeWorkerBase(String(w.endpoint_url ?? ""));
    if (ep) workerByEndpoint.set(ep, w);
  }

  // ── 1. PENDING_STALE ─────────────────────────────────────────────────────
  for (const w of workers) {
    if (w.status !== "pending_approval") continue;
    const createdMs = new Date(String(w.created_at ?? "")).getTime();
    if (isNaN(createdMs) || createdMs > pendingCutoff) continue;
    const ageMin = Math.round((nowMs - createdMs) / 60_000);
    alerts.push({
      kind: "pending_stale",
      severity: "warning",
      title: `Worker "${w.name}" has been pending approval for ${ageMin} minutes`,
      detail:
        `This worker registered successfully (endpoint: ${w.endpoint_url}) and is ` +
        `waiting in pending_approval. Approve it to start routing jobs, or reject it ` +
        `if the registration was unexpected. Workers in pending_approval receive NO jobs.`,
      workerId: String(w.id ?? ""),
      workerName: String(w.name ?? ""),
      endpoint: String(w.endpoint_url ?? ""),
      pendingSince: String(w.created_at ?? ""),
    });
  }

  // ── 2. UNREACHABLE (auto-paused by health cron) ──────────────────────────
  for (const w of workers) {
    if (w.status !== "paused" || w.paused_reason !== "auto") continue;
    const heartbeatMs = w.last_heartbeat
      ? new Date(String(w.last_heartbeat)).getTime()
      : null;
    const heartbeatAge =
      heartbeatMs != null && !isNaN(heartbeatMs)
        ? Math.round((nowMs - heartbeatMs) / 60_000)
        : null;
    const probeErr = String(w.last_probe_error ?? w.last_probe_detail ?? "no response from endpoint");
    alerts.push({
      kind: "unreachable",
      severity: "error",
      title: `Worker "${w.name}" is unreachable — auto-paused by the health cron`,
      detail:
        `Endpoint: ${w.endpoint_url}. ` +
        (heartbeatAge != null ? `Last heartbeat: ${heartbeatAge} min ago. ` : "") +
        `Probe failure: "${probeErr}". ` +
        `Click Resume once the endpoint is reachable again, or Delete if the instance has been terminated.`,
      workerId: String(w.id ?? ""),
      workerName: String(w.name ?? ""),
      endpoint: String(w.endpoint_url ?? ""),
    });
  }

  // ── 3. AUTH_FAILURE / NEVER_REGISTERED ───────────────────────────────────
  // Group recent failed attempts by normalised endpoint. IMPORTANT: the real
  // register route's auth-mismatch path logs an attempt with NO name and NO
  // endpoint_url (it rejects before parsing the body), so attempts without an
  // endpoint must NOT be discarded — they carry the fingerprint diagnostics
  // that matter most. Group them under a synthetic "unknown source" key.
  const UNKNOWN_SOURCE = "\u0000unknown";
  const failedByEndpoint = new Map<string, DbAttempt[]>();
  for (const a of attempts) {
    if (a.ok !== false) continue;
    const attemptMs = new Date(String(a.created_at ?? "")).getTime();
    if (isNaN(attemptMs) || attemptMs < attemptCutoff) continue;
    const rawEp = a.endpoint_url == null ? "" : String(a.endpoint_url);
    const ep = rawEp ? normalizeWorkerBase(rawEp) : "";
    const key = ep || UNKNOWN_SOURCE;
    if (!failedByEndpoint.has(key)) failedByEndpoint.set(key, []);
    failedByEndpoint.get(key)!.push(a);
  }

  for (const [ep, failedAttempts] of failedByEndpoint) {
    // Most-recent first.
    failedAttempts.sort(
      (a, b) =>
        new Date(String(b.created_at ?? "")).getTime() -
        new Date(String(a.created_at ?? "")).getTime(),
    );
    const latest = failedAttempts[0];
    const latestError = String(latest.error ?? latest.outcome ?? "unknown error");
    const isAuthError = /auth|secret|unauthorized|fingerprint|mismatch|token|apikey/i.test(latestError);
    const isUnknownSource = ep === UNKNOWN_SOURCE;
    const matchedWorker = isUnknownSource ? undefined : workerByEndpoint.get(ep);
    const sourceLabel = isUnknownSource
      ? "an unknown source (rejected before the body was read)"
      : String(latest.name ?? ep);

    if (isAuthError) {
      // The real register route logs the mismatch as
      // "Unauthorized (apikey mismatch or missing) — received fp:<hex> expected fp:<hex>"
      // (one-way SHA-256 fingerprints, never the raw secret). Surface both
      // sides so the operator can compare against the fingerprint the worker
      // script prints at boot. Also tolerate an "expected … got …" ordering.
      const fpReceivedExpected = latestError.match(
        /received\s+fp:([0-9a-f]{4,}|none)[\s\S]*?expected\s+fp:([0-9a-f]{4,})/i,
      );
      const fpExpectedGot = latestError.match(
        /expected\s+(?:fp:)?([0-9a-f]{4,})[^a-f0-9]+(?:got|received)\s+(?:fp:)?([0-9a-f]{4,}|none)/i,
      );
      const received = fpReceivedExpected?.[1] ?? fpExpectedGot?.[2];
      const expectedFp = fpReceivedExpected?.[2] ?? fpExpectedGot?.[1];
      const fpHint = received && expectedFp
        ? received === "none"
          ? ` The worker sent NO apikey at all, while the server expects a secret with fingerprint ${expectedFp}. Make sure the worker passes AURORA_REGISTER_SECRET in the apikey header.`
          : ` The worker is sending a secret with fingerprint ${received}, but the server expects ${expectedFp}. Update AURORA_REGISTER_SECRET on the worker side to match.`
        : ` Check that AURORA_REGISTER_SECRET on the worker matches the server's configured value (the worker script prints its own key's fingerprint at boot for comparison).`;

      alerts.push({
        kind: "auth_failure",
        severity: "error",
        title: `Registration auth failure from ${isUnknownSource ? sourceLabel : `"${sourceLabel}"`}`,
        detail:
          `${failedAttempts.length} failed attempt(s) in the last ${ATTEMPT_WINDOW_HOURS}h. ` +
          `Latest error: "${latestError}".${fpHint}`,
        workerId: matchedWorker ? String(matchedWorker.id ?? "") : undefined,
        workerName: isUnknownSource ? undefined : String(latest.name ?? matchedWorker?.name ?? ep),
        endpoint: isUnknownSource ? undefined : String(latest.endpoint_url ?? ep),
        attemptCount: failedAttempts.length,
        lastAttemptAt: String(latest.created_at ?? ""),
      });
    } else if (isUnknownSource) {
      // Non-auth failures with no endpoint recorded (e.g. "Invalid JSON body",
      // "Registration disabled") — still worth surfacing; the worker never
      // even got far enough to identify itself.
      alerts.push({
        kind: "never_registered",
        severity: "warning",
        title: "Registration attempt from an unknown source failed — no row created",
        detail:
          `${failedAttempts.length} failed attempt(s) in the last ${ATTEMPT_WINDOW_HOURS}h ` +
          `with no worker name/endpoint recorded. Latest error: "${latestError}". ` +
          `Check the worker's boot log — the request was rejected before the worker could identify itself.`,
        attemptCount: failedAttempts.length,
        lastAttemptAt: String(latest.created_at ?? ""),
      });
    } else if (!matchedWorker) {
      // Non-auth failures with no matching gpu_workers row: the worker tried
      // but registration was rejected for another reason (bad payload, DB error,
      // network issue), so no row was ever created.
      alerts.push({
        kind: "never_registered",
        severity: "warning",
        title: `Worker "${latest.name ?? ep}" failed to register — no row created`,
        detail:
          `${failedAttempts.length} failed attempt(s) in the last ${ATTEMPT_WINDOW_HOURS}h. ` +
          `Latest error: "${latestError}". ` +
          `Check the worker's boot log for payload validation errors or network connectivity issues.`,
        workerName: String(latest.name ?? ep),
        endpoint: String(latest.endpoint_url ?? ep),
        attemptCount: failedAttempts.length,
        lastAttemptAt: String(latest.created_at ?? ""),
      });
    }
  }

  return alerts;
}

/**
 * Format a set of worker alerts as a plain-text email body for the operator.
 * Called by the health cron when it has new alerts to report.
 */
export function formatWorkerAlertsEmail(alerts: WorkerAlert[]): string {
  if (alerts.length === 0) return "No worker alerts.";
  const lines: string[] = [
    `Aurora Worker Alerts — ${new Date().toUTCString()}`,
    "=".repeat(60),
    "",
  ];
  for (const a of alerts) {
    lines.push(`[${a.severity.toUpperCase()}] ${a.title}`);
    lines.push(a.detail);
    if (a.endpoint) lines.push(`  Endpoint: ${a.endpoint}`);
    if (a.lastAttemptAt) lines.push(`  Last attempt: ${new Date(a.lastAttemptAt).toUTCString()}`);
    if (a.pendingSince) lines.push(`  Pending since: ${new Date(a.pendingSince).toUTCString()}`);
    lines.push("");
  }
  lines.push("—");
  lines.push("View the Aurora Admin → Workers panel for details and actions.");
  return lines.join("\n");
}
