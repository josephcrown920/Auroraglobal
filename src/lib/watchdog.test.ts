import { describe, expect, it } from "bun:test";
import {
  ALERT_CONSECUTIVE_THRESHOLD,
  DEFAULT_STATE_ROW,
  LKG_STALE_MS,
  PROVIDER_MONITOR_SILENCE_MS,
  REMEDIATION_COOLDOWN_MS,
  SIGNAL_UNAVAILABLE_ESCALATE_AFTER,
  SITE_MONITOR_SILENCE_MS,
  SUBSYSTEMS,
  TICK_STALL_MS,
  WORKER_PROBE_STALE_MS,
  decideTransition,
  evaluateBuild,
  evaluateGithubSyncSubsystem,
  evaluateProviders,
  evaluateQueue,
  evaluateScheduler,
  evaluateSite,
  evaluateWorkers,
  remediationDue,
  remediationFor,
  sanitizeErrorDetail,
  signalUnavailableReport,
  type BuildLayerInfo,
  type SchedulerHeartbeat,
  type SubsystemReport,
  type WatchdogStateRow,
  type WorkerRow,
} from "./watchdog";

const NOW = Date.parse("2026-09-05T12:00:00Z");
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

function hb(overrides: Partial<SchedulerHeartbeat> = {}): SchedulerHeartbeat {
  return { last_run_at: iso(30_000), last_ok_at: iso(30_000), last_error: null, ...overrides };
}

function worker(overrides: Partial<WorkerRow> = {}): WorkerRow {
  return {
    id: crypto.randomUUID(),
    name: "w",
    status: "active",
    paused_reason: null,
    last_probe_at: iso(60_000),
    ...overrides,
  };
}

function stateRow(overrides: Partial<WatchdogStateRow> = {}): WatchdogStateRow {
  return { ...DEFAULT_STATE_ROW, ...overrides };
}

function report(overrides: Partial<SubsystemReport> = {}): SubsystemReport {
  return {
    subsystem: "scheduler",
    verdict: "ok",
    detail: "",
    remediation: null,
    escalate: true,
    ...overrides,
  };
}

// ─── scheduler ───────────────────────────────────────────────────────────────

describe("evaluateScheduler", () => {
  it("fresh healthy heartbeat → ok, no remediation", () => {
    const r = evaluateScheduler(hb(), NOW);
    expect(r.verdict).toBe("ok");
    expect(r.remediation).toBeNull();
  });

  it("no heartbeat row at all → down + tick_rerun", () => {
    const r = evaluateScheduler(null, NOW);
    expect(r.verdict).toBe("down");
    expect(r.remediation).toBe("tick_rerun");
    expect(r.escalate).toBe(true);
  });

  it("tick firing but failing (fresh run, stale ok) → degraded + tick_rerun", () => {
    const r = evaluateScheduler(
      hb({ last_ok_at: iso(TICK_STALL_MS + 60_000), last_error: "processBatch exploded" }),
      NOW,
    );
    expect(r.verdict).toBe("degraded");
    expect(r.remediation).toBe("tick_rerun");
    expect(r.detail).toContain("processBatch exploded");
  });

  it("no run at all within the window → down + tick_rerun", () => {
    const r = evaluateScheduler(
      hb({ last_run_at: iso(TICK_STALL_MS + 120_000), last_ok_at: iso(TICK_STALL_MS + 120_000) }),
      NOW,
    );
    expect(r.verdict).toBe("down");
    expect(r.remediation).toBe("tick_rerun");
  });
});

// ─── queue ───────────────────────────────────────────────────────────────────

describe("evaluateQueue", () => {
  const freshMonitor = { last_check_at: iso(30_000) };

  it("no stalled work → ok", () => {
    const r = evaluateQueue({ stalledQueued: 0, staleLocks: 0 }, freshMonitor, NOW);
    expect(r.verdict).toBe("ok");
    expect(r.remediation).toBeNull();
  });

  it("stalled jobs → degraded + tick_rerun, but does not escalate (uptime monitor owns it)", () => {
    const r = evaluateQueue({ stalledQueued: 3, staleLocks: 1 }, freshMonitor, NOW);
    expect(r.verdict).toBe("degraded");
    expect(r.remediation).toBe("tick_rerun");
    expect(r.escalate).toBe(false);
    expect(r.detail).toContain("3 job(s)");
  });

  it("stalled jobs AND a silent queue monitor → escalates itself", () => {
    const stale = { last_check_at: iso(SITE_MONITOR_SILENCE_MS + 60_000) };
    const r = evaluateQueue({ stalledQueued: 2, staleLocks: 0 }, stale, NOW);
    expect(r.verdict).toBe("degraded");
    expect(r.escalate).toBe(true);
  });

  it("healthy queue but silent monitor → degraded + escalate", () => {
    const stale = { last_check_at: iso(SITE_MONITOR_SILENCE_MS + 60_000) };
    const r = evaluateQueue({ stalledQueued: 0, staleLocks: 0 }, stale, NOW);
    expect(r.verdict).toBe("degraded");
    expect(r.escalate).toBe(true);
  });
});

// ─── workers ─────────────────────────────────────────────────────────────────

describe("evaluateWorkers", () => {
  it("no workers registered → ok (provider APIs carry traffic)", () => {
    expect(evaluateWorkers([], NOW).verdict).toBe("ok");
  });

  it("all active → ok", () => {
    const r = evaluateWorkers([worker(), worker()], NOW);
    expect(r.verdict).toBe("ok");
    expect(r.remediation).toBeNull();
  });

  it("admin-paused workers are intentional → ok, never re-probed", () => {
    const r = evaluateWorkers(
      [worker({ status: "paused", paused_reason: null, last_probe_at: iso(3_600_000) })],
      NOW,
    );
    expect(r.verdict).toBe("ok");
    expect(r.remediation).toBeNull();
  });

  it("all workers auto-paused → down + reprobe + escalate (total capacity loss)", () => {
    const r = evaluateWorkers(
      [worker({ status: "paused", paused_reason: "auto" }), worker({ status: "paused", paused_reason: "auto" })],
      NOW,
    );
    expect(r.verdict).toBe("down");
    expect(r.remediation).toBe("worker_reprobe");
    expect(r.escalate).toBe(true);
  });

  it("auto-paused worker with a stale probe → degraded + reprobe (sweep skips paused rows)", () => {
    const r = evaluateWorkers(
      [worker(), worker({ status: "paused", paused_reason: "auto", last_probe_at: iso(WORKER_PROBE_STALE_MS + 60_000) })],
      NOW,
    );
    expect(r.verdict).toBe("degraded");
    expect(r.remediation).toBe("worker_reprobe");
  });

  it("auto-paused worker with a fresh probe and active siblings → ok", () => {
    const r = evaluateWorkers(
      [worker(), worker({ status: "paused", paused_reason: "auto", last_probe_at: iso(60_000) })],
      NOW,
    );
    expect(r.verdict).toBe("ok");
    expect(r.remediation).toBeNull();
  });
});

// ─── providers ───────────────────────────────────────────────────────────────

describe("evaluateProviders", () => {
  const kind = (overrides: Record<string, unknown> = {}) => ({
    kind: "image",
    last_check_at: iso(60_000),
    alert_sent_at: null,
    recovery_sent_at: null,
    ...overrides,
  });

  it("fresh checks, none alerting → ok", () => {
    expect(evaluateProviders([kind()], NOW).verdict).toBe("ok");
  });

  it("kind alerting → degraded but NOT escalated (provider monitor owns the email)", () => {
    const r = evaluateProviders([kind({ alert_sent_at: iso(600_000) })], NOW);
    expect(r.verdict).toBe("degraded");
    expect(r.escalate).toBe(false);
    expect(r.remediation).toBeNull();
  });

  it("recovered kind (recovery after alert) → ok", () => {
    const r = evaluateProviders([kind({ alert_sent_at: iso(600_000), recovery_sent_at: iso(300_000) })], NOW);
    expect(r.verdict).toBe("ok");
  });

  it("stale checks → degraded + escalate (monitor went silent)", () => {
    const r = evaluateProviders([kind({ last_check_at: iso(PROVIDER_MONITOR_SILENCE_MS + 60_000) })], NOW);
    expect(r.verdict).toBe("degraded");
    expect(r.escalate).toBe(true);
    expect(r.detail).toContain("silent");
  });

  it("maintenance sentinel rows are ignored", () => {
    const r = evaluateProviders([{ kind: "__maintenance__", last_check_at: iso(60_000), alert_sent_at: null, recovery_sent_at: null }], NOW);
    expect(r.verdict).toBe("ok");
  });
});

// ─── site ────────────────────────────────────────────────────────────────────

describe("evaluateSite", () => {
  it("no state row yet → ok (fresh deploy before first cron)", () => {
    expect(evaluateSite(null, NOW).verdict).toBe("ok");
  });

  it("fresh passing probe → ok", () => {
    expect(evaluateSite({ last_check_at: iso(30_000), consecutive_failures: 0 }, NOW).verdict).toBe("ok");
  });

  it("probe failing → degraded, escalate=false (uptime monitor emails)", () => {
    const r = evaluateSite({ last_check_at: iso(30_000), consecutive_failures: 4 }, NOW);
    expect(r.verdict).toBe("degraded");
    expect(r.escalate).toBe(false);
  });

  it("stale monitor row → degraded + escalate (nobody watching production)", () => {
    const r = evaluateSite({ last_check_at: iso(SITE_MONITOR_SILENCE_MS + 60_000), consecutive_failures: 0 }, NOW);
    expect(r.verdict).toBe("degraded");
    expect(r.escalate).toBe(true);
  });
});

// ─── github_sync ─────────────────────────────────────────────────────────────

describe("evaluateGithubSyncSubsystem", () => {
  const freshMonitor = { last_check_at: iso(60_000) };
  const sync = (overrides: Record<string, unknown> = {}) => ({
    last_check_at: iso(30_000),
    last_success_at: iso(120_000),
    consecutive_failures: 0,
    failure_reason: null,
    ...overrides,
  });

  it("absent status file → ok, not configured", () => {
    const r = evaluateGithubSyncSubsystem(null, freshMonitor, NOW);
    expect(r.verdict).toBe("ok");
    expect(r.remediation).toBeNull();
  });

  it("healthy sync → ok", () => {
    expect(evaluateGithubSyncSubsystem(sync(), freshMonitor, NOW).verdict).toBe("ok");
  });

  it("sync broken but daemon alive → degraded, no remediation, no escalation (monitor owns it)", () => {
    const r = evaluateGithubSyncSubsystem(
      sync({ failure_reason: "push_failed", consecutive_failures: 5 }),
      freshMonitor,
      NOW,
    );
    expect(r.verdict).toBe("degraded");
    expect(r.remediation).toBeNull();
    expect(r.escalate).toBe(false);
  });

  it("daemon dead → down + relaunch remediation + escalate", () => {
    const r = evaluateGithubSyncSubsystem(
      sync({ last_check_at: iso(11 * 60_000) }),
      freshMonitor,
      NOW,
    );
    expect(r.verdict).toBe("down");
    expect(r.remediation).toBe("github_sync_relaunch");
    expect(r.escalate).toBe(true);
  });

  it("broken sync + silent monitor → escalates", () => {
    const r = evaluateGithubSyncSubsystem(
      sync({ failure_reason: "token_invalid", consecutive_failures: 2 }),
      { last_check_at: iso(20 * 60_000) },
      NOW,
    );
    expect(r.escalate).toBe(true);
  });
});

// ─── build ───────────────────────────────────────────────────────────────────

describe("evaluateBuild", () => {
  const build = (overrides: Partial<BuildLayerInfo> = {}): BuildLayerInfo => ({
    hasOutputDir: true,
    hasCurrentEntry: true,
    hasLkg: true,
    lkgBuiltAt: iso(3600_000),
    servingFromFallback: false,
    ...overrides,
  });

  it("healthy build + fresh restore point → ok", () => {
    expect(evaluateBuild(build(), NOW).verdict).toBe("ok");
  });

  it("serving from fallback → down", () => {
    const r = evaluateBuild(build({ servingFromFallback: true }), NOW);
    expect(r.verdict).toBe("down");
    expect(r.escalate).toBe(true);
  });

  it("broken current build WITH fallback → degraded but never pages (partial dev builds are normal)", () => {
    const r = evaluateBuild(build({ hasCurrentEntry: false }), NOW);
    expect(r.verdict).toBe("degraded");
    expect(r.escalate).toBe(false);
  });

  it("broken current build WITHOUT fallback → down", () => {
    expect(evaluateBuild(build({ hasCurrentEntry: false, hasLkg: false }), NOW).verdict).toBe("down");
  });

  it("stale restore point → degraded", () => {
    const r = evaluateBuild(build({ lkgBuiltAt: iso(LKG_STALE_MS + 86_400_000) }), NOW);
    expect(r.verdict).toBe("degraded");
    expect(r.detail).toContain("days old");
  });

  it("no build output at all (dev server) → ok, never alertable", () => {
    const r = evaluateBuild(build({ hasOutputDir: false, hasCurrentEntry: false, hasLkg: false, lkgBuiltAt: null }), NOW);
    expect(r.verdict).toBe("ok");
  });
});

// ─── transitions ─────────────────────────────────────────────────────────────

describe("decideTransition", () => {
  it("first degraded pass → no alert yet (threshold not reached)", () => {
    const t = decideTransition(report({ verdict: "degraded" }), stateRow(), NOW);
    expect(t.failures).toBe(1);
    expect(t.sendAlert).toBe(false);
    expect(t.sendRecovery).toBe(false);
  });

  it("second consecutive degraded pass → alert", () => {
    const t = decideTransition(
      report({ verdict: "degraded" }),
      stateRow({ consecutive_failures: ALERT_CONSECUTIVE_THRESHOLD - 1 }),
      NOW,
    );
    expect(t.failures).toBe(ALERT_CONSECUTIVE_THRESHOLD);
    expect(t.sendAlert).toBe(true);
  });

  it("escalate=false never emails but still counts failures", () => {
    const t = decideTransition(
      report({ verdict: "degraded", escalate: false }),
      stateRow({ consecutive_failures: 10 }),
      NOW,
    );
    expect(t.sendAlert).toBe(false);
    expect(t.failures).toBe(11);
  });

  it("one alert per outage — no repeat while alert is open", () => {
    const t = decideTransition(
      report({ verdict: "degraded" }),
      stateRow({ consecutive_failures: 5, alert_sent_at: iso(600_000) }),
      NOW,
    );
    expect(t.sendAlert).toBe(false);
  });

  it("recovery after an open alert → recovery email", () => {
    const t = decideTransition(
      report({ verdict: "ok" }),
      stateRow({ consecutive_failures: 5, alert_sent_at: iso(600_000) }),
      NOW,
    );
    expect(t.sendRecovery).toBe(true);
    expect(t.failures).toBe(0);
    expect(t.lastOkAt).toBe(new Date(NOW).toISOString());
  });

  it("recovery without a prior alert → no email", () => {
    const t = decideTransition(report({ verdict: "ok" }), stateRow({ consecutive_failures: 2 }), NOW);
    expect(t.sendRecovery).toBe(false);
  });

  it("alert then recovery then new failure → new alert allowed", () => {
    const prev = stateRow({
      consecutive_failures: ALERT_CONSECUTIVE_THRESHOLD - 1,
      alert_sent_at: iso(3600_000),
      recovery_sent_at: iso(600_000),
    });
    const t = decideTransition(report({ verdict: "degraded" }), prev, NOW);
    expect(t.sendAlert).toBe(true);
  });
});

// ─── signal unavailability ───────────────────────────────────────────────────

describe("signalUnavailableReport", () => {
  it("is degraded but quiet while the failure is fresh", () => {
    const r = signalUnavailableReport("scheduler", "connection reset", 0);
    expect(r.verdict).toBe("degraded");
    expect(r.escalate).toBe(false);
    expect(r.remediation).toBeNull();
    expect(r.detail).toContain("signal unavailable");
    expect(r.detail).toContain("1 consecutive");
  });

  it("stays quiet right up to the bound", () => {
    const r = signalUnavailableReport("queue", "boom", SIGNAL_UNAVAILABLE_ESCALATE_AFTER - 2);
    expect(r.escalate).toBe(false);
  });

  it("escalates once the subsystem has been unobservable for the bound", () => {
    const r = signalUnavailableReport("queue", "boom", SIGNAL_UNAVAILABLE_ESCALATE_AFTER - 1);
    expect(r.escalate).toBe(true);
  });

  it("sanitizes the failure reason", () => {
    const r = signalUnavailableReport("providers", "fetch https://internal-host:9000/x?key=supersecrettokenvalue123456 failed", 0);
    expect(r.detail).not.toContain("https://");
    expect(r.detail).not.toContain("supersecrettokenvalue123456");
  });
});

describe("SUBSYSTEMS", () => {
  it("covers every subsystem exactly once", () => {
    expect(SUBSYSTEMS).toEqual(["site", "scheduler", "queue", "workers", "providers", "github_sync", "build"]);
  });
});

// ─── error sanitization ──────────────────────────────────────────────────────

describe("sanitizeErrorDetail", () => {
  it("strips URLs", () => {
    expect(sanitizeErrorDetail("GET https://api.replicate.com/v1/models?token=abc failed")).not.toContain("https://");
    expect(sanitizeErrorDetail("see http://x.internal:8080/path")).toContain("[url]");
  });

  it("redacts long token-like strings but keeps normal words", () => {
    const out = sanitizeErrorDetail("provider r8_4f9c2e7b1a3d5f8e9c0b2a4d6e8f0a1b rejected the request");
    expect(out).toContain("[redacted]");
    expect(out).not.toContain("4f9c2e7b1a3d5f8e9c0b2a4d6e8f0a1b");
    expect(out).toContain("rejected the request");
  });

  it("bounds length and collapses whitespace", () => {
    const out = sanitizeErrorDetail(("line one\n  line two   " + "x".repeat(500)));
    expect(out.length).toBeLessThanOrEqual(200);
    expect(out).not.toContain("\n");
  });
});

// ─── remediation gating ──────────────────────────────────────────────────────

describe("remediation gating", () => {
  it("ok verdicts never remediate", () => {
    expect(remediationFor(report({ verdict: "ok", remediation: "tick_rerun" }), stateRow(), NOW)).toBeNull();
  });

  it("no prior action → due", () => {
    expect(remediationDue(null, NOW)).toBe(true);
  });

  it("action within cooldown → not due", () => {
    expect(remediationDue(iso(REMEDIATION_COOLDOWN_MS - 60_000), NOW)).toBe(false);
  });

  it("action past cooldown → due", () => {
    expect(remediationDue(iso(REMEDIATION_COOLDOWN_MS + 60_000), NOW)).toBe(true);
  });

  it("cooldown blocks the remediation even when the subsystem is down", () => {
    const r = report({ verdict: "down", remediation: "github_sync_relaunch" });
    expect(remediationFor(r, stateRow({ last_action_at: iso(60_000) }), NOW)).toBeNull();
    expect(remediationFor(r, stateRow({ last_action_at: iso(REMEDIATION_COOLDOWN_MS + 1_000) }), NOW)).toBe(
      "github_sync_relaunch",
    );
  });
});
