import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { deterministicUuid } from "./billing.functions";
import { REFERRAL_AURA_EACH, REFERRAL_REWARD_DAILY_CAP } from "./partners";

function makeCode(seed: string) {
  return (seed.replace(/[^a-z0-9]/gi, "").slice(0, 6) + Math.random().toString(36).slice(2, 6)).toLowerCase();
}

export const getMyAffiliate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    let { data } = await supabaseAdmin.from("affiliates").select("*").eq("user_id", context.userId).maybeSingle();
    if (!data) {
      const { data: prof } = await supabaseAdmin.from("profiles").select("email,display_name").eq("user_id", context.userId).maybeSingle();
      const code = makeCode(prof?.display_name || prof?.email || "aurora");
      const ins = await supabaseAdmin.from("affiliates").insert({
        user_id: context.userId, code, payout_email: prof?.email ?? null,
      }).select("*").single();
      data = ins.data;
    }
    const { data: events } = await supabaseAdmin
      .from("affiliate_events").select("*").eq("code", data!.code)
      .order("created_at", { ascending: false }).limit(50);
    const clicks = events?.filter(e => e.kind === "click").length ?? 0;
    const conversions = events?.filter(e => e.kind === "conversion") ?? [];
    const earned = conversions.reduce((s, e) => s + Number(e.amount_usd ?? 0), 0);
    return { affiliate: data, clicks, conversionsCount: conversions.length, earned, events: events ?? [] };
  });

export const updateAffiliate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ payout_email: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    await supabaseAdmin.from("affiliates").update({ payout_email: data.payout_email }).eq("user_id", context.userId);
    return { ok: true };
  });

export const trackAffiliateClick = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ code: z.string().min(2).max(40) }).parse(d))
  .handler(async ({ data }) => {
    await supabaseAdmin.from("affiliate_events").insert({ code: data.code.toLowerCase(), kind: "click" });
    return { ok: true };
  });

/** Grant Aura via the service-role RPC; a 23505 on the referral dedup index
 *  (credit_ledger_referral_ref_uniq) means "already granted" and rolls back
 *  the wallet increment inside the RPC's own transaction — a true no-op. */
async function grantReferralAura(userId: string, reason: "referral_signup" | "referral_reward", refereeId: string) {
  const { error } = await (supabaseAdmin.rpc as any)("grant_credits", {
    _user: userId,
    _amount: REFERRAL_AURA_EACH,
    _reason: reason,
    _ref: deterministicUuid(`${reason}:${refereeId}`),
  });
  if (!error) return "granted" as const;
  if (error.code === "23505" || /duplicate key/i.test(error.message ?? "")) return "already" as const;
  console.error(`[partners] ${reason} grant failed for ${userId}:`, error.message);
  return "failed" as const;
}

// Attach a referral code to the signed-in user's profile (only once, only if
// the code maps to a real affiliate and the user isn't themselves the
// affiliate). Once set, every future purchase by this user credits the
// referrer for life. Both sides receive REFERRAL_AURA_EACH Aura — grants are
// attempted on every call and deduped by a partial unique ledger index, so a
// crash between the attach and the grants is retried on the next visit.
export const attachReferralToProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.string().min(2).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const code = data.code.toLowerCase().trim();

    // Validate BEFORE writing: never persist a code that maps to no affiliate
    // or to the caller themselves (a bad write racing a good one could
    // otherwise permanently eat the good referral).
    const { data: passedAff } = await supabaseAdmin
      .from("affiliates")
      .select("user_id, code")
      .eq("code", code)
      .maybeSingle();
    const passedCodeValid = Boolean(passedAff) && passedAff!.user_id !== context.userId;

    // Compare-and-set: only writes if no referrer is attached yet. Exactly one
    // concurrent caller can win; losers see their row come back empty.
    let isWinner = false;
    if (passedCodeValid) {
      const { data: won } = await supabaseAdmin
        .from("profiles")
        .update({ referred_by_code: code })
        .eq("user_id", context.userId)
        .is("referred_by_code", null)
        .select("user_id");
      isWinner = (won?.length ?? 0) > 0;
    }

    // The authoritative code is whatever is on the profile now (may differ
    // from the passed code if the user was referred earlier).
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("referred_by_code")
      .eq("user_id", context.userId)
      .maybeSingle();
    const attachedCode = prof?.referred_by_code;
    if (!attachedCode) {
      return { ok: false as const, reason: passedAff ? ("self_referral" as const) : ("unknown_code" as const) };
    }

    const aff = attachedCode === passedAff?.code
      ? passedAff
      : (await supabaseAdmin
          .from("affiliates")
          .select("user_id, code")
          .eq("code", attachedCode)
          .maybeSingle()).data;
    if (!aff) return { ok: false as const, reason: "unknown_code" as const };
    if (aff.user_id === context.userId) return { ok: false as const, reason: "self_referral" as const };

    if (isWinner) {
      await supabaseAdmin.from("affiliate_events").insert({
        code: aff.code, kind: "signup", user_id: context.userId,
      });
    }

    // Referee side: +REFERRAL_AURA_EACH, once ever (deduped by ledger index).
    const refereeGrant = await grantReferralAura(context.userId, "referral_signup", context.userId);

    // Referrer side: same amount, capped per trailing 24h to blunt farming.
    let referrerGrant: "granted" | "already" | "failed" | "capped" = "capped";
    const { count } = await supabaseAdmin
      .from("credit_ledger")
      .select("id", { count: "exact", head: true })
      .eq("user_id", aff.user_id)
      .eq("reason", "referral_reward")
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if ((count ?? 0) < REFERRAL_REWARD_DAILY_CAP) {
      referrerGrant = await grantReferralAura(aff.user_id, "referral_reward", context.userId);
    }

    return {
      ok: true as const,
      alreadySet: !isWinner,
      refereeAura: refereeGrant === "granted" ? REFERRAL_AURA_EACH : 0,
      refereeGrant,
      referrerGrant,
    };
  });
