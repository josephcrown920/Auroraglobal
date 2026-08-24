/**
 * Cron endpoint: detect and auto-recover payments stuck in "pending" after
 * Paystack's 72-hour retry window has closed.
 *
 * Paystack retries non-2xx webhook responses for up to 72 hours (live mode).
 * After that, the event is permanently abandoned.  Any `payments` row still
 * in `status = 'pending'` more than 73 hours after creation means either:
 *   a) Paystack exhausted all retries without our webhook returning 200, or
 *   b) the row was created by our recovery path but the credit grant failed.
 *
 * Recovery strategy (runs for each stuck row):
 *   - If user_id + credits_granted are present: call processPaymentSuccess with
 *     a synthetic event (the function is fully idempotent — it no-ops on already-
 *     succeeded rows) and log AUTO_RECOVERED on success.
 *   - If recovery data is missing, or processPaymentSuccess throws: log
 *     STUCK_PAYMENT so an operator can intervene manually.
 *
 * retryDelaysMs:[] skips the row-polling backoff because the payments row is
 * already guaranteed to exist before this endpoint runs.
 *
 * Auth: server-only CRON_SECRET via the `apikey` header.
 *
 * Schedule: every 6 hours so stuck payments are caught within ~6 hours of
 * Paystack's 72-hour window closing.
 *
 * curl -X POST https://<domain>/api/public/payments/sweep-stuck \
 *      -H "apikey: <CRON_SECRET>"
 */
import { createFileRoute } from "@tanstack/react-router";
import { safeErrorMessage } from "@/lib/safe-error.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authorizeCronStrict } from "@/lib/cron-auth";
import {
  canRecoverStuckPayment,
  processPaymentSuccess,
} from "@/lib/paystack-webhook.server";

const STUCK_THRESHOLD_HOURS = 73;

export const Route = createFileRoute("/api/public/payments/sweep-stuck")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorizeCronStrict(request)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const cutoff = new Date(
          Date.now() - STUCK_THRESHOLD_HOURS * 60 * 60 * 1000,
        ).toISOString();

        const { data: stuck, error } = await supabaseAdmin
          .from("payments")
          .select("id, reference, user_id, created_at, amount_kobo, credits_granted")
          .eq("status", "pending")
          .lt("created_at", cutoff);

        if (error) {
          return new Response(JSON.stringify({ error: safeErrorMessage("payments-sweep", error.message) }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const rows = (stuck ?? []) as Array<{
          id: string;
          reference: string;
          user_id: string | null;
          created_at: string;
          amount_kobo: number;
          credits_granted: number | null;
        }>;

        let recovered_count = 0;
        let stuck_count = 0;

        for (const row of rows) {
          const canRecover = canRecoverStuckPayment(row);

          if (canRecover) {
            try {
              // Build a minimal synthetic event so processPaymentSuccess can
              // locate the existing payments row by reference. retryDelaysMs:[]
              // skips the backoff loop since the row is already present. The
              // function is fully idempotent: already-succeeded rows return
              // {status:"already_processed"} without re-granting credits.
              const syntheticEvent = {
                event: "charge.success",
                data: {
                  reference: row.reference,
                  status: "success",
                  amount: row.amount_kobo,
                  metadata: {
                    user_id: row.user_id!,
                    credits: row.credits_granted!,
                  },
                },
              };
              const result = await processPaymentSuccess(syntheticEvent, {
                retryDelaysMs: [],
              });
              recovered_count++;
              console.log(
                `[payments-sweep] AUTO_RECOVERED id=${row.id} ref=${row.reference} ` +
                  `user=${row.user_id} credits=${row.credits_granted} ` +
                  `result=${result.status}`,
              );
            } catch (err) {
              stuck_count++;
              const msg = err instanceof Error ? err.message : String(err);
              console.error(
                `[payments-sweep] STUCK_PAYMENT id=${row.id} ref=${row.reference} ` +
                  `user=${row.user_id} created=${row.created_at} ` +
                  `amount_kobo=${row.amount_kobo} — auto-recovery failed: ${msg}`,
              );
            }
          } else {
            // Missing user_id or credits_granted — cannot replay processPaymentSuccess
            // safely. Flag for manual intervention.
            stuck_count++;
            console.error(
              `[payments-sweep] STUCK_PAYMENT id=${row.id} ref=${row.reference} ` +
                `user=${row.user_id ?? "(none)"} created=${row.created_at} ` +
                `amount_kobo=${row.amount_kobo} — missing recovery data ` +
                `(user_id or credits_granted absent); check Paystack dashboard ` +
                `and credit manually if needed.`,
            );
          }
        }

        const summary = {
          swept_at: new Date().toISOString(),
          recovered_count,
          stuck_count,
        };

        if (recovered_count > 0) {
          console.warn(
            `[payments-sweep] ${recovered_count} payment(s) auto-recovered`,
          );
        }
        if (stuck_count > 0) {
          console.warn(
            `[payments-sweep] ${stuck_count} payment(s) unrecoverable — operator action required`,
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
