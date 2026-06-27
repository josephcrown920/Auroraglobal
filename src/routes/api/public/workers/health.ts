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
        await checkGPUWorkerHealth(supabaseAdmin);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
