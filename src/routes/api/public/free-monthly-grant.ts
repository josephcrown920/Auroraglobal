/**
 * Cron endpoint: grant 200 Aura to every Free-tier user for the current month.
 * Authenticated by a timing-safe comparison against SUPABASE_SERVICE_ROLE_KEY
 * (private; NOT the public anon key).  Month is never caller-controlled —
 * the RPC always uses the current month from the database clock.
 *
 * Schedule externally (e.g. GitHub Actions / Render cron):
 *   curl -X POST https://<domain>/api/public/free-monthly-grant \
 *        -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>"
 */
import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/free-monthly-grant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
        if (!secret) return new Response("Not configured", { status: 500 });

        // Timing-safe comparison against the service role key (private, server-only).
        const authHeader = request.headers.get("Authorization") ?? "";
        const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        let authorised = false;
        try {
          const a = Buffer.from(provided.padEnd(secret.length));
          const b = Buffer.from(secret.padEnd(provided.length));
          // Both buffers must be same length for timingSafeEqual
          if (provided.length === secret.length) {
            authorised = timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
          }
        } catch {
          authorised = false;
        }
        if (!authorised) return new Response("Unauthorized", { status: 401 });

        // Month is always the current month — never caller-controlled.
        const { data, error } = await supabaseAdmin.rpc(
          "grant_free_monthly_aura_all" as any,
          {} as any,  // use the function's DEFAULT to_char(now(), 'YYYY-MM')
        );

        if (error) {
          console.error("[free-monthly-grant] RPC error:", error.message);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const month = new Date().toISOString().slice(0, 7);
        console.info(`[free-monthly-grant] Credited ${data} users for month ${month}`);
        return new Response(JSON.stringify({ ok: true, credited: data, month }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
