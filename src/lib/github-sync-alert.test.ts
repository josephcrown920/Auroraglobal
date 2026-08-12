import { describe, expect, it } from "bun:test";
import {
  BROKEN_ALERT_THRESHOLD_MS,
  SYNC_STALL_THRESHOLD_MS,
  decideAlertTransition,
  evaluateGitHubSync,
} from "./github-sync-alert";

const NOW = Date.parse("2026-08-12T12:00:00Z");
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

function status(overrides: Record<string, unknown> = {}) {
  return {
    last_check_at: iso(30_000), // fresh heartbeat by default
    last_success_at: iso(120_000),
    consecutive_failures: 0,
    failure_reason: null,
    auth_backoff_seconds: 0,
    ...overrides,
  };
}

describe("evaluateGitHubSync", () => {
  it("treats a missing status file as not configured — never alertable", () => {
    const e = evaluateGitHubSync(null, NOW);
    expect(e.configured).toBe(false);
    expect(e.broken).toBe(false);
  });

  it("healthy heartbeat with no failure reason → not broken", () => {
    const e = evaluateGitHubSync(status(), NOW);
    expect(e.configured).toBe(true);
    expect(e.broken).toBe(false);
    expect(e.reason).toBeNull();
  });

  it("failure reason + recorded failures → broken with a descriptive reason", () => {
    const e = evaluateGitHubSync(
      status({ failure_reason: "token_invalid", consecutive_failures: 7 }),
      NOW,
    );
    expect(e.broken).toBe(true);
    expect(e.reason).toContain("token_invalid");
    expect(e.reason).toContain("7");
  });

  it("failure reason with zero failures (post-recovery stale reason) → not broken", () => {
    const e = evaluateGitHubSync(
      status({ failure_reason: "push_failed", consecutive_failures: 0 }),
      NOW,
    );
    expect(e.broken).toBe(false);
  });

  it("stale heartbeat → broken even when the last cycle reported healthy", () => {
    const e = evaluateGitHubSync(
      status({ last_check_at: iso(SYNC_STALL_THRESHOLD_MS + 60_000) }),
      NOW,
    );
    expect(e.broken).toBe(true);
    expect(e.reason).toContain("stalled");
  });

  it("unparseable heartbeat → broken (daemon state unreadable)", () => {
    const e = evaluateGitHubSync(status({ last_check_at: "garbage" }), NOW);
    expect(e.broken).toBe(true);
  });
});

describe("decideAlertTransition — one alert per outage, measured by time not counts", () => {
  it("does NOT alert before the sync has been broken for the threshold", () => {
    const t = decideAlertTransition({
      broken: true,
      nowMs: NOW,
      prevLastOkAt: iso(BROKEN_ALERT_THRESHOLD_MS - 5 * 60_000), // broken 55 min
      prevAlertSentAt: null,
      prevRecoverySentAt: null,
    });
    expect(t.sendAlert).toBe(false);
    expect(t.sendRecovery).toBe(false);
  });

  it("alerts once the broken duration crosses the threshold", () => {
    const t = decideAlertTransition({
      broken: true,
      nowMs: NOW,
      prevLastOkAt: iso(BROKEN_ALERT_THRESHOLD_MS + 60_000), // broken 61 min
      prevAlertSentAt: null,
      prevRecoverySentAt: null,
    });
    expect(t.sendAlert).toBe(true);
    expect(t.brokenForMs).toBeGreaterThanOrEqual(BROKEN_ALERT_THRESHOLD_MS);
  });

  it("does not repeat the alert while the outage is still open", () => {
    const t = decideAlertTransition({
      broken: true,
      nowMs: NOW,
      prevLastOkAt: iso(2 * BROKEN_ALERT_THRESHOLD_MS),
      prevAlertSentAt: iso(30 * 60_000), // alert already sent this outage
      prevRecoverySentAt: null,
    });
    expect(t.sendAlert).toBe(false);
  });

  it("sends a recovery email when the sync heals after a reported outage", () => {
    const t = decideAlertTransition({
      broken: false,
      nowMs: NOW,
      prevLastOkAt: iso(2 * BROKEN_ALERT_THRESHOLD_MS),
      prevAlertSentAt: iso(30 * 60_000),
      prevRecoverySentAt: null,
    });
    expect(t.sendRecovery).toBe(true);
    expect(t.sendAlert).toBe(false);
    expect(t.nextLastOkAt).toBe(new Date(NOW).toISOString());
  });

  it("does not send recovery when no alert was ever sent", () => {
    const t = decideAlertTransition({
      broken: false,
      nowMs: NOW,
      prevLastOkAt: iso(10 * 60_000),
      prevAlertSentAt: null,
      prevRecoverySentAt: null,
    });
    expect(t.sendRecovery).toBe(false);
  });

  it("a second outage after recovery can alert again", () => {
    const t = decideAlertTransition({
      broken: true,
      nowMs: NOW,
      prevLastOkAt: iso(BROKEN_ALERT_THRESHOLD_MS + 60_000),
      prevAlertSentAt: iso(6 * 3600_000), // old outage…
      prevRecoverySentAt: iso(5 * 3600_000), // …closed by recovery
      });
    expect(t.sendAlert).toBe(true);
  });

  it("first-ever observation already broken starts the clock instead of alerting", () => {
    const t = decideAlertTransition({
      broken: true,
      nowMs: NOW,
      prevLastOkAt: null, // no monitor state yet
      prevAlertSentAt: null,
      prevRecoverySentAt: null,
    });
    expect(t.sendAlert).toBe(false);
    expect(t.brokenForMs).toBe(0);
    expect(t.nextLastOkAt).toBe(new Date(NOW).toISOString());
  });

  it("keeps prevLastOkAt while broken so the outage duration accumulates", () => {
    const prevOk = iso(30 * 60_000);
    const t = decideAlertTransition({
      broken: true,
      nowMs: NOW,
      prevLastOkAt: prevOk,
      prevAlertSentAt: null,
      prevRecoverySentAt: null,
    });
    expect(t.nextLastOkAt).toBe(prevOk);
    expect(t.brokenForMs).toBe(30 * 60_000);
  });
});
