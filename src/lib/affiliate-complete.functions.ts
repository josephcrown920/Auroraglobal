import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Affiliate program: track referrals, conversions, and payouts.
 */

export const getMyAffiliate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    let { data } = await supabaseAdmin
      .from("affiliates")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!data) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("email,display_name")
        .eq("user_id", context.userId)
        .maybeSingle();

      const code = makeCode(prof?.display_name || prof?.email || "aurora");
      const { data: ins } = await supabaseAdmin
        .from("affiliates")
        .insert({
          user_id: context.userId,
          code,
          commission_pct: 20,
        })
        .select()
        .single();

      data = ins;
    }

    if (!data) throw new Error("Failed to load affiliate record");

    // Fetch stats
    const { data: events } = await supabaseAdmin
      .from("affiliate_events")
      .select("*")
      .eq("code", data.code);

    const clicks = events?.filter((e) => e.kind === "click").length || 0;
    const conversions = events?.filter((e) => e.kind === "conversion") || [];
    const conversionsCount = conversions.length;
    const totalEarned = conversions.reduce((sum, c) => sum + (c.amount_usd || 0), 0);

    return {
      affiliate: data,
      clicks,
      conversionsCount,
      totalEarned,
    };
  });

export const updateAffiliate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { payout_email: string }) => d)
  .handler(async ({ data, context }) => {
    const { payout_email } = data;

    const { error } = await supabaseAdmin
      .from("affiliates")
      .update({ payout_email })
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return { success: true };
  });


function makeCode(seed: string) {
  return (
    seed
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, 6) + Math.random().toString(36).slice(2, 6)
  ).toLowerCase();
}
