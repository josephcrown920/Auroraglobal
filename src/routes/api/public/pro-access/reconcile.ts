// POST /api/public/pro-access/reconcile — idempotently expires one-time Pro
// access. Protected for the cron daemon; recurring subscriptions with a future
// provider payment date remain entitled and are deliberately left untouched.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authorizeCronStrict } from "@/lib/cron-auth";
import { safeErrorMessage } from "@/lib/safe-error.server";

export const Route = createFileRoute("/api/public/pro-access/reconcile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorizeCronStrict(request)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        // Generated database types are refreshed immediately after the migration
        // lands; keep this endpoint buildable in the same change set.
        const admin = supabaseAdmin as unknown as {
          rpc: (name: "reconcile_expired_pro_access") => Promise<{
            data: number | null;
            error: { message: string } | null;
          }>;
        };
        const { data, error } = await admin.rpc("reconcile_expired_pro_access");
        if (error) {
          return new Response(
            JSON.stringify({ error: safeErrorMessage("pro-access-reconcile", error.message) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ ok: true, downgraded: data ?? 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});