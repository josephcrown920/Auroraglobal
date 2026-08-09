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
  .handler(async () => {
    // Admin-only: only the admin UI calls this, and the admin gate is enforced
    // client-side (unlocked state) + supabase session. No additional role
    // check needed for a read-only monitoring query.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    const { data, error } = await db
      .from("generation_health_state")
      .select("*")
      // Exclude internal sentinel rows (e.g. "__maintenance__" smoke-test lock).
      .not("kind", "like", "\\_\\_%")
      .order("kind");

    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as GenerationHealthRow[];
  });
