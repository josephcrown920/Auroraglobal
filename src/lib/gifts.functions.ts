/* eslint-disable @typescript-eslint/no-explicit-any -- migration-only fields/RPCs are intentionally untyped until the checked-in Supabase types are regenerated after schema apply. */
// Gift card issue / redeem server functions
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  GIFT_CARD_PRODUCT_IDS,
  getGiftCardProduct,
  type GiftCardKind,
  type GiftCardProductId,
} from "./gift-card-catalog";

function genCode(): string {
  // UUID entropy, rendered as an easy-to-share 4-4-4 card code.
  const uuid = globalThis.crypto?.randomUUID?.();
  if (!uuid) throw new Error("Secure random card-code generation is unavailable");
  const value = uuid.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 12);
  return `AURA-${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}`;
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
    kind?: GiftCardKind;
    proDays?: number;
    design: "aurora" | "midnight" | "neon" | "rose";
    note?: string | null;
  },
) {
  const admin = deps.admin as any;
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("Admins only");

  const code = genCode();
  const { data: row, error } = await admin
    .from("gift_cards")
    .insert({
      code,
      credits: input.credits,
      amount_usd: input.amountUsd,
      kind: input.kind ?? "aura",
      pro_days: input.proDays ?? 0,
      design: input.design,
      note: input.note ?? null,
      created_by: userId,
      payment_status: "succeeded",
      status: "active",
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return row;
}

export async function issueGiftCardBatchCore(
  deps: { admin: AdminClient },
  userId: string,
  input: {
    count: number;
    credits: number;
    amountUsd: number;
    kind: GiftCardKind;
    proDays: number;
    design: "aurora" | "midnight" | "neon" | "rose";
    note?: string | null;
  },
) {
  const admin = deps.admin as any;
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("Admins only");

  const rows = Array.from({ length: input.count }, () => ({
    code: genCode(),
    credits: input.credits,
    amount_usd: input.amountUsd,
    kind: input.kind,
    pro_days: input.proDays,
    design: input.design,
    note: input.note ?? null,
    created_by: userId,
    payment_status: "succeeded",
    status: "active",
  }));
  const { data, error } = await admin.from("gift_cards").insert(rows).select();
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createPendingPurchasedGiftCard(
  deps: { admin: AdminClient },
  userId: string,
  input: {
    productId: GiftCardProductId;
    design: "aurora" | "midnight" | "neon" | "rose";
    note?: string | null;
    recipientEmail: string;
  },
) {
  const admin = deps.admin as any;
  const product = getGiftCardProduct(input.productId);
  const { data: row, error } = await admin
    .from("gift_cards")
    .insert({
      code: genCode(),
      credits: product.credits,
      amount_usd: product.usdMinor / 100,
      kind: product.kind,
      pro_days: product.proDays,
      design: input.design,
      note: input.note ?? null,
      created_by: userId,
      purchaser_id: userId,
      recipient_email: input.recipientEmail,
      payment_status: "pending",
      status: "pending",
    } as never)
    .select()
    .single();
  if (error || !row) throw new Error(error?.message ?? "Could not create gift card order");
  return { card: row, product };
}

export async function linkPurchasedGiftCardPayment(
  deps: { admin: AdminClient },
  cardId: string,
  reference: string,
  provider: "paystack" | "nowpayments",
) {
  const admin = deps.admin as any;
  const { error } = await admin
    .from("gift_cards")
    .update({ purchase_reference: reference, payment_provider: provider } as never)
    .eq("id", cardId)
    .eq("payment_status", "pending");
  if (error) throw new Error(error.message);
}

export async function redeemGiftCardCore(
  deps: { admin: AdminClient },
  userId: string,
  rawCode: string,
) {
  const { data, error } = await (deps.admin as any).rpc("redeem_gift_card", {
    _user: userId,
    _code: rawCode.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Invalid gift card code");
  return row as { credits: number; kind: GiftCardKind; pro_days: number; design: string };
}

export const issueGiftCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        credits: z.number().int().min(0).max(10_000),
        amountUsd: z.number().min(0).max(1000).default(0),
        kind: z.enum(["aura", "pro"]).default("aura"),
        proDays: z.number().int().min(0).max(365).default(0),
        design: z.enum(["aurora", "midnight", "neon", "rose"]).default("aurora"),
        note: z.string().max(200).optional().nullable(),
      }).superRefine((value, ctx) => {
        if (value.kind === "aura" && value.credits <= 0) ctx.addIssue({ code: "custom", message: "Aura cards need credits" });
        if (value.kind === "pro" && value.proDays <= 0) ctx.addIssue({ code: "custom", message: "Pro cards need a duration" });
      })
      .parse(input),
  )
  .handler(async ({ data, context }) =>
    issueGiftCardCore({ admin: supabaseAdmin }, context.userId, {
      credits: data.credits,
      amountUsd: data.amountUsd,
      kind: data.kind,
      proDays: data.proDays,
      design: data.design,
      note: data.note,
    }),
  );

export const issueGiftCardBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      count: z.number().int().min(1).max(50),
      credits: z.number().int().min(0).max(10_000),
      amountUsd: z.number().min(0).max(1000).default(0),
      kind: z.enum(["aura", "pro"]),
      proDays: z.number().int().min(0).max(365),
      design: z.enum(["aurora", "midnight", "neon", "rose"]).default("aurora"),
      note: z.string().max(200).optional().nullable(),
    }).superRefine((value, ctx) => {
      if (value.kind === "aura" && value.credits <= 0) ctx.addIssue({ code: "custom", message: "Aura cards need credits" });
      if (value.kind === "pro" && value.proDays <= 0) ctx.addIssue({ code: "custom", message: "Pro cards need a duration" });
    }).parse(input),
  )
  .handler(async ({ data, context }) =>
    issueGiftCardBatchCore({ admin: supabaseAdmin }, context.userId, data),
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

export const listMyPurchasedGiftCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (supabaseAdmin as any)
      .from("gift_cards")
      .select("*")
      .eq("purchaser_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

export const GiftCardPurchaseSchema = z.object({
  productId: z.enum(GIFT_CARD_PRODUCT_IDS),
  design: z.enum(["aurora", "midnight", "neon", "rose"]).default("aurora"),
  note: z.string().max(200).optional().nullable(),
});

export const redeemGiftCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(6).max(40) }).parse(input))
  .handler(async ({ data, context }) =>
    redeemGiftCardCore({ admin: supabaseAdmin }, context.userId, data.code),
  );
