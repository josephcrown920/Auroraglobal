/**
 * /api/public/check-api-balances
 *
 * Cron-called endpoint (anon-key auth, same as other public cron routes).
 * Checks remaining credits at each AI provider and the accumulated API-budget
 * pool from Paystack payments, then logs warnings when any are running low.
 *
 * Provider auto-recharge setup (one-time, no code needed):
 *  • Replicate  — replicate.com/account/billing  → Auto Refill
 *  • fal.ai     — fal.ai/dashboard/billing       → Auto-refill
 *  • OpenRouter — openrouter.ai/settings/credits → Auto top-up
 *  • Anthropic  — console.anthropic.com/billing  → Auto top-up
 *
 * This endpoint acts as a secondary safety net — it logs warnings and
 * writes an alert row to `api_balance_alerts` so admins can see the status
 * in the Aurora admin panel.
 */

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";

/** Minimum balance thresholds that trigger a warning */
const THRESHOLDS = {
  openrouter_usd:      5,    // warn if < $5 remaining
  api_budget_pool_usd: 20,   // warn if accumulated API budget pool < $20
};

async function checkOpenRouterBalance(): Promise<{ credits_usd: number | null; ok: boolean; error?: string }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { credits_usd: null, ok: true }; // not configured — skip silently

  try {
    const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return { credits_usd: null, ok: false, error: `HTTP ${res.status}` };
    const json = await res.json() as { data?: { limit?: number; usage?: number; is_free_tier?: boolean } };
    const d = json.data;
    if (!d) return { credits_usd: null, ok: false, error: "No data in response" };
    // limit null = unlimited (free tier or enterprise)
    if (d.limit == null) return { credits_usd: null, ok: true };
    const remaining = d.limit - (d.usage ?? 0);
    return { credits_usd: remaining, ok: true };
  } catch (err) {
    return { credits_usd: null, ok: false, error: String(err) };
  }
}

/** Sum of credit_funding_amount_minor across all succeeded payments (in USD cents). */
async function getApibudgetPoolUsd(): Promise<number | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("credit_funding_amount_minor, currency")
      .eq("status", "succeeded");

    if (error || !data) return null;

    // Sum all credit_funding, normalizing to USD cents.
    // Non-USD currencies are stored in their minor unit — for budget purposes,
    // approximate NGN/GHS/KES/ZAR/EGP rows using representative exchange rates.
    const FX: Record<string, number> = { USD: 1, NGN: 1550, GHS: 15.5, KES: 130, ZAR: 18.5, EGP: 49 };
    let totalCents = 0;
    for (const row of data) {
      const rate = FX[(row as { currency: string; credit_funding_amount_minor: number }).currency] ?? 1;
      const minor = (row as { credit_funding_amount_minor: number }).credit_funding_amount_minor ?? 0;
      // Convert minor units to USD cents
      totalCents += minor / rate;
    }
    return totalCents / 100; // return as USD dollars
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/check-api-balances")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Auth: anon key header (same pattern as other public cron endpoints)
        const apiKey = request.headers.get("apikey") ?? request.headers.get("x-api-key") ?? "";
        if (!ANON_KEY || apiKey !== ANON_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const [openrouter, poolUsd] = await Promise.all([
          checkOpenRouterBalance(),
          getApibudgetPoolUsd(),
        ]);

        const alerts: string[] = [];

        if (openrouter.credits_usd !== null && openrouter.credits_usd < THRESHOLDS.openrouter_usd) {
          alerts.push(`OpenRouter LOW: $${openrouter.credits_usd.toFixed(2)} remaining (threshold $${THRESHOLDS.openrouter_usd})`);
        }
        if (poolUsd !== null && poolUsd < THRESHOLDS.api_budget_pool_usd) {
          alerts.push(`API budget pool LOW: $${poolUsd.toFixed(2)} accumulated (threshold $${THRESHOLDS.api_budget_pool_usd})`);
        }

        if (alerts.length > 0) {
          console.warn("[api-balance-check] LOW BALANCE ALERTS:", alerts.join(" | "));
          // Write alert to DB for admin panel visibility
          await supabaseAdmin.from("api_balance_alerts" as any).insert({
            alerts,
            openrouter_usd: openrouter.credits_usd,
            api_budget_pool_usd: poolUsd,
            created_at: new Date().toISOString(),
          }).then(() => {});
        }

        const result = {
          ok: true,
          checked_at: new Date().toISOString(),
          openrouter: { credits_usd: openrouter.credits_usd, ok: openrouter.ok, error: openrouter.error },
          api_budget_pool_usd: poolUsd,
          alerts,
          low_balance: alerts.length > 0,
        };

        console.log("[api-balance-check]", JSON.stringify(result));
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
