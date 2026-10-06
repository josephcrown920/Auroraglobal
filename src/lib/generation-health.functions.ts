/**
 * Server functions for generation health state — used by the admin dashboard
 * to show a banner when any monitored generation kind is degraded.
 *
 * Data is written by the /api/public/provider-health-check cron endpoint
 * and read here for the admin UI.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAdmin } from "@/lib/admin.server";

export type GenerationHealthRow = {
  kind: string;
  consecutive_ok: number;
  consecutive_errors: number;
  last_ok_at: string | null;
  alert_sent_at: string | null;
  recovery_sent_at: string | null;
  last_error_summary: string | null;
  last_check_at: string | null;
  updated_at: string;
};

/** Returns all rows from generation_health_state ordered by kind. */
export const getGenerationHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Admin-only operational data (provider error summaries, alert state).
    // The client-side /admin gate is a UI convenience only — this server
    // function enforces the admin role itself, like every other admin entry
    // point, because any signed-in account can invoke it directly.
    if (!(await isAdmin(context.userId))) throw new Error("Admin access required");
    const { data, error } = await supabaseAdmin
      .from("generation_health_state")
      .select("*")
      // Exclude internal sentinel rows (e.g. "__maintenance__" smoke-test lock).
      .not("kind", "like", "\\_\\_%")
      .order("kind");

    if (error) throw new Error(error.message);
    return (data ?? []) as GenerationHealthRow[];
  });
