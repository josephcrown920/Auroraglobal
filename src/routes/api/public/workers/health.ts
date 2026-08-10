// GPU worker health-check endpoint. Authenticated via Supabase anon `apikey`
// header (matches our pg_cron pattern, same as /api/public/jobs/tick). Probes
// every `custom`/`runpod` worker and flips active/paused without an admin
// clicking the ping button, so dispatch routes around dead instances on its own.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/workers/health")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ||
          request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { checkGPUWorkerHealth } = await import("@/lib/gpu-worker-health");
        // Defensive default: tolerate mocked/legacy implementations that
        // resolve to undefined instead of a report object.
        const { autoPaused = [] } = (await checkGPUWorkerHealth(supabaseAdmin as never)) ?? {};

        // Email the operator for every worker that was NEWLY auto-paused this
        // sweep. We skip workers that were already paused before this run
        // (checkGPUWorkerHealth only returns workers that flipped status).
        if (autoPaused.length > 0) {
          const alertEmail = process.env.AURORA_ALERT_EMAIL;
          if (alertEmail) {
            try {
              const apiKey = process.env.RESEND_API_KEY;
              if (!apiKey) throw new Error("RESEND_API_KEY not set");
              const from =
                process.env.AURORA_FROM_EMAIL ||
                "Aurora Studio <noreply@auroraperformancestudio.com>";
              const workerList = autoPaused
                .map((w) => `• ${w.name} (${w.endpoint_url}): ${w.error ?? "no response"}`)
                .join("\n");
              const body = [
                `The Aurora health cron just auto-paused ${autoPaused.length} worker(s) because their /health endpoint stopped responding:`,
                "",
                workerList,
                "",
                "These workers will NOT receive any new jobs until they come back online and you click Resume (or the next successful health probe auto-resumes them).",
                "",
                "Check the Admin → Workers panel for full probe details and recent registration attempts.",
                "",
                `— Aurora platform (${new Date().toUTCString()})`,
              ].join("\n");
              await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  from,
                  to: alertEmail,
                  subject: `[Aurora] ${autoPaused.length} GPU worker(s) went offline`,
                  text: body,
                }),
              });
            } catch (emailErr) {
              // Email failure is never fatal — the health sweep itself succeeded.
              console.error("[workers/health] alert email failed:", emailErr instanceof Error ? emailErr.message : emailErr);
            }
          }
        }

        return new Response(JSON.stringify({ ok: true, autoPaused: autoPaused.length }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
