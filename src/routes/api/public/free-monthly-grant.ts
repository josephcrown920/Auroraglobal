/**
 * Cron endpoint: grant 20 Aura to every Free-tier user for the current month.
 * Authenticated by the Supabase anon key (apikey header) — same pattern as
 * other protected cron routes in the codebase.
 *
 * Schedule externally (e.g. GitHub Actions / Render cron / Uptime Robot):
 *   curl -X POST https://<domain>/api/public/free-monthly-grant \
 *        -H "apikey: <SUPABASE_ANON_KEY>"
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/free-monthly-grant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth: require the Supabase anon key in the apikey header.
        const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
        const provided = request.headers.get("apikey") ?? "";
        if (!anonKey || !provided || provided !== anonKey) {
          return new Response("Unauthorized", { status: 401 });
        }

        const month = new URL(request.url).searchParams.get("month") ??
          new Date().toISOString().slice(0, 7);  // e.g. "2026-07"

        const { data, error } = await supabaseAdmin.rpc(
          "grant_free_monthly_aura_all" as any,
          { _month: month } as any,
        );

        if (error) {
          console.error("[free-monthly-grant] RPC error:", error.message);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        console.info(`[free-monthly-grant] Credited ${data} users for month ${month}`);
        return new Response(JSON.stringify({ ok: true, credited: data, month }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
