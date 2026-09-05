import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

/**
 * Promo codes: admin-issued growth codes, distinct from user-to-user gift
 * cards (gifts.functions.ts). Two kinds:
 *   - "bonus": flat Aura credited instantly on redeem (no purchase needed —
 *     e.g. a signup incentive shared in a marketing campaign).
 *   - "discount": percent off applied to a Paystack checkout's price before
 *     `payments` insert + Paystack `initialize` (billing.functions.ts).
 * Both kinds are single-use per user (promo_code_redemptions unique
 * constraint), optionally capped by max_redemptions and/or expires_at.
 */

function genPromoCode(): string {
  return `PROMO-${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden — admin only");
}

export interface PromoCodeRow {
  id: string;
  code: string;
  kind: "discount" | "bonus";
  percent_off: number | null;
  bonus_credits: number | null;
  max_redemptions: number | null;
  redemption_count: number;
  expires_at: string | null;
  active: boolean;
  note: string | null;
  created_at: string;
}

/**
 * Pure validation core — checks a promo row against redemption limits
 * without touching the network, so callers (redeem + checkout-apply) share
 * one source of truth and it's unit-testable.
 */
export function checkPromoRedeemable(row: PromoCodeRow, now: Date = new Date()): { ok: true } | { ok: false; reason: string } {
  if (!row.active) return { ok: false, reason: "This code is no longer active." };
  if (row.expires_at && new Date(row.expires_at).getTime() < now.getTime()) {
    return { ok: false, reason: "This code has expired." };
  }
  if (row.max_redemptions != null && row.redemption_count >= row.max_redemptions) {
    return { ok: false, reason: "This code has reached its redemption limit." };
  }
  return { ok: true };
}

/** Compute a discounted amount_minor for a "discount" kind promo code. */
export function applyPercentDiscount(amountMinor: number, percentOff: number): number {
  const discounted = Math.round(amountMinor * (100 - percentOff) / 100);
  return Math.max(discounted, 0);
}

export const issuePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        kind: z.enum(["discount", "bonus"]),
        percentOff: z.number().int().min(1).max(100).optional(),
        bonusCredits: z.number().int().min(1).optional(),
        maxRedemptions: z.number().int().min(1).optional(),
        expiresAt: z.string().datetime().optional(),
        note: z.string().max(200).optional(),
        code: z.string().min(3).max(40).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.kind === "discount" && !data.percentOff) throw new Error("percentOff required for discount codes");
    if (data.kind === "bonus" && !data.bonusCredits) throw new Error("bonusCredits required for bonus codes");

    const code = (data.code || genPromoCode()).toUpperCase();
    const { data: row, error } = await supabaseAdmin
      .from("promo_codes")
      .insert({
        code,
        kind: data.kind,
        percent_off: data.kind === "discount" ? data.percentOff : null,
        bonus_credits: data.kind === "bonus" ? data.bonusCredits : null,
        max_redemptions: data.maxRedemptions ?? null,
        expires_at: data.expiresAt ?? null,
        note: data.note ?? null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row as PromoCodeRow;
  });

export const listPromoCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as PromoCodeRow[];
  });

export const setPromoCodeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("promo_codes").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Redeem a "bonus" code — grants Aura directly. "discount" codes don't go
 * through here; they're applied at checkout time (see applyPromoAtCheckout,
 * called from billing.functions.ts::createPaystackCheckout).
 */
export const redeemPromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const code = data.code.trim().toUpperCase();

    const { data: row, error: findErr } = await supabaseAdmin
      .from("promo_codes")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!row) throw new Error("Promo code not found");
    if (row.kind !== "bonus") {
      throw new Error("This code applies as a checkout discount — enter it on the Billing page instead.");
    }

    const check = checkPromoRedeemable(row as PromoCodeRow);
    if (!check.ok) throw new Error(check.reason);

    const { data: existing } = await supabaseAdmin
      .from("promo_code_redemptions")
      .select("id")
      .eq("promo_code_id", row.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) throw new Error("You've already redeemed this code");

    const { error: redeemErr } = await supabaseAdmin
      .from("promo_code_redemptions")
      .insert({ promo_code_id: row.id, user_id: userId });
    if (redeemErr) throw new Error(redeemErr.message);

    await supabaseAdmin
      .from("promo_codes")
      .update({ redemption_count: row.redemption_count + 1 } as never)
      .eq("id", row.id);

    await supabaseAdmin.rpc("grant_credits", {
      _user: userId,
      _amount: row.bonus_credits!,
      _reason: "promo_code",
      _ref: row.id,
      _actor: null,
    });

    return { credits: row.bonus_credits, success: true };
  });

/**
 * Called from createPaystackCheckout (server-only, no auth middleware here —
 * the caller already ran requireSupabaseAuth). Validates a "discount" code
 * and returns the discounted amount, recording the redemption immediately so
 * a code can't be reused across concurrent checkouts. Discount codes are
 * consumed at checkout-initiation time (not on payment success) — matches
 * the same optimistic-redemption tradeoff as gift cards; a small number of
 * abandoned checkouts may consume a redemption slot, which is acceptable at
 * this scale and avoids adding promo-code state to the webhook path.
 */
export async function applyPromoAtCheckout(
  userId: string,
  code: string,
  amountMinor: number,
): Promise<{ amountMinor: number; promoCodeId: string; percentOff: number }> {
  const normalized = code.trim().toUpperCase();
  const { data: row, error: findErr } = await supabaseAdmin
    .from("promo_codes")
    .select("*")
    .eq("code", normalized)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!row) throw new Error("Promo code not found");
  if (row.kind !== "discount") {
    throw new Error("This code is a bonus code — redeem it from the Gifts page instead.");
  }

  const check = checkPromoRedeemable(row as PromoCodeRow);
  if (!check.ok) throw new Error(check.reason);

  const { data: existing } = await supabaseAdmin
    .from("promo_code_redemptions")
    .select("id")
    .eq("promo_code_id", row.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) throw new Error("You've already used this code");

  const { error: redeemErr } = await supabaseAdmin
    .from("promo_code_redemptions")
    .insert({ promo_code_id: row.id, user_id: userId });
  if (redeemErr) throw new Error(redeemErr.message);

  await supabaseAdmin
    .from("promo_codes")
    .update({ redemption_count: row.redemption_count + 1 } as never)
    .eq("id", row.id);

  return {
    amountMinor: applyPercentDiscount(amountMinor, row.percent_off!),
    promoCodeId: row.id,
    percentOff: row.percent_off!,
  };
}
