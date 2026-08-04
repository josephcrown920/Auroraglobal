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

        // ── Render-queue distress check (same alert/dedup mechanics, own state
        // row `id='queue'`). Best-effort: a distress-check bug must never break
        // the site-uptime probe above.
        let queueCheck: QueueDistressResult = {
          distressed: false,
          reason: null,
          alert_sent: false,
          recovery_sent: false,
        };
        try {
          queueCheck = await checkQueueDistress(now);
        } catch (e) {
          console.error("[uptime-monitor] queue distress check failed", e);
        }

        return new Response(
          JSON.stringify({
            ok: healthy,
            consecutive_failures: newFailures,
            error: errorMsg ?? undefined,
            alert_sent: alertSentAt !== prev.alert_sent_at,
            recovery_sent: recoverySentAt !== prev.recovery_sent_at,
            queue: queueCheck,
          }),
          { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
        );
      },
    },
  },
});

// ─── Render-queue distress ───────────────────────────────────────────────────
// The job queue is the delivery path for every paid render (including Video
// Agent). Two stall signals, both of which mean customers are waiting on work
// that will never arrive without operator action:
//   • a job has been ELIGIBLE (past any scheduled_at backoff) and queued for
//     >20 min — the tick/scheduler isn't draining the queue;
//   • a processing row's lock is >30 min old — twice the 15-min stale-sweep
//     window, so the sweeps themselves aren't running.
// Alert/dedup mechanics mirror the site probe: 2 consecutive distressed checks
// → one email; recovery email when the queue drains after a reported stall.

const QUEUE_ALERT_THRESHOLD = 2;
const QUEUED_STALL_MIN = 20;
const LOCK_STALL_MIN = 30;

type QueueDistressResult = {
  distressed: boolean;
  reason: string | null;
  alert_sent: boolean;
  recovery_sent: boolean;
};

async function checkQueueDistress(nowIso: string): Promise<QueueDistressResult> {
  // jobs scheduling columns aren't all in the generated types — narrow cast.
  const db = supabaseAdmin as unknown as {
    from: (t: string) => {
      select: (
        c: string,
        o?: { count?: "exact"; head?: boolean },
      ) => {
        eq: (col: string, val: string) => {
          lt: (col: string, val: string) => PromiseLike<{ count: number | null }>;
          or: (f: string) => PromiseLike<{ count: number | null }>;
        };
      };
    };
  };

  const queuedCutoff = new Date(Date.now() - QUEUED_STALL_MIN * 60_000).toISOString();
  const lockCutoff = new Date(Date.now() - LOCK_STALL_MIN * 60_000).toISOString();

  // A job is "stalled" only when it has been ELIGIBLE for the whole window.
  // Retries keep their original created_at while scheduled_at carries the
  // backoff, so aging by created_at alone would flag a freshly-eligible retry
  // as a 20-minute stall the moment its backoff expires (false alarm).
  const stalledQueued = await db
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued")
    .or(
      `and(scheduled_at.is.null,created_at.lt.${queuedCutoff}),scheduled_at.lt.${queuedCutoff}`,
    );
  const staleLocks = await db
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "processing")
    .lt("locked_at", lockCutoff);

  const nQueued = stalledQueued.count ?? 0;
  const nStale = staleLocks.count ?? 0;
  const distressed = nQueued > 0 || nStale > 0;
  const reason = distressed
    ? `${nQueued} job(s) queued >${QUEUED_STALL_MIN} min · ${nStale} processing lock(s) >${LOCK_STALL_MIN} min`
    : null;

  const stateClient = supabaseAdmin as unknown as {
    from: (t: "uptime_monitor_state") => {
      select: (c: string) => {
        eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: MonitorState | null }> };
      };
      upsert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
  };

  const { data: state } = await stateClient
    .from("uptime_monitor_state")
    .select("id, consecutive_failures, last_ok_at, alert_sent_at, recovery_sent_at")
    .eq("id", "queue")
    .maybeSingle();
  const prev = state ?? {
    id: "queue",
    consecutive_failures: 0,
    last_ok_at: null,
    alert_sent_at: null,
    recovery_sent_at: null,
  };

  const failures = distressed ? prev.consecutive_failures + 1 : 0;
  const wasOutage =
    prev.alert_sent_at !== null &&
    (prev.recovery_sent_at === null || prev.alert_sent_at > prev.recovery_sent_at);

  let alertSentAt = prev.alert_sent_at;
  let recoverySentAt = prev.recovery_sent_at;

  if (distressed && failures >= QUEUE_ALERT_THRESHOLD && !wasOutage) {
    const sent = await sendOperatorAlert({
      subject: `⚠️ Aurora render queue is stalled`,
      body: `
        <p style="margin:0 0 14px;font-size:15px;color:#f87171">
          Paid renders are waiting on a queue that is <strong>not being drained</strong>.
        </p>
        <div style="background:#1c1c2e;border:1px solid rgba(248,113,113,0.3);border-radius:8px;padding:14px;margin:0 0 16px;font-size:13px;font-family:monospace;color:#fca5a5">
          ${escHtml(reason ?? "")}
        </div>
        <p style="margin:0;font-size:14px;color:#9ca3af">
          Check that the cron workflow is running and that /api/public/jobs/tick returns 200.
          Customers whose renders never start are holding reserved Aura until the sweeps recover them.
          This alert will not repeat until the queue drains and stalls again.
        </p>`,
    });
    if (sent) alertSentAt = nowIso;
  } else if (!distressed && wasOutage) {
    const sent = await sendOperatorAlert({
      subject: `✅ Aurora render queue recovered`,
      body: `
        <p style="margin:0 0 14px;font-size:15px;color:#6ee7b7">
          The render queue is <strong>draining normally</strong> again — no stalled jobs or stale locks.
        </p>`,
    });
    if (sent) recoverySentAt = nowIso;
  }

  await stateClient.from("uptime_monitor_state").upsert({
    id: "queue",
    consecutive_failures: failures,
    last_check_at: nowIso,
    last_ok_at: distressed ? prev.last_ok_at : nowIso,
    last_error: reason,
    alert_sent_at: alertSentAt,
    recovery_sent_at: recoverySentAt,
    updated_at: nowIso,
  });

  return {
    distressed,
    reason,
    alert_sent: alertSentAt !== prev.alert_sent_at,
    recovery_sent: recoverySentAt !== prev.recovery_sent_at,
  };
}

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
