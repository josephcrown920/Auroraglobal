/**
 * Pure decision logic for the system watchdog ("hound dog").
 *
 * The watchdog endpoint (/api/public/watchdog, called by the cron daemon every
 * 5 min) gathers health signals from every subsystem, then uses these helpers
 * to decide three things per subsystem:
 *   1. verdict        — ok / degraded / down
 *   2. remediation    — at most ONE entry from a conservative allow-list of
 *                       safe, idempotent fix actions (never a novel fix)
 *   3. alert/recovery — whether the operator should be emailed this pass
 *
 * Kept as a pure module (no fs, no fetch, no Supabase) so every rule is
 * unit-testable, mirroring src/lib/github-sync-alert.ts.
 *
 * Alert-duplication policy: subsystems that already have a dedicated emailing
 * monitor (site → uptime monitor, queue → uptime 'queue' row, providers →
 * provider-health-check, github_sync → github-sync monitor, workers → worker
 * sweep) are reported `escalate: false` for conditions that monitor already
 * emails about. The watchdog emails only for what nobody else covers:
 * monitor SILENCE (a monitor stopped checking in), total-capacity loss
 * (all workers down), scheduler failure, build-layer trouble, and anything
 * left degraded after the watchdog's own remediation failed.
 */

import { evaluateGitHubSync } from "./github-sync-alert";

// ─── Thresholds ──────────────────────────────────────────────────────────────

/** jobs/tick runs every 60 s — a healthy heartbeat older than this is a stall. */
export const TICK_STALL_MS = 5 * 60_000;
/** The regular worker sweep runs every 5 min; a paused worker whose last probe
 *  is older than this was missed by the sweep → watchdog re-probes. */
export const WORKER_PROBE_STALE_MS = 12 * 60_000;
/** uptime monitor runs every 60 s; its state row going this stale means the
 *  monitor itself is broken. */
export const SITE_MONITOR_SILENCE_MS = 6 * 60_000;
/** provider-health-check runs every 15 min. */
export const PROVIDER_MONITOR_SILENCE_MS = 45 * 60_000;
/** github-sync monitor runs every 5 min. */
export const GHSYNC_MONITOR_SILENCE_MS = 16 * 60_000;
/** A last-known-good build snapshot older than this is a rotting restore point. */
export const LKG_STALE_MS = 30 * 24 * 3600_000;
/** Minimum gap between two remediation attempts on the same subsystem. */
export const REMEDIATION_COOLDOWN_MS = 30 * 60_000;
/** Consecutive degraded watchdog passes before an escalatable subsystem emails. */
export const ALERT_CONSECUTIVE_THRESHOLD = 2;

// ─── Types ───────────────────────────────────────────────────────────────────

export type Subsystem =
  | "site"
  | "scheduler"
  | "queue"
  | "workers"
  | "providers"
  | "github_sync"
  | "build";

export type Verdict = "ok" | "degraded" | "down";

/** The ONLY fixes the watchdog may attempt. Anything else escalates to email. */
export type RemediationKind = "tick_rerun" | "worker_reprobe" | "github_sync_relaunch";

export interface SubsystemReport {
  subsystem: Subsystem;
  verdict: Verdict;
  /** Human-readable one-liner for the state row / email. */
  detail: string;
  /** Allow-listed fix to attempt this pass, if any. */
  remediation: RemediationKind | null;
  /**
   * false when a dedicated monitor already emails about this exact condition —
   * the watchdog records state but stays quiet to avoid duplicate mail.
   */
  escalate: boolean;
}

/** watchdog_state row shape (columns the logic reads). */
export interface WatchdogStateRow {
  consecutive_failures: number;
  last_ok_at: string | null;
  alert_sent_at: string | null;
  recovery_sent_at: string | null;
  last_action_at: string | null;
}

export const DEFAULT_STATE_ROW: WatchdogStateRow = {
  consecutive_failures: 0,
  last_ok_at: null,
  alert_sent_at: null,
  recovery_sent_at: null,
  last_action_at: null,
};

/** Every subsystem the watchdog reports on, in stable display order. */
export const SUBSYSTEMS: Subsystem[] = [
  "site",
  "scheduler",
  "queue",
  "workers",
  "providers",
  "github_sync",
  "build",
];

/**
 * A signal that cannot be gathered (DB read failure, etc.) is reported as
 * degraded-but-quiet so a transient hiccup never pages anyone. If the same
 * subsystem stays unobservable for this many consecutive passes (~30 min at
 * the 5-min cadence) the observation failure ITSELF becomes the incident and
 * escalates — a watchdog that cannot see must not stay silent forever.
 */
export const SIGNAL_UNAVAILABLE_ESCALATE_AFTER = 6;

export function signalUnavailableReport(
  subsystem: Subsystem,
  why: string,
  prevConsecutiveFailures: number,
): SubsystemReport {
  const failures = prevConsecutiveFailures + 1;
  return {
    subsystem,
    verdict: "degraded",
    detail: `signal unavailable (${failures} consecutive): ${sanitizeErrorDetail(why)}`,
    remediation: null,
    escalate: failures >= SIGNAL_UNAVAILABLE_ESCALATE_AFTER,
  };
}

/**
 * Bound and redact an error string before it is persisted to watchdog_state,
 * returned from the endpoint, or embedded in an operator email. Heartbeat and
 * probe errors originate from arbitrary job/provider exceptions and can carry
 * credentials, signed URLs, or user data.
 */
export function sanitizeErrorDetail(raw: string, maxLen = 200): string {
  return raw
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ageMs(iso: string | null | undefined, nowMs: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, nowMs - t);
}

function fmtAge(ms: number | null): string {
  if (ms === null) return "never";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} h ago`;
}

// ─── Subsystem evaluators ────────────────────────────────────────────────────

export interface SchedulerHeartbeat {
  last_run_at: string | null;
  last_ok_at: string | null;
  last_error: string | null;
}

export function evaluateScheduler(
  hb: SchedulerHeartbeat | null,
  nowMs: number,
): SubsystemReport {
  const base = { subsystem: "scheduler" as const, escalate: true };
  if (!hb) {
    return { ...base, verdict: "down", detail: "no scheduler heartbeat on record — the job tick has never run", remediation: "tick_rerun" };
  }
  const okAge = ageMs(hb.last_ok_at, nowMs);
  if (okAge !== null && okAge <= TICK_STALL_MS) {
    return { ...base, verdict: "ok", detail: `last healthy tick ${fmtAge(okAge)}`, remediation: null };
  }
  const runAge = ageMs(hb.last_run_at, nowMs);
  if (runAge !== null && runAge <= TICK_STALL_MS) {
    // The tick FIRES but keeps failing — the daemon is alive, the work is not.
    return {
      ...base,
      verdict: "degraded",
      detail: `job tick is failing (last ok ${fmtAge(okAge)}): ${hb.last_error ?? "unknown error"}`,
      remediation: "tick_rerun",
    };
  }
  return {
    ...base,
    verdict: "down",
    detail: `no job tick for ${fmtAge(runAge)} — scheduler appears stalled`,
    remediation: "tick_rerun",
  };
}

export interface QueueStats {
  stalledQueued: number;
  staleLocks: number;
}

export function evaluateQueue(
  stats: QueueStats,
  monitorRow: { last_check_at: string | null } | null,
  nowMs: number,
): SubsystemReport {
  const base = { subsystem: "queue" as const };
  // The queue's dedicated alerter lives inside the uptime monitor — if THAT
  // row goes stale, the distress signal has no owner and the watchdog must
  // escalate itself.
  const monitorAge = ageMs(monitorRow?.last_check_at ?? null, nowMs);
  const monitorSilent = monitorRow !== null && (monitorAge === null || monitorAge > SITE_MONITOR_SILENCE_MS);

  if (stats.stalledQueued === 0 && stats.staleLocks === 0) {
    if (monitorSilent) {
      return { ...base, verdict: "degraded", detail: `queue monitor silent (last check ${fmtAge(monitorAge)})`, remediation: null, escalate: true };
    }
    return { ...base, verdict: "ok", detail: "queue draining normally", remediation: null, escalate: true };
  }
  return {
    ...base,
    verdict: "degraded",
    detail: `${stats.stalledQueued} job(s) queued >20 min · ${stats.staleLocks} processing lock(s) >30 min`,
    // The uptime monitor already emails for queue distress — the watchdog
    // nudges the tick instead of duplicating that mail, unless the monitor
    // itself has gone silent.
    escalate: monitorSilent,
    remediation: "tick_rerun",
  };
}

export interface WorkerRow {
  id: string;
  name: string;
  status: string;
  paused_reason: string | null;
  last_probe_at: string | null;
}

export function evaluateWorkers(rows: WorkerRow[], nowMs: number): SubsystemReport {
  const base = { subsystem: "workers" as const };
  if (rows.length === 0) {
    return { ...base, verdict: "ok", detail: "no GPU workers registered (provider APIs carry all traffic)", remediation: null, escalate: true };
  }
  const active = rows.filter((w) => w.status === "active");
  const autoPaused = rows.filter((w) => w.status === "paused" && w.paused_reason === "auto");
  if (active.length === 0 && autoPaused.length > 0) {
    // Total capacity loss — the per-worker "went offline" emails never say
    // "you now have ZERO workers", so this correlated verdict is the
    // watchdog's own to escalate.
    return {
      ...base,
      verdict: "down",
      detail: `all ${autoPaused.length} worker(s) auto-paused — no GPU capacity at all`,
      remediation: "worker_reprobe",
      escalate: true,
    };
  }
  const stalePaused = autoPaused.filter((w) => {
    const a = ageMs(w.last_probe_at, nowMs);
    return a === null || a > WORKER_PROBE_STALE_MS;
  });
  if (stalePaused.length > 0) {
    // The regular sweep skips paused workers, so an auto-paused worker whose
    // probe has gone stale will NEVER recover on its own — re-probe it.
    return {
      ...base,
      verdict: "degraded",
      detail: `${stalePaused.length} auto-paused worker(s) not re-probed for >${Math.round(WORKER_PROBE_STALE_MS / 60_000)} min (${active.length} still active)`,
      remediation: "worker_reprobe",
      escalate: active.length === 0,
    };
  }
  return {
    ...base,
    verdict: "ok",
    detail: `${active.length} active · ${autoPaused.length} auto-paused · ${rows.length - active.length - autoPaused.length} held by admin`,
    remediation: null,
    escalate: true,
  };
}

export interface ProviderHealthRow {
  kind: string;
  last_check_at: string | null;
  alert_sent_at: string | null;
  recovery_sent_at: string | null;
}

export function evaluateProviders(rows: ProviderHealthRow[], nowMs: number): SubsystemReport {
  const base = { subsystem: "providers" as const };
  const checked = rows
    .filter((r) => !r.kind.startsWith("__"))
    .map((r) => ageMs(r.last_check_at, nowMs))
    .filter((a): a is number => a !== null);
  if (checked.length === 0) {
    return { ...base, verdict: "ok", detail: "provider health monitor has not recorded a check yet", remediation: null, escalate: true };
  }
  const freshest = Math.min(...checked);
  if (freshest > PROVIDER_MONITOR_SILENCE_MS) {
    return {
      ...base,
      verdict: "degraded",
      detail: `provider health monitor silent for ${fmtAge(freshest)} — error rates are not being watched`,
      remediation: null,
      escalate: true,
    };
  }
  const alerting = rows.filter(
    (r) => r.alert_sent_at && (!r.recovery_sent_at || r.alert_sent_at > r.recovery_sent_at),
  );
  if (alerting.length > 0) {
    // provider-health-check already emailed about these kinds.
    return {
      ...base,
      verdict: "degraded",
      detail: `generation kinds alerting: ${alerting.map((r) => r.kind).join(", ")} (provider monitor owns the alert)`,
      remediation: null,
      escalate: false,
    };
  }
  return { ...base, verdict: "ok", detail: `${checked.length} generation kinds healthy`, remediation: null, escalate: true };
}

export function evaluateSite(
  monitorRow: { last_check_at: string | null; consecutive_failures: number } | null,
  nowMs: number,
): SubsystemReport {
  const base = { subsystem: "site" as const };
  if (!monitorRow) {
    return { ...base, verdict: "ok", detail: "uptime monitor has not run yet", remediation: null, escalate: true };
  }
  const a = ageMs(monitorRow.last_check_at, nowMs);
  if (a === null || a > SITE_MONITOR_SILENCE_MS) {
    return {
      ...base,
      verdict: "degraded",
      detail: `uptime monitor silent (last check ${fmtAge(a)}) — production reachability is not being watched`,
      remediation: null,
      escalate: true,
    };
  }
  if (monitorRow.consecutive_failures > 0) {
    return {
      ...base,
      verdict: "degraded",
      detail: `production health probe failing (${monitorRow.consecutive_failures} consecutive) — uptime monitor owns the alert`,
      remediation: null,
      escalate: false,
    };
  }
  return { ...base, verdict: "ok", detail: "production health probe passing", remediation: null, escalate: true };
}

export function evaluateGithubSyncSubsystem(
  statusRaw: unknown,
  monitorRow: { last_check_at: string | null } | null,
  nowMs: number,
): SubsystemReport {
  const base = { subsystem: "github_sync" as const };
  const e = evaluateGitHubSync(statusRaw, nowMs);
  if (!e.configured) {
    return { ...base, verdict: "ok", detail: "github sync not configured in this environment", remediation: null, escalate: true };
  }
  const monitorAge = ageMs(monitorRow?.last_check_at ?? null, nowMs);
  const monitorSilent = monitorRow !== null && (monitorAge === null || monitorAge > GHSYNC_MONITOR_SILENCE_MS);

  if (!e.broken) {
    if (monitorSilent) {
      return { ...base, verdict: "degraded", detail: `github-sync monitor silent (last check ${fmtAge(monitorAge)})`, remediation: null, escalate: true };
    }
    return { ...base, verdict: "ok", detail: "sync healthy", remediation: null, escalate: true };
  }
  const daemonDead = (e.reason ?? "").startsWith("daemon stalled");
  if (daemonDead) {
    // The sync daemon retries failed pushes on its own — a DEAD daemon is the
    // one case it cannot, so the watchdog may relaunch it (self-guarded by
    // the daemon's own REPL_ID check; a no-op anywhere but the main workspace).
    return { ...base, verdict: "down", detail: e.reason ?? "sync daemon stalled", remediation: "github_sync_relaunch", escalate: true };
  }
  return {
    ...base,
    verdict: "degraded",
    detail: e.reason ?? "sync broken",
    remediation: null,
    // The github-sync monitor emails after 60 min broken — unless it is silent.
    escalate: monitorSilent,
  };
}

export interface BuildLayerInfo {
  /** .output/ exists at all (false in a pure dev workspace). */
  hasOutputDir: boolean;
  /** .output/server/index.mjs exists (current build can boot). */
  hasCurrentEntry: boolean;
  /** A last-known-good snapshot exists. */
  hasLkg: boolean;
  /** builtAt from the LKG snapshot's BUILD_INFO.json. */
  lkgBuiltAt: string | null;
  /** The running process was exec'd from the LKG snapshot. */
  servingFromFallback: boolean;
}

export function evaluateBuild(info: BuildLayerInfo, nowMs: number): SubsystemReport {
  const base = { subsystem: "build" as const, escalate: true, remediation: null };
  if (info.servingFromFallback) {
    return { ...base, verdict: "down", detail: "app is serving from the last-known-good snapshot — the current build cannot boot" };
  }
  if (info.hasOutputDir && !info.hasCurrentEntry) {
    // With a fallback available this is informational, not pageable: a dev
    // workspace holding a partial/in-progress build is normal, and the build
    // protection health gate already keeps a bad build out of last-known-good.
    // Only "broken current AND no safety net" is operator-worthy.
    return info.hasLkg
      ? { ...base, verdict: "degraded", escalate: false, detail: "current build output is missing its server entry; fallback snapshot available" }
      : { ...base, verdict: "down", detail: "current build output cannot boot and NO last-known-good snapshot exists" };
  }
  if (info.hasLkg) {
    const a = ageMs(info.lkgBuiltAt, nowMs);
    if (a !== null && a > LKG_STALE_MS) {
      return { ...base, verdict: "degraded", detail: `last-known-good restore point is ${Math.round(a / 86_400_000)} days old — a broken deploy would restore a stale build` };
    }
    return { ...base, verdict: "ok", detail: `restore point from ${fmtAge(a)}` };
  }
  // No build output and no snapshot: normal for a dev workspace that never
  // ran a production build.
  return { ...base, verdict: "ok", detail: "no build output in this environment (dev server)", remediation: null };
}

// ─── Alert / recovery transition ─────────────────────────────────────────────

export interface WatchdogTransition {
  failures: number;
  lastOkAt: string | null;
  sendAlert: boolean;
  sendRecovery: boolean;
}

/**
 * Per-subsystem alert transition. Same dedup semantics as the uptime monitor:
 * one alert per outage after ALERT_CONSECUTIVE_THRESHOLD consecutive degraded
 * passes, and a single recovery email when the subsystem comes back.
 * `escalate: false` reports still count failures (so a condition that later
 * becomes escalatable has its full history) but never themselves email.
 */
export function decideTransition(
  report: Pick<SubsystemReport, "verdict" | "escalate">,
  prev: WatchdogStateRow,
  nowMs: number,
): WatchdogTransition {
  const degraded = report.verdict !== "ok";
  const failures = degraded ? prev.consecutive_failures + 1 : 0;
  const wasOutage =
    prev.alert_sent_at !== null &&
    (prev.recovery_sent_at === null || prev.alert_sent_at > prev.recovery_sent_at);

  return {
    failures,
    lastOkAt: degraded ? prev.last_ok_at : new Date(nowMs).toISOString(),
    sendAlert: degraded && report.escalate && failures >= ALERT_CONSECUTIVE_THRESHOLD && !wasOutage,
    sendRecovery: !degraded && wasOutage,
  };
}

// ─── Remediation gating ──────────────────────────────────────────────────────

/**
 * Cooldown gate for the remediation allow-list. The endpoint enforces this
 * atomically (conditional UPDATE on watchdog_state.last_action_at) so two
 * overlapping runs cannot double-fire; this pure predicate is what that
 * conditional encodes, and what tests pin down.
 */
export function remediationDue(lastActionAt: string | null, nowMs: number): boolean {
  const a = ageMs(lastActionAt, nowMs);
  return a === null || a >= REMEDIATION_COOLDOWN_MS;
}

/** Whether a report's remediation may fire this pass. */
export function remediationFor(
  report: SubsystemReport,
  prev: WatchdogStateRow,
  nowMs: number,
): RemediationKind | null {
  if (report.verdict === "ok" || report.remediation === null) return null;
  if (!remediationDue(prev.last_action_at, nowMs)) return null;
  return report.remediation;
}
