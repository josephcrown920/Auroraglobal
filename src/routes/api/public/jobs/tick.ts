// Worker tick endpoint. Authenticated via Supabase anon `apikey` header
// (matches our pg_cron pattern). Processes up to N queued jobs per tick.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/jobs/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") || request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
        }
        const { processBatch } = await import("@/lib/jobs.server");
        const workerId = `tick:${crypto.randomUUID().slice(0, 8)}`;
        const results = await processBatch(workerId, 5);
        return new Response(JSON.stringify({ ok: true, results }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});