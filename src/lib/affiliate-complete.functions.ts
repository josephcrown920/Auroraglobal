// ─── Affiliate / Partners — complete server function set ─────────────────────
// Extends affiliate.functions.ts with:
//   • Commission recording on confirmed purchases
//   • Payout request flow (affiliate requests withdrawal → owner approves/pays)
//   • Admin: list all affiliates + manage
//
// The base read/attach/track functions live in affiliate.functions.ts — this
// file adds the heavier admin/payment-hook layer that doesn't belong there.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { PARTNER_COMMISSION_PCT } from "./partners";

// ─── Commission recording ─────────────────────────────────────────────────────

/** Called from the Paystack webhook after a confirmed purchase.
 *  Looks up the buyer's `referred_by_code`, finds the affiliate, and inserts
 *  a `conversion` event with the commission amount.  Idempotent via the
 *  ref_id unique check on affiliate_events. */
export async function recordAffiliateCommission(opts: {
  buyerUserId: string;
  amountUsd: number;
  /** Unique purchase reference (e.g. Paystack reference). Used as ref_id. */
  reference: string;
}) {
  const { buyerUserId, amountUsd, reference } = opts;
  if (!amountUsd || amountUsd <= 0) return { ok: false as const, reason: "zero_amount" };

  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("referred_by_code")
    .eq("user_id", buyerUserId)
    .maybeSingle();

  const code = prof?.referred_by_code;
  if (!code) return { ok: false as const, reason: "no_referrer" };

  const commission = parseFloat(((amountUsd * PARTNER_COMMISSION_PCT) / 100).toFixed(4));

  const { error } = await supabaseAdmin.from("affiliate_events").insert({
    code,
    kind: "conversion",
    user_id: buyerUserId,
    amount_usd: commission,
    ref_id: reference,
  });

  if (error) {
    if (error.code === "23505") return { ok: false as const, reason: "duplicate" };
    console.error("[affiliate] commission insert error:", error.message);
    return { ok: false as const, reason: "db_error" };
  }

  // Update the affiliate's total_earned_usd in-place (best-effort; webhook
  // retries are idempotent at the event level so a missed increment here just
  // means total_earned_usd is slightly stale until a recalc runs).
  try {
    await supabaseAdmin.rpc("increment_affiliate_earned" as any, {
      _code: code,
      _amount: commission,
    });
  } catch {
    // RPC may not exist yet — event row is the authoritative record.
  }

  return { ok: true as const, code, commission };
}

// ─── Payout requests ─────────────────────────────────────────────────────────

/** The affiliate requests a payout of their pending balance.
 *  Computes pending = total_earned_usd minus sum of already-approved payouts,
 *  then records a payout request note in affiliate_events for the owner to act on. */
export const requestAffiliatePayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ payout_email: z.string().email().max(320) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: aff } = await supabaseAdmin
      .from("affiliates")
      .select("id, code, total_earned_usd")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!aff) return { ok: false as const, reason: "not_an_affiliate" };

    // Sum previously paid out (conversion events with kind "payout_sent")
    const { data: payouts } = await supabaseAdmin
      .from("affiliate_events")
      .select("amount_usd")
      .eq("code", aff.code)
      .eq("kind", "payout_sent");

    const paidOut = (payouts ?? []).reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
    const pending = Number(aff.total_earned_usd ?? 0) - paidOut;

    const MIN_PAYOUT_USD = 10;
    if (pending < MIN_PAYOUT_USD) {
      return { ok: false as const, reason: "below_minimum", pending };
    }

    // Record the payout request as an event (owner processes these manually)
    const { error } = await supabaseAdmin.from("affiliate_events").insert({
      code: aff.code,
      kind: "payout_requested",
      user_id: context.userId,
      amount_usd: pending,
      ref_id: `payout_req:${context.userId}:${Date.now()}`,
    });

    if (error) {
      if (error.code === "23505")
        return { ok: false as const, reason: "payout_already_pending" };
      console.error("[affiliate] payout request error:", error.message);
      return { ok: false as const, reason: "db_error" };
    }

    // Update payout email in case it changed
    await supabaseAdmin
      .from("affiliates")
      .update({ payout_email: data.payout_email })
      .eq("user_id", context.userId);

    return { ok: true as const, amount_usd: pending };
  });

// ─── Admin: list affiliates ───────────────────────────────────────────────────

/** Admin-only: list all affiliates with click/conversion/earned totals. */
export const adminListAffiliates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("admin_only");

    const { data: affiliates, error } = await supabaseAdmin
      .from("affiliates")
      .select("id, user_id, code, payout_email, total_earned_usd, commission_pct, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);
    return { affiliates: affiliates ?? [] };
  });

/** Admin-only: override commission percentage for one affiliate. */
export const adminSetAffiliateCommission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ affiliateId: z.string().uuid(), commissionPct: z.number().min(0).max(100) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("admin_only");

    await supabaseAdmin
      .from("affiliates")
      .update({ commission_pct: data.commissionPct })
      .eq("id", data.affiliateId);

    return { ok: true };
  });
