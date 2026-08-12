import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import {
  processPaymentSuccess,
  processSubscriptionCreate,
  processSubscriptionDisable,
  processSubscriptionRenewal,
} from "@/lib/paystack-webhook.server";

/**
 * Payment webhook route — transport dispatcher only.
 *
 * Business logic for every payment event lives in paystack-webhook.server.ts.
 * Keep nothing here except:
 *   1. Signature verification (transport-layer security)
 *   2. JSON parsing and event-type dispatch
 *   3. HTTP response shaping
 *
 * This ensures the same code path is exercised in unit tests and in production,
 * and prevents a second copy of credit-grant / subscription logic from silently
 * diverging from the tested implementation.
 */
export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.PAYSTACK_SECRET_KEY;
        if (!key) return new Response("Not configured", { status: 500 });

        const signature = request.headers.get("x-paystack-signature") ?? "";
        const body = await request.text();

        // Verify the HMAC-SHA512 signature before touching any payload data.
        const expected = createHmac("sha512", key).update(body).digest("hex");
        try {
          if (
            signature.length !== expected.length ||
            !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
          ) {
            return new Response("Invalid signature", { status: 401 });
          }
        } catch {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(body) as {
          event: string;
          data: {
            reference?: string;
            status?: string;
            amount?: number;
            currency?: string;
            subscription_code?: string;
            customer?: { customer_code?: string; email?: string };
            plan?: { plan_code?: string };
            next_payment_date?: string;
            email_token?: string;
            metadata?: { user_id?: string; credits?: number; ref?: string; type?: string };
          };
        };

        // ── Subscription: created (first payment + subscription activated) ─────
        if (event.event === "subscription.create") {
          await processSubscriptionCreate(event.data);
          return new Response("ok", { status: 200 });
        }

        // ── Subscription: renewal charge succeeded ────────────────────────────
        // charge.success with a subscription_code is a recurring billing charge,
        // not a one-time purchase. Route it to the subscription renewal handler.
        if (event.event === "charge.success" && event.data.subscription_code) {
          await processSubscriptionRenewal(event.data);
          return new Response("ok", { status: 200 });
        }

        // ── Subscription: disabled / cancelled ───────────────────────────────
        if (event.event === "subscription.disable") {
          await processSubscriptionDisable(event.data);
          return new Response("ok", { status: 200 });
        }

        // ── One-time credit pack charge ───────────────────────────────────────
        if (
          event.event === "charge.success" &&
          event.data.status === "success" &&
          !event.data.subscription_code
        ) {
          // Delegate to the shared processor, which tolerates the race where
          // this webhook arrives before the checkout redirect has finished
          // inserting the `payments` row (retries with backoff, then recovers
          // the row from the webhook's own metadata) so a paid customer never
          // loses their credits. See paystack-webhook.server.ts.
          // Paystack retry schedule (confirmed against official docs, 2026-07):
          //   Live mode — every 3 min for the first 4 attempts, then hourly
          //               for up to 72 hours total (~67 hourly retries).
          //   Test mode — hourly for 10 hours.
          //   Timeout   — 30 seconds per attempt.
          // Any non-2xx response (including 409) counts as a failed delivery
          // and triggers the next retry.  After 72 h the event is permanently
          // abandoned by Paystack.  The /api/public/payments/sweep-stuck cron
          // endpoint (runs every 6 h) detects payments still stuck in "pending"
          // beyond the 72-hour window and logs a STUCK_PAYMENT alert so an
          // operator can intervene manually.
          const ref = event.data.reference ?? "(unknown)";
          try {
            await processPaymentSuccess({
              event: event.event,
              data: {
                reference: ref,
                status: event.data.status ?? "",
                amount: event.data.amount,
                metadata: event.data.metadata,
              },
            });
          } catch (err) {
            // Payment row still hasn't appeared after retries and the webhook
            // carried no recovery metadata — return a retriable (non-2xx)
            // response so Paystack redelivers instead of us silently dropping
            // the charge.  Include the reference so operators can correlate
            // repeated failures for the same charge across log lines.
            console.error(`[paystack-webhook] RETRY_NEEDED ref=${ref}`, err);
            return new Response("retry", { status: 409 });
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
