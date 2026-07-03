import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Gift card operations: issue, list, redeem.
 */

export const issueGiftCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { credits: number; note?: string; design: string }) => d)
  .handler(async ({ data, context }) => {
    const { credits, note, design } = data;
    const { userId } = context;

    const code = `GIFT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      .toUpperCase();

    const { data: card, error } = await supabaseAdmin
      .from("gift_cards")
      .insert({
        code,
        created_by: userId,
        credits,
        design,
        note,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return card;
  });

export const listGiftCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;

    const { data, error } = await supabaseAdmin
      .from("gift_cards")
      .select("*")
      .eq("created_by", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  });

export const redeemGiftCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data, context }) => {
    const { code } = data;
    const { userId } = context;

    const { data: card, error: findErr } = await supabaseAdmin
      .from("gift_cards")
      .select("*")
      .eq("code", code.toUpperCase())
      .maybeSingle();

    if (findErr || !card) throw new Error("Gift card not found");
    if (card.redeemed_at) throw new Error("Gift card already redeemed");

    await supabaseAdmin.rpc("grant_credits", {
      _user: userId,
      _amount: card.credits,
      _reason: "gift_card",
      _ref: card.id,
    });

    await supabaseAdmin
      .from("gift_cards")
      .update({ redeemed_at: new Date().toISOString(), redeemed_by: userId })
      .eq("id", card.id);

    return { credits: card.credits, success: true };
  });

