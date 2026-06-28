// Gift card issue / redeem server functions
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function genCode(): string {
  // Human-friendly 12-char code grouped 4-4-4 (e.g. AURA-X42K-9PQM)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) s += "-";
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return "AURA-" + s.slice(0, 14);
}

type AdminClient = typeof supabaseAdmin;

// Deps-injected cores so the gift money-paths are unit-testable without a live
// Supabase / Start request context (mirrors the reserveOrchestrateRecord pattern
// in generate-core.server). The createServerFn handlers below just supply the
// real admin client + authenticated userId and delegate here.
export async function issueGiftCardCore(
  deps: { admin: AdminClient },
  userId: string,
  input: {
    credits: number;
    amountUsd: number;
    design: "aurora" | "midnight" | "neon" | "rose";
    note?: string | null;
  },
) {
  const { data: role } = await deps.admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("Admins only");

  const code = genCode();
  const { data: row, error } = await deps.admin
    .from("gift_cards")
    .insert({
      code,
      credits: input.credits,
      amount_usd: input.amountUsd,
      design: input.design,
      note: input.note ?? null,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return row;
}

export async function redeemGiftCardCore(
  deps: { admin: AdminClient },
  userId: string,
  rawCode: string,
) {
  const code = rawCode.trim().toUpperCase();
  const { data: card, error } = await deps.admin
    .from("gift_cards")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!card) throw new Error("Invalid gift card code");
  if (card.redeemed_by) throw new Error("This card has already been redeemed");

  // Atomic-ish redemption: only update if still un-redeemed
  const { data: updated, error: updErr } = await deps.admin
    .from("gift_cards")
    .update({ redeemed_by: userId, redeemed_at: new Date().toISOString() })
    .eq("id", card.id)
    .is("redeemed_by", null)
    .select()
    .single();
  if (updErr || !updated) throw new Error("Card was just redeemed by someone else");

  // Grant credits
  const { error: grantErr } = await deps.admin.rpc("grant_credits", {
    _user: userId,
    _amount: card.credits,
    _reason: "gift_card_redeem",
    _ref: card.id,
  });
  if (grantErr) throw new Error(grantErr.message);

  return { credits: card.credits, design: card.design };
}

export const issueGiftCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        credits: z.number().int().min(10).max(10_000),
        amountUsd: z.number().min(0).max(1000).default(0),
        design: z.enum(["aurora", "midnight", "neon", "rose"]).default("aurora"),
        note: z.string().max(200).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    issueGiftCardCore({ admin: supabaseAdmin }, context.userId, {
      credits: data.credits,
      amountUsd: data.amountUsd,
      design: data.design,
      note: data.note,
    }),
  );

export const listGiftCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) return { items: [] };
    const { data } = await supabaseAdmin
      .from("gift_cards")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return { items: data ?? [] };
  });

export const redeemGiftCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(6).max(40) }).parse(input))
  .handler(async ({ data, context }) =>
    redeemGiftCardCore({ admin: supabaseAdmin }, context.userId, data.code),
  );
