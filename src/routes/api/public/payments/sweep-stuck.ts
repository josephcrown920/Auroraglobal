/**
 * Cron endpoint: detect payments stuck in "pending" after Paystack's 72-hour
 * retry window has closed.
 *
 * Paystack retries non-2xx webhook responses for up to 72 hours (live mode).
 * After that, the event is permanently abandoned.  Any `payments` row still
 * in `status = 'pending'` more than 73 hours after creation means either:
 *   a) Paystack exhausted all retries without our webhook returning 200, or
 *   b) the row was created by our recovery path but credit grant failed.
 *
 * Neither case fixes itself automatically — an operator must investigate and,
 * if appropriate, manually trigger processPaymentSuccess for that reference via
 * the Paystack dashboard "resend" feature or by crediting the user directly.
 *
 * Auth: standard cron credential (CRON_SECRET or SUPABASE_PUBLISHABLE_KEY
 *       via the `apikey` header — same as /api/public/jobs/tick).
 *
 * Schedule: add to cron daemon (runs every 6 hours so stuck payments are
 * detected within ~6 hours of Paystack's 72-hour window closing).
 *
 * curl -X POST https://<domain>/api/public/payments/sweep-stuck \
 *      -H "apikey: <SUPABASE_PUBLISHABLE_KEY>"
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authorizeCron } from "@/lib/cron-auth";

const STUCK_THRESHOLD_HOURS = 73;

export const Route = createFileRoute("/api/public/payments/sweep-stuck")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorizeCron(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const cutoff = new Date(
          Date.now() - STUCK_THRESHOLD_HOURS * 60 * 60 * 1000,
        ).toISOString();

        const { data: stuck, error } = await supabaseAdmin
          .from("payments")
          .select("id, reference, user_id, created_at, amount_kobo")
          .eq("status", "pending")
          .lt("created_at", cutoff);

        if (error) {
          console.error("[payments-sweep] DB error", error.message);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const rows = (stuck ?? []) as Array<{
          id: string;
          reference: string;
          user_id: string;
          created_at: string;
          amount_kobo: number;
        }>;

        for (const row of rows) {
          // Structured log — grep for STUCK_PAYMENT in deployment logs to find
          // payments that need manual operator intervention.
          console.error(
            `[payments-sweep] STUCK_PAYMENT id=${row.id} ref=${row.reference} ` +
              `user=${row.user_id} created=${row.created_at} ` +
              `amount_kobo=${row.amount_kobo} — Paystack retries likely exhausted; ` +
              `check Paystack dashboard and credit manually if needed.`,
          );
        }

        const summary = { swept_at: new Date().toISOString(), stuck_count: rows.length };
        if (rows.length > 0) {
          console.warn(
            `[payments-sweep] ${rows.length} payment(s) stuck in pending >73h — operator action required`,
          );
        }

        return new Response(JSON.stringify(summary), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
