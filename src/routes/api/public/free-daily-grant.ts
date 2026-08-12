// POST /api/public/free-daily-grant — cron endpoint granting EVERY user
// (free AND pro) +4 Aura once per calendar day (UTC). Idempotent: the
// daily_grant partial unique ledger index means repeat calls within the same
// day credit nobody twice, so the cron may safely retry.
// Authed via the Supabase anon `apikey` header — same pattern as
// /api/public/vast/expire and /api/public/workers/health.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/free-daily-grant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ||
          request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Day is always the DB clock's current UTC date — never caller-controlled.
        const { data, error } = await supabaseAdmin.rpc(
          "grant_free_daily_aura_all",
          {},
        );

        if (error) {
          console.error("[free-daily-grant] RPC error:", error.message);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const day = new Date().toISOString().slice(0, 10);
        console.info(`[free-daily-grant] Credited ${data} users for ${day}`);
        return new Response(JSON.stringify({ ok: true, credited: data, day }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
