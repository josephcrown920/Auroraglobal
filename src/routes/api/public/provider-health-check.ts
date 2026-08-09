/**
 * /api/public/provider-health-check
 *
 * Cron-called endpoint (anon-key auth, same as other public cron routes).
 * Inspects recent `provider_logs` error rates per generation kind (image /
 * video / lipsync / audio / …) and sends an operator alert email when a kind
 * goes dark (>80 % errors in the last hour with ≥3 attempts, or zero successes
 * across ≥5 attempts in the last 2 hours).
 *
 * Alert state is persisted in `generation_health_state` so duplicate emails
 * are suppressed until recovery, and a recovery email is sent when a kind
 * comes back healthy.
 *
 * Called by scripts/aurora-cron-daemon.sh every 15 minutes.
 */

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Kinds we actively monitor — these are the user-visible generation types.
const MONITORED_KINDS: string[] = ["image", "video", "lipsync", "audio", "motion"];

// Look-back windows for error-rate analysis.
const WINDOW_RECENT_H = 1;   // short window: 1 hour — for high-error-rate detection
const WINDOW_DARK_H   = 2;   // longer window: 2 hours — for "zero successes" (kind went dark)

// Thresholds
const MIN_ATTEMPTS_RATE  = 3;   // need ≥3 attempts in WINDOW_RECENT_H to compute error rate
const MIN_ATTEMPTS_DARK  = 5;   // need ≥5 attempts in WINDOW_DARK_H to declare "dark"
const ERROR_RATE_THRESH  = 0.8; // >80 % errors → alert

// Alert dedup: don't re-alert if we already sent one within this window.
const ALERT_COOLDOWN_H = 4;

// ─── Auth ────────────────────────────────────────────────────────────────────
const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

export const Route = createFileRoute("/api/public/provider-health-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey") ?? request.headers.get("x-api-key") ?? "";
        if (!ANON_KEY || apiKey !== ANON_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const result = await runHealthCheck();
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});

// ─── Core logic (exported for direct testing) ─────────────────────────────────

// Maintenance lock: while a smoke test is manipulating generation_health_state,
// it writes a `__maintenance__` sentinel row. Regular (cron) runs skip entirely
// while the sentinel is fresh, so the smoke run and the cron never interleave.
// Stale sentinels (crashed smoke run) expire automatically.
export const MAINTENANCE_KIND = "__maintenance__";
const MAINTENANCE_TTL_MS = 5 * 60_000;

export async function runHealthCheck(
  opts?: { bypassMaintenanceLock?: boolean },
): Promise<Record<string, unknown>> {
  const now = new Date();
  const nowIso = now.toISOString();

  if (!opts?.bypassMaintenanceLock) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lockDb = supabaseAdmin as any;
    const { data: lock } = await lockDb
      .from("generation_health_state")
      .select("kind, updated_at")
      .eq("kind", MAINTENANCE_KIND)
      .maybeSingle();
    if (lock && Date.now() - new Date(lock.updated_at).getTime() < MAINTENANCE_TTL_MS) {
      console.log("[provider-health-check] skipped — maintenance lock held");
      return { ok: true, skipped: "maintenance_lock", checked_at: nowIso };
    }
  }

  // ── 1. Query provider_logs error rates per kind ──────────────────────────
  const cutoffRecent = new Date(now.getTime() - WINDOW_RECENT_H * 3600_000).toISOString();
  const cutoffDark   = new Date(now.getTime() - WINDOW_DARK_H   * 3600_000).toISOString();

  // Fetch all logs in the longer window (covers both checks)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  const { data: logs, error: logsError } = await db
    .from("provider_logs")
    .select("kind, status, created_at")
    .in("kind", MONITORED_KINDS)
    .gte("created_at", cutoffDark)
    .order("created_at", { ascending: false });

  if (logsError) {
    console.error("[provider-health-check] DB error reading provider_logs:", logsError.message);
    return { ok: false, error: logsError.message };
  }

  // Aggregate per kind
  type KindStats = {
    recentTotal: number; recentErrors: number;
    darkTotal: number; darkSuccesses: number;
  };
  const stats = new Map<string, KindStats>();
  for (const kind of MONITORED_KINDS) {
    stats.set(kind, { recentTotal: 0, recentErrors: 0, darkTotal: 0, darkSuccesses: 0 });
  }

  for (const row of logs ?? []) {
    const s = stats.get(row.kind as string);
    if (!s) continue;
    const inRecent = row.created_at >= cutoffRecent;
    s.darkTotal++;
    if (row.status === "ok") s.darkSuccesses++;
    if (inRecent) {
      s.recentTotal++;
      if (row.status !== "ok") s.recentErrors++;
    }
  }

  // ── 2. Load current alert state from DB ──────────────────────────────────
  const { data: stateRows } = await db
    .from("generation_health_state")
    .select("*")
    .in("kind", MONITORED_KINDS);

  const stateByKind = new Map<string, GenerationHealthState>();
  for (const row of stateRows ?? []) {
    stateByKind.set(row.kind, row as GenerationHealthState);
  }

  // ── 3. Evaluate each kind and decide alert / recovery ────────────────────
  const summary: Record<string, string> = {};
  const alertsSent: string[] = [];
  const recoveriesSent: string[] = [];

  for (const kind of MONITORED_KINDS) {
    const s = stats.get(kind)!;
    const prev = stateByKind.get(kind) ?? defaultState(kind);

    // Determine if this kind is currently degraded
    const highErrorRate =
      s.recentTotal >= MIN_ATTEMPTS_RATE &&
      s.recentErrors / s.recentTotal > ERROR_RATE_THRESH;

    const wentDark =
      s.darkTotal >= MIN_ATTEMPTS_DARK &&
      s.darkSuccesses === 0;

    const degraded = highErrorRate || wentDark;

    const wasAlerting =
      prev.alert_sent_at !== null &&
      (prev.recovery_sent_at === null || prev.alert_sent_at > prev.recovery_sent_at);

    let alertSentAt = prev.alert_sent_at;
    let recoverySentAt = prev.recovery_sent_at;
    const consecutiveErrors = degraded ? prev.consecutive_errors + 1 : 0;
    const consecutiveOk = degraded ? 0 : prev.consecutive_ok + 1;
    const lastOkAt = degraded ? prev.last_ok_at : nowIso;

    let lastErrorSummary = prev.last_error_summary;
    if (degraded) {
      lastErrorSummary = highErrorRate
        ? `${Math.round((s.recentErrors / s.recentTotal) * 100)}% error rate in last ${WINDOW_RECENT_H}h (${s.recentErrors}/${s.recentTotal} attempts)`
        : `0 successes in last ${WINDOW_DARK_H}h (${s.darkTotal} attempts)`;
    }

    if (degraded && !wasAlerting) {
      // Check alert cooldown — don't re-alert if we already sent one recently
      const lastAlert = prev.alert_sent_at ? new Date(prev.alert_sent_at).getTime() : 0;
      const cooldownExpired = Date.now() - lastAlert > ALERT_COOLDOWN_H * 3600_000;

      if (cooldownExpired) {
        const sent = await sendOperatorAlert({
          subject: `🚨 Aurora ${kind} generation is DOWN`,
          body: buildAlertBody(kind, lastErrorSummary ?? ""),
        });
        if (sent) {
          alertSentAt = nowIso;
          alertsSent.push(kind);
          console.log(`[provider-health-check] alert sent for kind=${kind}`);
        }
      }
    } else if (!degraded && wasAlerting) {
      // Recovery
      const sent = await sendOperatorAlert({
        subject: `✅ Aurora ${kind} generation recovered`,
        body: buildRecoveryBody(kind, prev.last_ok_at),
      });
      if (sent) {
        recoverySentAt = nowIso;
        recoveriesSent.push(kind);
        console.log(`[provider-health-check] recovery sent for kind=${kind}`);
      }
    }

    summary[kind] = degraded
      ? `DOWN — ${lastErrorSummary}`
      : s.darkTotal === 0
        ? "no traffic"
        : "ok";

    // Upsert state
    await db.from("generation_health_state").upsert({
      kind,
      consecutive_ok: consecutiveOk,
      consecutive_errors: consecutiveErrors,
      last_ok_at: lastOkAt,
      alert_sent_at: alertSentAt,
      recovery_sent_at: recoverySentAt,
      last_error_summary: lastErrorSummary,
      last_check_at: nowIso,
      updated_at: nowIso,
    }, { onConflict: "kind" });
  }

  return {
    ok: true,
    checked_at: nowIso,
    summary,
    alerts_sent: alertsSent,
    recoveries_sent: recoveriesSent,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type GenerationHealthState = {
  kind: string;
  consecutive_ok: number;
  consecutive_errors: number;
  last_ok_at: string | null;
  alert_sent_at: string | null;
  recovery_sent_at: string | null;
  last_error_summary: string | null;
  last_check_at: string | null;
  updated_at: string;
};

function defaultState(kind: string): GenerationHealthState {
  return {
    kind,
    consecutive_ok: 0,
    consecutive_errors: 0,
    last_ok_at: null,
    alert_sent_at: null,
    recovery_sent_at: null,
    last_error_summary: null,
    last_check_at: null,
    updated_at: new Date().toISOString(),
  };
}

// ─── Email helpers ────────────────────────────────────────────────────────────

async function sendOperatorAlert(opts: { subject: string; body: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const to = process.env.AURORA_ALERT_EMAIL || "hello@auroraperformancestudio.com";
  const from =
    process.env.AURORA_FROM_EMAIL || "Aurora Alerts <noreply@auroraperformancestudio.com>";

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Aurora Generation Alert</title></head>
<body style="margin:0;padding:0;background:#080a12;font-family:system-ui,-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080a12">
<tr><td align="center" style="padding:40px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="padding-bottom:24px;text-align:center">
    <span style="font-size:22px;font-weight:800;color:#a78bfa">Aurora</span><span style="font-size:22px;font-weight:300;color:#6b7280"> Studio</span>
  </td></tr>
  <tr><td style="background:#0f1123;border:1px solid rgba(167,139,250,0.18);border-radius:14px;padding:32px 28px">
    ${opts.body}
  </td></tr>
  <tr><td style="padding-top:18px;text-align:center;font-size:11px;color:#374151">
    Aurora Performance Studio &nbsp;·&nbsp; Generation Health Monitor
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: opts.subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

function buildAlertBody(kind: string, summary: string): string {
  return `
    <p style="margin:0 0 14px;font-size:15px;color:#f87171;font-weight:600">
      ⚠️ ${escHtml(kind.toUpperCase())} generation is failing
    </p>
    <p style="margin:0 0 10px;font-size:14px;color:#d1d5db">
      Aurora's automated health monitor detected that <strong>${escHtml(kind)}</strong>
      generation has crossed the error threshold:
    </p>
    <p style="margin:0 0 18px;font-size:13px;color:#f87171;background:#1f1f3a;border-radius:8px;padding:12px 14px">
      ${escHtml(summary)}
    </p>
    <p style="margin:0 0 10px;font-size:13px;color:#9ca3af">
      Check <strong>provider_logs</strong> in the database or visit the Admin → Orchestration
      panel to investigate which provider(s) are failing and why
      (e.g. exhausted API credits, account suspension, quota exceeded).
    </p>
    <p style="margin:0;font-size:12px;color:#6b7280">
      A recovery email will be sent automatically once ${escHtml(kind)} generation succeeds again.
    </p>
  `;
}

function buildRecoveryBody(kind: string, lastOkAt: string | null): string {
  const downSince = lastOkAt
    ? `Last successful ${kind} generation: ${new Date(lastOkAt).toUTCString()}`
    : `No recent successful ${kind} generation on record`;
  return `
    <p style="margin:0 0 14px;font-size:15px;color:#34d399;font-weight:600">
      ✅ ${escHtml(kind.toUpperCase())} generation has recovered
    </p>
    <p style="margin:0 0 10px;font-size:14px;color:#d1d5db">
      ${escHtml(kind.charAt(0).toUpperCase() + kind.slice(1))} generation is producing
      successful results again.
    </p>
    <p style="margin:0;font-size:12px;color:#6b7280">${escHtml(downSince)}</p>
  `;
}
