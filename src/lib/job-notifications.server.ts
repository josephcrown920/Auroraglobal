// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- generated Supabase types lag the live schema; tracked separately
// @ts-nocheck — stale Supabase types
// Standalone job-status email sender for orchestration runs and ad renders.
// Keeps its own tiny template so we don't have to extend the main registry
// for a purely internal signal. Falls back gracefully when RESEND_API_KEY /
// AURORA_FROM_EMAIL are absent (dev), and logs to email_log so a builder can
// audit which status changes actually notified.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type JobKind = "orchestration" | "ad_render";
export type JobStatus = "queued" | "running" | "completed" | "failed";

export type JobStatusEmailInput = {
  userId: string;
  kind: JobKind;
  status: JobStatus;
  jobId: string;
  /** Optional human title, e.g. "Apex workflow — Miami rooftop shoot". */
  title?: string;
  /** Optional deep link back into /jobs or the completed result. */
  url?: string;
  /** Optional error message for failed status. */
  error?: string;
};

const SITE = "https://auroraperformancestudio.com";

function subjectFor({ kind, status, title }: JobStatusEmailInput): string {
  const k = kind === "orchestration" ? "Orchestration run" : "Ad render";
  const t = title ? ` — ${title}` : "";
  switch (status) {
    case "queued":    return `${k} queued${t}`;
    case "running":   return `${k} started${t}`;
    case "completed": return `${k} complete${t}`;
    case "failed":    return `${k} failed${t}`;
  }
}

function bodyFor(input: JobStatusEmailInput): string {
  const { kind, status, jobId, title, url, error } = input;
  const label = kind === "orchestration" ? "Orchestration run" : "Ad render";
  const link = url ?? `${SITE}/jobs`;
  const rows: string[] = [
    `<h2 style="font-family:system-ui,sans-serif;margin:0 0 12px">${label} · ${status.toUpperCase()}</h2>`,
  ];
  if (title) rows.push(`<p style="font-family:system-ui,sans-serif;margin:0 0 8px">${title}</p>`);
  rows.push(`<p style="font-family:system-ui,sans-serif;color:#555;margin:0 0 16px">Job ID: <code>${jobId}</code></p>`);
  if (status === "failed" && error) {
    rows.push(
      `<pre style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:12px;border-radius:6px;white-space:pre-wrap;word-break:break-word;font-size:12px">${escapeHtml(
        error.slice(0, 800),
      )}</pre>`,
    );
  }
  rows.push(
    `<p style="font-family:system-ui,sans-serif;margin-top:20px"><a href="${link}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600">Open in Aurora</a></p>`,
    `<p style="font-family:system-ui,sans-serif;color:#888;font-size:12px;margin-top:24px">You're receiving this because you started a pipeline job at Aurora Performance Studio.</p>`,
  );
  return `<div style="max-width:560px;margin:0 auto">${rows.join("")}</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Send one job-status email. Best-effort: swallows failures and never throws
 *  — callers use `void sendJobStatusEmail(...)` inside worker code and must
 *  not have their pipeline broken by a mail outage. */
export async function sendJobStatusEmail(input: JobStatusEmailInput): Promise<void> {
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, notify_job_status")
      .eq("user_id", input.userId)
      .maybeSingle();
    const to = profile?.email as string | undefined;
    // Respect the per-user opt-out flag when present; default is ON.
    if (profile && profile.notify_job_status === false) return;
    if (!to) return;

    const subject = subjectFor(input);
    const html = bodyFor(input);

    // Log first so we can trace what fired even when the send is a no-op.
    const { data: record } = await supabaseAdmin
      .from("email_log")
      .insert({
        to_email: to,
        template: `job_${input.kind}_${input.status}`,
        status: "queued",
        user_id: input.userId,
      })
      .select()
      .single();
    const logId = record?.id as string | undefined;

    const apiKey = process.env.RESEND_API_KEY;
    const from =
      process.env.AURORA_FROM_EMAIL || "Aurora Performance Studio <noreply@auroraperformancestudio.com>";
    if (!apiKey) {
      if (logId) await supabaseAdmin.from("email_log").update({ status: "skipped" }).eq("id", logId);
      return;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (logId) {
        await supabaseAdmin
          .from("email_log")
          .update({ status: "failed", error: txt.slice(0, 500) })
          .eq("id", logId);
      }
      return;
    }
    if (logId) await supabaseAdmin.from("email_log").update({ status: "sent" }).eq("id", logId);
  } catch {
    // Never break the caller's pipeline on a mail failure.
  }
}
