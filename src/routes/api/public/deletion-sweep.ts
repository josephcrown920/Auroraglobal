// POST /api/public/deletion-sweep — cron endpoint draining the
// account_deletion_sweeps queue.
//
// When /api/public/account-delete's post-auth final sweep fails, the user's
// login is already gone (they cannot retry), so the failure is queued
// durably and THIS endpoint re-runs the storage+row purge until it succeeds.
// Called hourly by scripts/aurora-cron-daemon.sh.
//
// Authed via the Supabase anon `apikey` header — same pattern as
// /api/public/free-daily-grant and /api/public/workers/health.
import { createFileRoute } from "@tanstack/react-router";

const JSON_HEADERS = { "Content-Type": "application/json" };
const BATCH = 5; // rows per run — sweeps are rare; keep runs short for cron's timeout

export const Route = createFileRoute("/api/public/deletion-sweep")({
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
            headers: JSON_HEADERS,
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { purgeUserStorage, purgeUserRows } = await import("@/lib/account-purge.server");

        const { data: pending, error: readErr } = await supabaseAdmin
          .from("account_deletion_sweeps")
          .select("id, user_id, attempts")
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(BATCH);
        if (readErr) {
          console.error("[deletion-sweep] queue read failed:", readErr.message);
          return new Response(JSON.stringify({ error: "queue read failed" }), {
            status: 500,
            headers: JSON_HEADERS,
          });
        }

        let done = 0;
        let failed = 0;
        for (const row of pending ?? []) {
          try {
            await purgeUserStorage(row.user_id);
            await purgeUserRows(row.user_id);
            const { error } = await supabaseAdmin
              .from("account_deletion_sweeps")
              .update({ status: "done", updated_at: new Date().toISOString() })
              .eq("id", row.id);
            if (error) throw new Error(`status update failed: ${error.message}`);
            done++;
            console.log(`[deletion-sweep] completed purge for ${row.user_id}`);
          } catch (e) {
            failed++;
            const msg = e instanceof Error ? e.message : String(e);
            const attempts = (row.attempts ?? 0) + 1;
            // Never give up — deletion must eventually complete — but get loud
            // once retries pile up so operators notice a stuck purge.
            if (attempts > 5) {
              console.error(
                `[deletion-sweep] CRITICAL: purge for ${row.user_id} still failing after ${attempts} attempts:`,
                msg,
              );
            } else {
              console.error(`[deletion-sweep] purge for ${row.user_id} failed (attempt ${attempts}):`, msg);
            }
            await supabaseAdmin
              .from("account_deletion_sweeps")
              .update({
                attempts,
                last_error: msg.slice(0, 1000),
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.id);
          }
        }

        return new Response(
          JSON.stringify({ ok: true, pending: (pending ?? []).length, done, failed }),
          { status: 200, headers: JSON_HEADERS },
        );
      },
    },
  },
});
