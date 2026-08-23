import { createFileRoute } from "@tanstack/react-router";

// Readiness probe — unlike /api/health (pure process-liveness, always 200),
// this one actually exercises the app's hard dependency: the Supabase
// database. It is additive and does not change /api/health's existing
// contract (the cron daemon and any external monitor already wired to
// /api/health keep behaving exactly as before).
//
// Returns 200 only when a real DB round-trip succeeds within budget;
// otherwise 503 with the failure reason, so this endpoint can be attached to
// an external uptime monitor or a deployment health-check path when needed.
const DB_CHECK_TIMEOUT_MS = 3000;

export const Route = createFileRoute("/api/ready")({
  server: {
    handlers: {
      GET: async () => {
        const startedAt = Date.now();
        const checks: Record<string, { ok: boolean; ms: number; error?: string }> = {};

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const dbStart = Date.now();
          const dbCheck = supabaseAdmin
            .from("app_settings")
            .select("key", { count: "exact", head: true })
            .limit(1);
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), DB_CHECK_TIMEOUT_MS),
          );
          const { error } = await Promise.race([dbCheck, timeout]).then(
            (r) => r as { error: { message: string } | null },
            (e: Error) => ({ error: { message: e.message } }),
          );
          checks.database = { ok: !error, ms: Date.now() - dbStart, ...(error ? { error: error.message } : {}) };
        } catch (e) {
          checks.database = { ok: false, ms: Date.now() - startedAt, error: e instanceof Error ? e.message : String(e) };
        }

        const allOk = Object.values(checks).every((c) => c.ok);
        return new Response(
          JSON.stringify({ ok: allOk, checks, total_ms: Date.now() - startedAt }),
          {
            status: allOk ? 200 : 503,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        );
      },
    },
  },
});
