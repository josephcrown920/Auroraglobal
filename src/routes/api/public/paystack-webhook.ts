import { createFileRoute } from "@tanstack/react-router";
import { createHmac, createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeProfitSplit } from "@/lib/profit-split";
import { SUBSCRIPTION_TIERS } from "@/lib/billing.plans";

/**
 * Derive a stable, deterministic UUID from an arbitrary string input.
 * Used to make grant_monthly_aura idempotent: the same Paystack event always
 * produces the same ref_id, so webhook retries are no-ops.
 */
function deterministicUuid(input: string): string {
  const hash = createHash("md5").update(input).digest("hex");
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
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
            await supabaseAdmin.rpc("activate_pro_subscription" as any, {
              _user: userId,
              _sub_code: subCode,
              _expires_at: expiresAt,
            } as any);

            // Grant initial monthly Aura — ref is deterministic so retries are no-ops.
            await supabaseAdmin.rpc("grant_monthly_aura" as any, {
              _user: userId,
              _amount: SUBSCRIPTION_TIERS.pro.monthly_aura,
              _ref: deterministicUuid(`${subCode}:initial`),
            } as any);

            // Upsert subscriptions row
            await (supabaseAdmin as any).from("subscriptions").upsert({
              user_id: userId,
              paystack_subscription_code: subCode,
              paystack_customer_code: customerCode,
              paystack_email_token: emailToken,
              plan_code: planCode,
              status: "active",
              next_payment_date: nextPaymentDate,
              amount_minor: d.amount ?? SUBSCRIPTION_TIERS.pro.price_amount_minor,
              currency: "USD",
            }, { onConflict: "paystack_subscription_code" });
          }

          return new Response("ok", { status: 200 });
        }

        // ── Subscription: renewal charge succeeded ────────────────────────────
        if (event.event === "charge.success" && event.data.subscription_code) {
          const subCode = event.data.subscription_code;
          const metadata = event.data.metadata ?? {};

          // Find the subscription row
          const { data: sub } = await (supabaseAdmin as any)
            .from("subscriptions")
            .select("user_id, next_payment_date")
            .eq("paystack_subscription_code", subCode)
            .maybeSingle();

          const userId: string | null = sub?.user_id ?? metadata.user_id ?? null;

          if (userId) {
            // Compute new expiry (~1 month from now)
            const newExpiry = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString();

            // Keep Pro active + update expiry
            await supabaseAdmin.rpc("activate_pro_subscription" as any, {
              _user: userId,
              _sub_code: subCode,
              _expires_at: newExpiry,
            } as any);

            // Grant monthly Aura on renewal — keyed on the Paystack payment reference,
            // so duplicate charge.success deliveries are safe no-ops.
            const renewalRef = event.data.reference
              ? deterministicUuid(`${event.data.reference}:renewal`)
              : deterministicUuid(`${subCode}:renewal:${Date.now()}`);
            await supabaseAdmin.rpc("grant_monthly_aura" as any, {
              _user: userId,
              _amount: SUBSCRIPTION_TIERS.pro.monthly_aura,
              _ref: renewalRef,
            } as any);

            // Update subscriptions table
            await (supabaseAdmin as any)
              .from("subscriptions")
              .update({ status: "active", next_payment_date: newExpiry, updated_at: new Date().toISOString() })
              .eq("paystack_subscription_code", subCode);
          }

          return new Response("ok", { status: 200 });
        }

        // ── Subscription: disabled / cancelled ───────────────────────────────
        if (event.event === "subscription.disable") {
          const subCode = event.data.subscription_code ?? "";

          const { data: sub } = await (supabaseAdmin as any)
            .from("subscriptions")
            .select("user_id")
            .eq("paystack_subscription_code", subCode)
            .maybeSingle();

          const userId: string | null = sub?.user_id ?? null;

          if (userId) {
            // This is the ONLY place that downgrades plan to free.
            // cancelProSubscription only marks cancellation_pending and never
            // calls this RPC, preserving Pro access until the period ends.
            await supabaseAdmin.rpc("deactivate_pro_subscription" as any, { _user: userId } as any);
            await (supabaseAdmin as any)
              .from("subscriptions")
              .update({ status: "cancelled", updated_at: new Date().toISOString() })
              .eq("paystack_subscription_code", subCode);
          }

          return new Response("ok", { status: 200 });
        }

        // ── One-time credit pack charge ───────────────────────────────────────
        if (event.event === "charge.success" && event.data.status === "success" && !event.data.subscription_code) {
          const reference = event.data.reference ?? "";
          const { data: payment } = await supabaseAdmin
            .from("payments")
            .select("id, user_id, credits_granted, status, currency, amount_kobo")
            .eq("reference", reference)
            .maybeSingle();
          if (!payment) return new Response("not found", { status: 200 });
          if (payment.status === "succeeded") return new Response("already processed", { status: 200 });

          await supabaseAdmin.rpc("grant_credits", {
            _user: payment.user_id,
            _amount: payment.credits_granted,
            _reason: "purchase",
            _ref: payment.id,
          });
          const split = computeProfitSplit(payment.amount_kobo);
          await supabaseAdmin.from("payments").update({
            status: "succeeded",
            raw: event,
            profit_amount_minor: split.profit_minor,
            credit_funding_amount_minor: split.credit_funding_minor,
            split_profit_pct: split.profit_pct,
          }).eq("id", payment.id);

          // Affiliate conversion
          try {
            const raw = (payment as { raw?: { ref?: string } }).raw;
            let refCode = raw?.ref ?? event.data.metadata?.ref;
            if (!refCode) {
              const { data: prof } = await supabaseAdmin
                .from("profiles")
                .select("referred_by_code")
                .eq("user_id", payment.user_id)
                .maybeSingle();
              refCode = prof?.referred_by_code ?? undefined;
            }
            if (refCode) {
              const { data: aff } = await supabaseAdmin
                .from("affiliates")
                .select("code, commission_pct, total_earned_usd")
                .eq("code", String(refCode).toLowerCase())
                .maybeSingle();
              if (aff) {
                const minor = Number((event.data as { amount?: number }).amount ?? 0);
                const usdValue = minor / 100;
                const amountUsd = usdValue * (aff.commission_pct / 100);
                await supabaseAdmin.from("affiliate_events").insert({
                  code: aff.code,
                  kind: "conversion",
                  amount_usd: amountUsd,
                  user_id: payment.user_id,
                  ref_id: payment.id,
                });
                await supabaseAdmin.from("affiliates")
                  .update({ total_earned_usd: Number(aff.total_earned_usd ?? 0) + amountUsd })
                  .eq("code", aff.code);
              }
            }
          } catch {
            // never let affiliate accounting break a successful payment
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
