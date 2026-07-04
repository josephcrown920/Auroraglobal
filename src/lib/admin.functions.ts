import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { GENERATION_SUCCESS_STATUSES, aggregateByDayKind, bucketEarningsSeries } from "./cost-stats";
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

    const [usersRes, gensRes, paymentsRes, jobsRes, heartbeatRes, stuckReservationsRes] =
      await Promise.all([
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
        // Task #95: jobs left succeeded/failed with a reservation that
        // sweepStuckReservations hasn't caught up to yet (or, if this keeps
        // growing, evidence the sweep itself is stuck). Same grace window as
        // the sweep (STUCK_RESERVATION_GRACE_SECONDS) — a job that finished a
        // moment ago is normal (finalize_job settles it in the same
        // transaction, but the sweep only runs once per tick).
        supabaseAdmin
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .in("status", ["succeeded", "failed"])
          .gt("credits_reserved", 0)
          .is("credits_settled_at", null)
          .lt("finished_at", new Date(Date.now() - 10 * 60_000).toISOString()),
      ]);

    const users = usersRes.data ?? [];
    const generations = gensRes.data ?? [];
    const payments = paymentsRes.data ?? [];
    const jobs = jobsRes.data ?? [];
    const scheduler = heartbeatRes.data ?? null;
    const stuckReservations = { count: stuckReservationsRes.count ?? 0 };

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
      stuckReservations,
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

    // Daily/weekly trend series for the earnings chart. Short ranges (<=30d)
    // read best bucketed by day; longer ranges (90d/all) collapse to weekly
    // buckets so the chart stays readable.
    const granularity: "day" | "week" = days != null && days <= 30 ? "day" : "week";
    const usdPayments = payments.filter((p) => p.currency === "USD");
    const series = bucketEarningsSeries(
      usdPayments.map((p) => {
        const fallback = computeProfitSplit(p.amount_kobo);
        return {
          created_at: p.created_at,
          revenueMinor: p.amount_kobo,
          profitMinor: p.profit_amount_minor ?? fallback.profit_minor,
        };
      }),
      granularity,
    );

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
      series: {
        granularity,
        points: series.map((s) => ({
          bucket: s.bucket,
          revenueUsd: s.revenueMinor / 100,
          profitUsd: s.profitMinor / 100,
        })),
      },
    };
  });
// ─── Owner withdrawals (payouts against accumulated profit) ─────────────────
// `payments` tells us total profit ever accumulated; `owner_withdrawals` is a
// simple ledger of how much of that profit the owner has actually taken out,
// so the Earnings tab can show total profit / total withdrawn / remaining.
// Deliberately its own table (not the ai-credit-system bundle's
// profit_tracker schema) per the migration in supabase/migrations/.

export interface OwnerWithdrawalRow {
  id: string;
  withdrawn_at: string;
  amount_minor: number;
  note: string | null;
}

// `owner_withdrawals` is not in the generated Supabase types yet (same
// situation as scheduler_heartbeats above) — narrow-cast just this table.
// Only `.range()` is exposed (no `.limit()`) so every read here is forced
// through the pagination helper below — an all-time ledger total must never
// be computed from an arbitrarily-capped page.
interface WithdrawalsOrderable {
  // Chainable so a secondary tie-breaker column can be added for a fully
  // stable sort during pagination (see fetchAllWithdrawals below).
  order: (col: string, opts: { ascending: boolean }) => WithdrawalsOrderable;
  range: (
    from: number,
    to: number,
  ) => Promise<{ data: OwnerWithdrawalRow[] | null; error: { message: string } | null }>;
}

const withdrawalsTable = supabaseAdmin as unknown as {
  from: (t: "owner_withdrawals") => {
    select: (c: string) => WithdrawalsOrderable;
    insert: (row: {
      amount_minor: number;
      note: string | null;
      withdrawn_at: string;
      created_by: string;
    }) => Promise<{ error: { message: string } | null }>;
  };
};

const PAGE_SIZE = 1000;

// All-time profit total, independent of the Earnings range selector — a
// withdrawal is recorded against the whole accumulated pool, not a slice of
// it, so "remaining to withdraw" must reconcile against every payment ever
// made rather than whatever date range happens to be selected in the UI.
// Paginated (not a single capped `.limit()`) so the total stays correct no
// matter how many payments have accumulated.
async function computeAllTimeProfitMinor(): Promise<number> {
  let profitMinor = 0;
  let from = 0;
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("amount_kobo, currency, profit_amount_minor")
      .eq("status", "succeeded")
      // Explicit stable order (by primary key) so pages don't drift/skip
      // rows if new payments are inserted mid-scan.
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const p of rows) {
      if (p.currency !== "USD") continue;
      profitMinor += p.profit_amount_minor ?? computeProfitSplit(p.amount_kobo).profit_minor;
    }
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return profitMinor;
}

// Fetches every recorded withdrawal (newest first), paginated so the
// all-time "total withdrawn" figure is never derived from a capped page.
async function fetchAllWithdrawals(): Promise<OwnerWithdrawalRow[]> {
  const all: OwnerWithdrawalRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await withdrawalsTable
      .from("owner_withdrawals")
      .select("id, withdrawn_at, amount_minor, note")
      .order("withdrawn_at", { ascending: false })
      // Secondary tie-breaker on id — withdrawn_at alone isn't unique
      // (same-day payouts), so pages could drift/skip without it.
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

// Owner-facing withdrawal summary: all-time profit, total withdrawn, what's
// left, plus a recent list of recorded payouts. Admin-only.
export const adminWithdrawalSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const [totalProfitMinor, withdrawals] = await Promise.all([
      computeAllTimeProfitMinor(),
      fetchAllWithdrawals(),
    ]);
    const totalWithdrawnMinor = withdrawals.reduce((sum, w) => sum + w.amount_minor, 0);

    return {
      totalProfitUsd: totalProfitMinor / 100,
      totalWithdrawnUsd: totalWithdrawnMinor / 100,
      remainingUsd: (totalProfitMinor - totalWithdrawnMinor) / 100,
      // Recent-first slice for display only — the totals above already
      // reflect the full all-time set.
      withdrawals: withdrawals.slice(0, 200).map((w) => ({
        id: w.id,
        withdrawnAt: w.withdrawn_at,
        amountUsd: w.amount_minor / 100,
        note: w.note,
      })),
    };
  });

// Records a payout the owner actually took out of the business. Amount is
// entered in whole USD from the UI and converted to minor units here so the
// ledger stays in the same unit as `payments.profit_amount_minor`.
export const adminRecordWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        amountUsd: z.number().positive().finite(),
        note: z.string().trim().max(500).optional(),
        withdrawnAt: z.string().datetime().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const amount_minor = Math.round(data.amountUsd * 100);
    if (amount_minor <= 0) throw new Error("Amount must be greater than zero");

    const { error } = await withdrawalsTable.from("owner_withdrawals").insert({
      amount_minor,
      note: data.note?.length ? data.note : null,
      withdrawn_at: data.withdrawnAt ?? new Date().toISOString(),
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
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
