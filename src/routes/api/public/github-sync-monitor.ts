/**
 * /api/public/github-sync-monitor
 *
 * Cron-called endpoint (anon-key auth, same as the other public cron routes).
 * Reads the github-sync daemon's local status snapshot
 * (.local/.github-sync-status.json) and emails the operator via Resend when
 * the sync has been broken for over an hour — mirroring the alert/recovery/
 * dedup mechanics of the uptime monitor (uptime_monitor_state, own row
 * id='github_sync').
 *
 * Why this reads a local file instead of the DB: the daemon deliberately
 * keeps its state in untracked local files (see scripts/github-sync-daemon.sh)
 * and the cron daemon calls this route on the same container (localhost:8080),
 * so the file is directly readable. In environments where the daemon never
 * runs (task-agent clones, production deployments) the file is absent and the
 * monitor reports not-configured without alerting — matching the daemon's own
 * main-workspace-only guard.
 *
 * Called by scripts/aurora-cron-daemon.sh every 5 minutes.
 */
import { createFileRoute } from "@tanstack/react-router";
import fs from "node:fs";
import path from "node:path";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  decideAlertTransition,
  evaluateGitHubSync,
  BROKEN_ALERT_THRESHOLD_MS,
} from "@/lib/github-sync-alert";

type MonitorState = {
  id: string;
  consecutive_failures: number;
  last_ok_at: string | null;
  alert_sent_at: string | null;
  recovery_sent_at: string | null;
};

export const Route = createFileRoute("/api/public/github-sync-monitor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ── Auth (standard cron credential) ──────────────────────────────────
        const apiKey = request.headers.get("apikey") ?? request.headers.get("x-api-key") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();

        // ── Read the daemon's status snapshot ────────────────────────────────
        const statusPath = path.join(process.cwd(), ".local", ".github-sync-status.json");
        let raw: unknown = null;
        try {
          raw = JSON.parse(fs.readFileSync(statusPath, "utf8"));
        } catch {
          // absent or unparseable → not configured here; evaluate handles null
        }

        const evaluation = evaluateGitHubSync(raw, nowMs);
        if (!evaluation.configured) {
          return json({ ok: true, configured: false, alert_sent: false, recovery_sent: false });
        }

        // ── Load monitor state (own row, same table as the uptime probe) ─────
        const client = supabaseAdmin as unknown as {
          from: (t: "uptime_monitor_state") => {
            select: (c: string) => {
              eq: (col: string, val: string) => {
                maybeSingle: () => Promise<{ data: MonitorState | null }>;
              };
            };
            upsert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
          };
        };

        const { data: state } = await client
          .from("uptime_monitor_state")
          .select("id, consecutive_failures, last_ok_at, alert_sent_at, recovery_sent_at")
          .eq("id", "github_sync")
          .maybeSingle();
        const prev = state ?? {
          id: "github_sync",
          consecutive_failures: 0,
          last_ok_at: null,
          alert_sent_at: null,
          recovery_sent_at: null,
        };

        const transition = decideAlertTransition({
          broken: evaluation.broken,
          nowMs,
          prevLastOkAt: prev.last_ok_at,
          prevAlertSentAt: prev.alert_sent_at,
          prevRecoverySentAt: prev.recovery_sent_at,
        });

        let alertSentAt = prev.alert_sent_at;
        let recoverySentAt = prev.recovery_sent_at;

        if (transition.sendAlert) {
          const brokenMin = Math.round(transition.brokenForMs / 60_000);
          const sent = await sendOperatorAlert({
            subject: `⚠️ Aurora GitHub sync has been broken for ${brokenMin} min`,
            body: `
              <p style="margin:0 0 14px;font-size:15px;color:#f87171">
                Commits on this workspace are <strong>not reaching GitHub</strong>.
                The sync has been failing for ~${brokenMin} minutes.
              </p>
              <div style="background:#1c1c2e;border:1px solid rgba(248,113,113,0.3);border-radius:8px;padding:14px;margin:0 0 16px;font-size:13px;font-family:monospace;color:#fca5a5">
                ${escHtml(evaluation.reason ?? "unknown failure")}
              </div>
              <p style="margin:0;font-size:14px;color:#9ca3af">
                Most common causes: the GITHUB_TOKEN secret expired (regenerate it),
                or the github-sync workflow stopped. The admin dashboard banner has
                details. This alert will not repeat until the sync recovers and
                breaks again.
              </p>`,
          });
          if (sent) alertSentAt = nowIso;
        } else if (transition.sendRecovery) {
          const sent = await sendOperatorAlert({
            subject: `✅ Aurora GitHub sync recovered`,
            body: `
              <p style="margin:0 0 14px;font-size:15px;color:#6ee7b7">
                GitHub sync is <strong>pushing commits normally</strong> again.
              </p>`,
          });
          if (sent) recoverySentAt = nowIso;
        }

        // ── Persist state ─────────────────────────────────────────────────────
        await client.from("uptime_monitor_state").upsert({
          id: "github_sync",
          consecutive_failures: evaluation.broken ? prev.consecutive_failures + 1 : 0,
          last_check_at: nowIso,
          last_ok_at: transition.nextLastOkAt,
          last_error: evaluation.reason,
          alert_sent_at: alertSentAt,
          recovery_sent_at: recoverySentAt,
          updated_at: nowIso,
        });

        return json({
          ok: !evaluation.broken,
          configured: true,
          reason: evaluation.reason ?? undefined,
          broken_for_min: evaluation.broken
            ? Math.round(transition.brokenForMs / 60_000)
            : 0,
          alert_after_min: Math.round(BROKEN_ALERT_THRESHOLD_MS / 60_000),
          alert_sent: alertSentAt !== prev.alert_sent_at,
          recovery_sent: recoverySentAt !== prev.recovery_sent_at,
        });
      },
    },
  },
});

// ─── Helpers (same shape as the uptime monitor's) ────────────────────────────

function json(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function sendOperatorAlert(opts: { subject: string; body: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const to = process.env.AURORA_ALERT_EMAIL || "hello@auroraperformancestudio.com";
  const from =
    process.env.AURORA_FROM_EMAIL || "Aurora Alerts <noreply@auroraperformancestudio.com>";

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Aurora GitHub Sync Alert</title></head>
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
    Aurora Performance Studio &nbsp;·&nbsp; GitHub Sync Monitor
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
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
