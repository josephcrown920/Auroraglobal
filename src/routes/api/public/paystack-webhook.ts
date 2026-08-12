import { createFileRoute } from "@tanstack/react-router";
import { createHmac, createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SUBSCRIPTION_TIERS } from "@/lib/billing.plans";
import { processPaymentSuccess } from "@/lib/paystack-webhook.server";

/**
 * Derive a stable, deterministic UUID from an arbitrary string input.
 * Used to make grant_monthly_aura idempotent: the same Paystack event always
 * produces the same ref_id, so webhook retries are no-ops.
 */
function deterministicUuid(input: string): string {
  const hash = createHash("md5").update(input).digest("hex");
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
}

/**
 * Month-keyed ref for Pro monthly Aura grants.
 * Using `subCode + YYYY-MM` as the key means both subscription.create AND
 * charge.success (which both fire for the initial subscription) produce the
 * SAME ref_id, so the credit_ledger unique constraint deduplicates them.
 * Renewal charges in future months produce a different YYYY-MM key → new grant.
 */
function proMonthlyAuraRef(subCode: string): string {
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  return deterministicUuid(`${subCode}:${month}`);
}

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.PAYSTACK_SECRET_KEY;
        if (!key) return new Response("Not configured", { status: 500 });
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const body = await request.text();
        const expected = createHmac("sha512", key).update(body).digest("hex");
        try {
          if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
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

        // ── Subscription: created (first payment + subscription activated) ────
        if (event.event === "subscription.create") {
          const d = event.data;
          const subCode = d.subscription_code ?? "";
          const customerEmail = d.customer?.email ?? "";
          const emailToken = d.email_token ?? "";
          const customerCode = d.customer?.customer_code ?? "";
          const planCode = d.plan?.plan_code ?? "";
          const nextPaymentDate = d.next_payment_date ?? null;

          // Look up user by email in profiles
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("user_id")
            .eq("email", customerEmail)
            .maybeSingle();
          const userId = profile?.user_id ?? null;

          if (userId && subCode) {
            const expiresAt = nextPaymentDate ? new Date(nextPaymentDate).toISOString() : new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString();

            // Activate Pro plan
            await supabaseAdmin.rpc("activate_pro_subscription", {
              _user: userId,
              _sub_code: subCode,
              _expires_at: expiresAt,
            });

            // Grant initial monthly Aura.  proMonthlyAuraRef uses subCode+YYYY-MM
            // so this ref matches the one charge.success will also produce — the
            // credit_ledger unique index deduplicates whichever fires second.
            await supabaseAdmin.rpc("grant_monthly_aura", {
              _user: userId,
              _amount: SUBSCRIPTION_TIERS.pro.monthly_aura,
              _ref: proMonthlyAuraRef(subCode),
            });

            // Upsert subscriptions row
            await supabaseAdmin.from("subscriptions").upsert({
              user_id: userId,
              paystack_subscription_code: subCode,
              paystack_customer_code: customerCode,
              paystack_email_token: emailToken,
              plan_code: planCode,
              status: "active",
              next_payment_date: nextPaymentDate,
              amount_minor: d.amount ?? SUBSCRIPTION_TIERS.pro.price_amount_minor,
              // Record the actual charge currency — the merchant account is
              // NGN, so hardcoding USD here would misreport every real charge.
              currency: d.currency ?? "NGN",
            }, { onConflict: "paystack_subscription_code" });
          }

          return new Response("ok", { status: 200 });
        }

        // ── Subscription: renewal charge succeeded ────────────────────────────
        if (event.event === "charge.success" && event.data.subscription_code) {
          const subCode = event.data.subscription_code;
          const metadata = event.data.metadata ?? {};

          // Find the subscription row
          const { data: sub } = await supabaseAdmin
            .from("subscriptions")
            .select("user_id, next_payment_date")
            .eq("paystack_subscription_code", subCode)
            .maybeSingle();

          const userId: string | null = sub?.user_id ?? metadata.user_id ?? null;

          if (userId) {
            // Compute new expiry (~1 month from now)
            const newExpiry = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString();

            // Keep Pro active + update expiry
            await supabaseAdmin.rpc("activate_pro_subscription", {
              _user: userId,
              _sub_code: subCode,
              _expires_at: newExpiry,
            });

            // Grant monthly Aura — proMonthlyAuraRef uses subCode+YYYY-MM so:
            //  • Initial subscription: same ref as subscription.create → DB unique
            //    constraint deduplicates whichever fires second (no double grant).
            //  • Monthly renewals: new YYYY-MM key each month → new grant.
            //  • Duplicate webhook delivery of the same event → same key → no-op.
            await supabaseAdmin.rpc("grant_monthly_aura", {
              _user: userId,
              _amount: SUBSCRIPTION_TIERS.pro.monthly_aura,
              _ref: proMonthlyAuraRef(subCode),
            });

            // Update subscriptions table
            await supabaseAdmin
              .from("subscriptions")
              .update({ status: "active", next_payment_date: newExpiry, updated_at: new Date().toISOString() })
              .eq("paystack_subscription_code", subCode);
          }

          return new Response("ok", { status: 200 });
        }

        // ── Subscription: disabled / cancelled ───────────────────────────────
        if (event.event === "subscription.disable") {
          const subCode = event.data.subscription_code ?? "";

          const { data: sub } = await supabaseAdmin
            .from("subscriptions")
            .select("user_id")
            .eq("paystack_subscription_code", subCode)
            .maybeSingle();

          const userId: string | null = sub?.user_id ?? null;

          if (userId) {
            // This is the ONLY place that downgrades plan to free.
            // cancelProSubscription only marks cancellation_pending and never
            // calls this RPC, preserving Pro access until the period ends.
            await supabaseAdmin.rpc("deactivate_pro_subscription", { _user: userId });
            await supabaseAdmin
              .from("subscriptions")
              .update({ status: "cancelled", updated_at: new Date().toISOString() })
              .eq("paystack_subscription_code", subCode);
          }

          return new Response("ok", { status: 200 });
        }

        // ── One-time credit pack charge ───────────────────────────────────────
        if (event.event === "charge.success" && event.data.status === "success" && !event.data.subscription_code) {
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
