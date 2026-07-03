import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { GENERATION_SUCCESS_STATUSES, aggregateByDayKind } from "./cost-stats";
import { computeProfitSplit, PROFIT_SPLIT_PCT, CREDIT_FUNDING_PCT } from "@/lib/profit-split";
import { z } from "zod";

// Hidden owner gate. Validates against ADMIN_USERNAME + ADMIN_PASSCODE
// secrets. Returns a short-lived token the client stores in sessionStorage
// and replays via the X-Aurora-Admin header; server checks it on each
// admin call in addition to the Supabase admin role.
export const adminUnlock = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ username: z.string().min(1).max(120), passcode: z.string().min(1).max(200) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const u = process.env.ADMIN_USERNAME ?? "";
    const p = process.env.ADMIN_PASSCODE ?? "";
    if (!u || !p) throw new Error("Admin gate not configured");
    if (data.username !== u || data.passcode !== p) {
      // Constant-ish delay to slow brute force
      await new Promise((r) => setTimeout(r, 600));
      throw new Error("Invalid credentials");
    }
    return { ok: true, token: p }; // simple shared-secret token
  });

type SchedulerHeartbeat = {
  name: string;
  last_run_at: string | null;
  last_ok_at: string | null;
  last_error: string | null;
};

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

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    // `scheduler_heartbeats` is not in the generated Supabase types yet.
    const heartbeatTable = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            col: string,
            val: string,
          ) => { maybeSingle: () => Promise<{ data: SchedulerHeartbeat | null }> };
        };
      };
    };

    const [usersRes, gensRes, paymentsRes, jobsRes, heartbeatRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("user_id, email, display_name, credits, lifetime_credits_purchased, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("generations")
        .select(
          "id, user_id, prompt, status, kind, model, result_image_url, result_video_url, credits_cost, created_at, error",
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("payments")
        .select(
          "id, user_id, reference, amount_kobo, currency, credits_granted, status, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("jobs")
        .select(
          "id, generation_id, user_id, kind, status, attempts, error, scheduled_at, created_at",
        )
        .in("status", ["queued", "processing", "failed"])
        .order("created_at", { ascending: false })
        .limit(200),
      heartbeatTable
        .from("scheduler_heartbeats")
        .select("name, last_run_at, last_ok_at, last_error")
        .eq("name", "jobs_tick")
        .maybeSingle(),
    ]);

    const users = usersRes.data ?? [];
    const generations = gensRes.data ?? [];
    const payments = paymentsRes.data ?? [];
    const jobs = jobsRes.data ?? [];
    const scheduler = heartbeatRes.data ?? null;

    const totalRevenueUsd = payments
      .filter((p) => p.status === "succeeded")
      .reduce((acc, p) => acc + (p.currency === "USD" ? p.amount_kobo / 100 : 0), 0);

    const totalGens = generations.length;
    const totalImages = generations.filter((g) => g.kind === "image").length;
    const totalVideos = generations.filter((g) => g.kind === "video").length;

    // Queue health snapshot for the retry/scheduler panel.
    const queue = {
      queued: jobs.filter((j) => j.status === "queued").length,
      processing: jobs.filter((j) => j.status === "processing").length,
      failed: jobs.filter((j) => j.status === "failed").length,
      retrying: jobs.filter((j) => (j.attempts ?? 0) > 1 && j.status === "queued").length,
    };

    return {
      users,
      generations,
      payments,
      jobs,
      scheduler,
      queue,
      stats: { totalRevenueUsd, totalGens, totalImages, totalVideos, totalUsers: users.length },
    };
  });

export const adminGrantCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const o = input as { userId?: string; amount?: number };
    if (!o.userId || typeof o.amount !== "number") throw new Error("Bad input");
    return { userId: o.userId, amount: Math.floor(o.amount) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.rpc("grant_credits", {
      _user: data.userId,
      _amount: data.amount,
      _reason: "admin_grant",
      _ref: crypto.randomUUID(),
    });
    return { ok: true };
  });

const EARNINGS_RANGES = { "7d": 7, "30d": 30, "90d": 90, all: null } as const;
type EarningsRange = keyof typeof EARNINGS_RANGES;

export interface EarningsPaymentRow {
  amount_kobo: number;
  currency: string;
  credits_granted: number;
  profit_amount_minor: number | null;
  credit_funding_amount_minor: number | null;
}

export interface EarningsTotals {
  transactions: number;
  revenueMinor: number;
  profitMinor: number;
  creditFundingMinor: number;
  creditsDistributed: number;
}

// Pure reconciliation core for adminEarnings — extracted so the money math can
// be unit tested without a live Supabase/auth context. USD-only today; ignores
// non-USD rows in the money totals. Falls back to computeProfitSplit for
// legacy rows persisted before the profit/credit-funding columns existed, so
// totals always reconcile with revenue (profit + credit-funding == revenue).
export function reconcileEarningsTotals(payments: EarningsPaymentRow[]): EarningsTotals {
  const usdPayments = payments.filter((p) => p.currency === "USD");

  let revenueMinor = 0;
  let profitMinor = 0;
  let creditFundingMinor = 0;
  let creditsDistributed = 0;
  for (const p of usdPayments) {
    revenueMinor += p.amount_kobo;
    const fallback = computeProfitSplit(p.amount_kobo);
    profitMinor += p.profit_amount_minor ?? fallback.profit_minor;
    creditFundingMinor += p.credit_funding_amount_minor ?? fallback.credit_funding_minor;
    creditsDistributed += p.credits_granted;
  }

  return {
    transactions: usdPayments.length,
    revenueMinor,
    profitMinor,
    creditFundingMinor,
    creditsDistributed,
  };
}

// Owner-facing earnings aggregation. Reads the real `payments` rows (only
// successful charges), summing the persisted profit / credit-funding split and
// credits distributed over a selectable time range, plus a recent-purchases
// list joined to customer email/name. Admin-only.
export const adminEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const o = (input ?? {}) as { range?: string };
    const range: EarningsRange =
      o.range && o.range in EARNINGS_RANGES ? (o.range as EarningsRange) : "30d";
    return { range };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const days = EARNINGS_RANGES[data.range];
    const since = days == null ? null : new Date(Date.now() - days * 86_400_000).toISOString();

    let query = supabaseAdmin
      .from("payments")
      .select(
        "id, user_id, amount_kobo, currency, credits_granted, status, created_at, profit_amount_minor, credit_funding_amount_minor, split_profit_pct",
      )
      .eq("status", "succeeded")
      .order("created_at", { ascending: false });
    if (since) query = query.gte("created_at", since);
    const { data: paymentsRaw, error } = await query.limit(2000);
    if (error) throw new Error(error.message);
    const payments = paymentsRaw ?? [];
    const { transactions, revenueMinor, profitMinor, creditFundingMinor, creditsDistributed } =
      reconcileEarningsTotals(payments);

    // Recent purchases joined to the buyer's email / name (no FK relationship
    // defined on payments, so resolve profiles in a second query).
    const recent = payments.slice(0, 20);
    const userIds = [...new Set(recent.map((p) => p.user_id))];
    const profileMap = new Map<string, { email: string | null; display_name: string | null }>();
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id, email, display_name")
        .in("user_id", userIds);
      for (const pr of profs ?? [])
        profileMap.set(pr.user_id, { email: pr.email, display_name: pr.display_name });
    }

    const recentPurchases = recent.map((p) => {
      const prof = profileMap.get(p.user_id);
      return {
        id: p.id,
        user_id: p.user_id,
        email: prof?.email ?? null,
        display_name: prof?.display_name ?? null,
        currency: p.currency,
        amount_minor: p.amount_kobo,
        profit_minor: p.profit_amount_minor ?? computeProfitSplit(p.amount_kobo).profit_minor,
        credits_granted: p.credits_granted,
        created_at: p.created_at,
      };
    });

    return {
      range: data.range,
      profitPct: PROFIT_SPLIT_PCT,
      creditFundingPct: CREDIT_FUNDING_PCT,
      totals: {
        transactions,
        revenueUsd: revenueMinor / 100,
        profitUsd: profitMinor / 100,
        creditFundingUsd: creditFundingMinor / 100,
        creditsDistributed,
      },
      recentPurchases,
    };
  });
// ─── Cost analytics (last 30 days) ────────────────────────────────────────────

export const adminCostStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: gens, error } = await supabaseAdmin
      .from("generations")
      .select("kind, credits_cost, created_at, status")
      .gte("created_at", since)
      // Writers use 'succeeded' (API core) and 'complete' (studio fns) — the
      // shared constant keeps this filter from drifting (a hand-rolled
      // 'completed' here previously dropped every studio render from spend).
      .in("status", [...GENERATION_SUCCESS_STATUSES])
      .order("created_at", { ascending: false })
      .limit(10000);

    if (error) throw new Error(error.message);
    const byDayKind = aggregateByDayKind(gens ?? []);

    return { byDayKind, since };
  });
