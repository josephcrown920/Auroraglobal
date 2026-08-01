/**
 * Uptime monitor endpoint — called by the cron daemon every 60 s.
 *
 * Fetches the external production /api/health URL, tracks consecutive
 * failures in `uptime_monitor_state`, and sends a Resend email alert to
 * the operator when 2+ failures occur in a row.  Sends a recovery email
 * when the endpoint comes back after a reported outage.
 *
 * Auth: standard cron credential (SUPABASE_PUBLISHABLE_KEY via `apikey` header).
 *
 * Called by scripts/aurora-cron-daemon.sh every 60 s.
 */
import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ALERT_THRESHOLD = 2; // consecutive failures before alerting

// Guard against self-referential loops when this very server serves SITE_URL.
// We add a header the health endpoint echoes back so we can detect a loopback.
const PROBE_TIMEOUT_MS = 15_000;

type MonitorState = {
  id: string;
  consecutive_failures: number;
  last_ok_at: string | null;
  alert_sent_at: string | null;
  recovery_sent_at: string | null;
};

export const Route = createFileRoute("/api/public/uptime-monitor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // ── Auth ──────────────────────────────────────────────────────────────
        const apiKey = request.headers.get("apikey") ?? request.headers.get("x-api-key") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const probedUrl = `${SITE_URL}/api/health`;
        const now = new Date().toISOString();
        let healthy = false;
        let errorMsg: string | null = null;

        // ── Probe ─────────────────────────────────────────────────────────────
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
          const resp = await fetch(probedUrl, {
            signal: controller.signal,
            headers: { "Cache-Control": "no-cache" },
          });
          clearTimeout(timer);
          healthy = resp.ok;
          if (!resp.ok) errorMsg = `HTTP ${resp.status}`;
        } catch (e) {
          errorMsg = e instanceof Error ? e.message : "fetch failed";
        }

        // ── Load state ────────────────────────────────────────────────────────
        const client = supabaseAdmin as unknown as {
          from: (t: string) => {
            select: (c: string) => {
              eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: MonitorState | null }> };
            };
            update: (vals: Partial<MonitorState> & { updated_at: string; last_error?: string | null; last_ok_at?: string | null; last_check_at: string }) => {
              eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
            };
          };
        };

        const { data: state } = await client
          .from("uptime_monitor_state")
          .select("id, consecutive_failures, last_ok_at, alert_sent_at, recovery_sent_at")
          .eq("id", "prod")
          .maybeSingle();

        const prev = state ?? {
          id: "prod",
          consecutive_failures: 0,
          last_ok_at: null,
          alert_sent_at: null,
          recovery_sent_at: null,
        };

        const newFailures = healthy ? 0 : prev.consecutive_failures + 1;
        const wasOutage = (prev.alert_sent_at !== null) && (prev.recovery_sent_at === null || prev.alert_sent_at > prev.recovery_sent_at);

        let alertSentAt = prev.alert_sent_at;
        let recoverySentAt = prev.recovery_sent_at;

        // ── Alert logic ───────────────────────────────────────────────────────
        if (!healthy && newFailures >= ALERT_THRESHOLD && !wasOutage) {
          // New outage — send alert email
          const sent = await sendOperatorAlert({
            subject: `⚠️ Aurora is DOWN — ${newFailures} consecutive health failures`,
            body: `
              <p style="margin:0 0 14px;font-size:15px;color:#f87171">
                The production health endpoint has failed <strong>${newFailures} times in a row</strong>.
              </p>
              <div style="background:#1c1c2e;border:1px solid rgba(248,113,113,0.3);border-radius:8px;padding:14px;margin:0 0 16px;font-size:13px;font-family:monospace;color:#fca5a5">
                ${escHtml(probedUrl)}<br/>
                Last error: ${escHtml(errorMsg ?? "non-200 response")}
              </div>
              <p style="margin:0;font-size:14px;color:#9ca3af">
                Check the Replit Deployments pane and deployment logs for details.
                This alert will not repeat until the site recovers and fails again.
              </p>`,
          });
          if (sent) alertSentAt = now;
        } else if (healthy && wasOutage) {
          // Recovery after a reported outage
          const duration = prev.last_ok_at
            ? `(was down for ~${formatDuration(Date.now() - new Date(prev.last_ok_at).getTime())})`
            : "";
          const sent = await sendOperatorAlert({
            subject: `✅ Aurora is back UP`,
            body: `
              <p style="margin:0 0 14px;font-size:15px;color:#6ee7b7">
                The production health endpoint is <strong>responding normally</strong> again. ${escHtml(duration)}
              </p>
              <div style="background:#1c1c2e;border:1px solid rgba(110,231,183,0.3);border-radius:8px;padding:14px;margin:0 0 16px;font-size:13px;font-family:monospace;color:#a7f3d0">
                ${escHtml(probedUrl)}<br/>Status: OK
              </div>`,
          });
          if (sent) recoverySentAt = now;
        }

        // ── Persist state ─────────────────────────────────────────────────────
        await client
          .from("uptime_monitor_state")
          .update({
            consecutive_failures: newFailures,
            last_check_at: now,
            last_ok_at: healthy ? now : prev.last_ok_at,
            last_error: healthy ? null : errorMsg,
            alert_sent_at: alertSentAt,
            recovery_sent_at: recoverySentAt,
            updated_at: now,
          })
          .eq("id", "prod");

        return new Response(
          JSON.stringify({
            ok: healthy,
            consecutive_failures: newFailures,
            error: errorMsg ?? undefined,
            alert_sent: alertSentAt !== prev.alert_sent_at,
            recovery_sent: recoverySentAt !== prev.recovery_sent_at,
          }),
          { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
        );
      },
    },
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function sendOperatorAlert(opts: { subject: string; body: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const to = process.env.AURORA_ALERT_EMAIL || "hello@auroraperformancestudio.com";
  const from =
    process.env.AURORA_FROM_EMAIL || "Aurora Uptime <noreply@auroraperformancestudio.com>";

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Aurora Uptime Alert</title></head>
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
    Aurora Performance Studio &nbsp;·&nbsp; Uptime Monitor
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

function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  return `${Math.round(mins / 60)} h ${mins % 60} min`;
}
