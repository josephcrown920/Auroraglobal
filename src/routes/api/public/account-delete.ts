// Account deletion — public endpoint for the mobile app (and future web UI).
// POST /api/public/account-delete   body: { confirm: "DELETE" }
//
// Required by Apple (App Store 5.1.1(v)) and Google Play's account-deletion
// policy: any app that offers account creation must let users delete the
// account in-app.
//
// Deletion strategy (ordered; every step must succeed or the request fails):
//   1. Storage purge — recursive, paginated BFS over every user-owned `studio`
//      namespace (<uid>/**, tts/<uid>/**, ffmpeg-free/<uid>/**) plus
//      user_photo_avatars row paths. HARD-FAIL: any list/remove error or a
//      traversal-cap hit aborts with 500 BEFORE any rows are touched, so a
//      retry sees the account fully intact.
//   2. Explicit row deletes from EVERY user-owned table, children before
//      parents — see src/lib/account-purge.server.ts for the table list and
//      special-key tables (render_jobs, marketplace_*, comfy_workflows).
//      Deleting `jobs` rows neutralizes any queued/processing work: claim
//      finds nothing and worker finalization CAS-fences on the row, so
//      nothing can run or write results after this.
//   3. supabaseAdmin.auth.admin.deleteUser() — removes the login and cascades
//      any FK'd stragglers.
//   4. Final sweep — steps 1 AND 2 re-run after auth deletion to catch
//      anything written mid-request: work claimed from `jobs` before the
//      step-2 purge can still upload bytes and insert telemetry rows
//      (provider_logs / worker_jobs) while this request runs. After the
//      sweep, session tokens are dead and claims find nothing. If the sweep
//      itself fails, the failure is DURABLE: a row is queued in
//      account_deletion_sweeps and the cron-driven /api/public/deletion-sweep
//      endpoint retries the purge hourly until it succeeds — deletion is
//      never silently left incomplete. Only unavoidable residual: a provider
//      call returning after this response may insert a telemetry row
//      referencing the deleted auth user — its result can never attach
//      (finalize CAS-fences on the already-deleted jobs row).
// Retained on purpose (per the published privacy policy): payments (financial
// records) and legal_acceptances (consent evidence) — permitted retention
// categories under store and data-protection rules; they hold no media or
// free-form content. Neither table FKs auth.users, so they survive step 3.
//
// Bearer sessions only — deliberately NOT accepting aurk_* CLI API keys:
// account destruction must come from an interactive login, and a leaked CLI
// key must not be enough to erase an account.
import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export const Route = createFileRoute("/api/public/account-delete")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }),
      POST: async ({ request }) => {
        // Generic + retry-safe failure response: every step is idempotent, no
        // internals are leaked, and nothing user-visible is deleted until the
        // storage purge has fully succeeded.
        const fail = () =>
          new Response(
            JSON.stringify({ error: "Account deletion incomplete — please try again." }),
            { status: 500, headers: CORS },
          );
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { purgeUserStorage, purgeUserRows } = await import("@/lib/account-purge.server");

          const h = request.headers.get("authorization") || request.headers.get("Authorization");
          if (!h?.startsWith("Bearer ") || h.slice(7).startsWith("aurk_")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: CORS,
            });
          }
          const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(h.slice(7));
          if (authError || !authData.user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: CORS,
            });
          }
          const userId = authData.user.id;

          const body = (await request.json().catch(() => null)) as { confirm?: string } | null;
          if (body?.confirm !== "DELETE") {
            return new Response(
              JSON.stringify({ error: 'Missing confirmation — send { "confirm": "DELETE" }' }),
              { status: 400, headers: CORS },
            );
          }

          // ── 1. Storage purge (hard-fail, runs before any row deletes) ──
          try {
            await purgeUserStorage(userId);
          } catch (e) {
            console.error(
              `[account-delete] storage purge for ${userId} aborted:`,
              e instanceof Error ? e.message : e,
            );
            return fail();
          }

          // ── 2. Row deletes — every user-owned table ──
          // Failure → 500 while the auth user still exists, so a retry works.
          try {
            await purgeUserRows(userId);
          } catch (e) {
            console.error(
              `[account-delete] row purge for ${userId} aborted:`,
              e instanceof Error ? e.message : e,
            );
            return fail();
          }

          // ── 3. Auth user last — removes the login itself ──
          const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
          if (delErr) {
            console.error("[account-delete] auth deleteUser failed:", delErr.message);
            return new Response(
              JSON.stringify({
                error: "Account rows were cleared but auth deletion failed — contact support.",
              }),
              { status: 500, headers: CORS },
            );
          }

          // ── 4. Final sweep: storage AND rows re-purged ──
          // Closes the enumerate→delete race (in-flight work claimed before
          // step 2 was observed writing telemetry rows mid-request in e2e).
          // The login is already gone, so the user cannot retry — a sweep
          // failure is therefore made DURABLE instead of being swallowed:
          // it's queued in account_deletion_sweeps and the cron-driven
          // /api/public/deletion-sweep endpoint re-runs the purge hourly
          // until it succeeds.
          try {
            await purgeUserStorage(userId);
            await purgeUserRows(userId);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(
              `[account-delete] final sweep failed for ${userId} — queueing durable retry:`,
              msg,
            );
            const { error: qErr } = await supabaseAdmin
              .from("account_deletion_sweeps")
              .insert({ user_id: userId, last_error: msg.slice(0, 1000) });
            if (qErr) {
              // Last-resort path: queue insert itself failed. Loud, greppable
              // marker for operators — this is the only state that needs a
              // human (uptime alerting watches deployment logs).
              console.error(
                `[account-delete] CRITICAL: could not queue deletion sweep for ${userId} — manual cleanup required:`,
                qErr.message,
              );
            }
          }

          console.log(`[account-delete] user ${userId} deleted`);
          return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
        } catch (e) {
          // Log the detail server-side; never echo internals to the client.
          console.error("[account-delete] fatal:", e instanceof Error ? e.message : e);
          return new Response(
            JSON.stringify({ error: "Account deletion failed — please try again." }),
            { status: 500, headers: CORS },
          );
        }
      },
    },
  },
});
