import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarketplaceTemplateStatus = "draft" | "pending" | "approved" | "rejected";

export type MarketplaceTemplate = {
  id: string;
  creator_user_id: string;
  name: string;
  description: string;
  thumbnail_url: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ComfyUI graph_json is dynamically structured with runtime-determined node types
  graph_json: Record<string, any>;
  category: string;
  tags: string[];
  status: MarketplaceTemplateStatus;
  rejection_reason: string | null;
  cut_pct: number;
  run_cost_aura: number;
  run_count: number;
  created_at: string;
  updated_at: string;
  creator_display_name?: string | null;
};

// ─── Admin gate ───────────────────────────────────────────────────────────────

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

// ─── Creator: list my templates ───────────────────────────────────────────────

export const listMyMarketplaceTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("marketplace_templates")
      .select("*")
      .eq("creator_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as MarketplaceTemplate[];
  });

// ─── Creator: submit a new template ──────────────────────────────────────────

const SubmitTemplateSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(1000).default(""),
  thumbnail_url: z.string().url().optional().nullable(),
  graph_json: z.record(z.unknown()),
  category: z.string().max(60).default("Other"),
  tags: z.array(z.string().max(40)).max(10).default([]),
  run_cost_aura: z.number().int().min(1).max(500).default(5),
});

export const submitMarketplaceTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubmitTemplateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin
      .from("marketplace_templates")
      .insert({
        creator_user_id: context.userId,
        name: data.name,
        description: data.description,
        thumbnail_url: data.thumbnail_url ?? null,
        graph_json: data.graph_json as never,
        category: data.category,
        tags: data.tags,
        run_cost_aura: data.run_cost_aura,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

// ─── Creator: update a draft/rejected template ────────────────────────────────

export const updateMyMarketplaceTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(3).max(120).optional(),
      description: z.string().max(1000).optional(),
      thumbnail_url: z.string().url().optional().nullable(),
      graph_json: z.record(z.unknown()).optional(),
      category: z.string().max(60).optional(),
      tags: z.array(z.string().max(40)).max(10).optional(),
      run_cost_aura: z.number().int().min(1).max(500).optional(),
      resubmit: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, resubmit, ...fields } = data;
    const update: Record<string, unknown> = { ...fields };
    if (resubmit) update.status = "pending";

    const { error } = await supabaseAdmin
      .from("marketplace_templates")
      .update(update as never)
      .eq("id", id)
      .eq("creator_user_id", context.userId)
      .in("status", ["draft", "pending", "rejected"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Creator: earnings summary ────────────────────────────────────────────────

export const getCreatorEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: templates, error: tErr } = await supabaseAdmin
      .from("marketplace_templates")
      .select("id, name, status, run_count, run_cost_aura, cut_pct, created_at")
      .eq("creator_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (tErr) throw new Error(tErr.message);

    // Aggregate totals from the full run history (all rows, not capped).
    // Supabase supports Postgres aggregate functions via .select().
    const { data: agg, error: aggErr } = await supabaseAdmin
      .from("marketplace_template_runs")
      .select("count:id.count(), total_earned:creator_cut_aura.sum()")
      .eq("creator_user_id", context.userId)
      .single();
    if (aggErr && aggErr.code !== "PGRST116") throw new Error(aggErr.message);

    // Recent runs list — capped for UI display only.
    const { data: runs, error: rErr } = await supabaseAdmin
      .from("marketplace_template_runs")
      .select("template_id, aura_charged, creator_cut_aura, created_at")
      .eq("creator_user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (rErr) throw new Error(rErr.message);

    const typedTemplates = (templates ?? []) as Array<{
      id: string;
      name: string;
      status: string;
      run_count: number;
      run_cost_aura: number;
      cut_pct: number;
      created_at: string;
    }>;

    const typedRuns = (runs ?? []) as Array<{
      template_id: string;
      aura_charged: number;
      creator_cut_aura: number;
      created_at: string;
    }>;

    const aggRow = agg as { count: number; total_earned: string | null } | null;
    const totalRuns = Number(aggRow?.count ?? 0);
    const totalEarnedAura = Number(aggRow?.total_earned ?? 0);

    return {
      templates: typedTemplates,
      recentRuns: typedRuns,
      totalRuns,
      totalEarnedAura,
    };
  });

// ─── Public: list approved templates ─────────────────────────────────────────

export const listApprovedMarketplaceTemplates = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("marketplace_templates")
      .select("id, creator_user_id, name, description, thumbnail_url, category, tags, run_cost_aura, run_count, cut_pct, created_at")
      .eq("status", "approved")
      .order("run_count", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<MarketplaceTemplate & { creator_user_id: string }>;

    const creatorIds = [...new Set(rows.map((r) => r.creator_user_id))];
    const profilesMap = new Map<string, string | null>();
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", creatorIds);
      for (const p of profiles ?? []) {
        const prof = p as { user_id: string; display_name: string | null };
        profilesMap.set(prof.user_id, prof.display_name);
      }
    }

    return rows.map((r) => ({
      ...r,
      creator_display_name: profilesMap.get(r.creator_user_id) ?? null,
    })) as MarketplaceTemplate[];
  });

// ─── Public: get one approved template (for admin preview / marketplace page) ─

export const getMarketplaceTemplate = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("marketplace_templates")
      .select("*")
      .eq("id", data.id)
      .eq("status", "approved")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Template not found");
    return row as MarketplaceTemplate;
  });

// ─── Authenticated: load a marketplace template into canvas (FREE) ─────────────
// Returns graph_json + cost info so the canvas can preview the template.
// No Aura is deducted here — charge happens in chargeMarketplaceTemplateRun
// the first time the user clicks "Run pipeline" after loading the template.

export const getMarketplaceTemplateForCanvas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: tmpl, error } = await supabaseAdmin
      .from("marketplace_templates")
      .select("id, name, graph_json, run_cost_aura, cut_pct")
      .eq("id", data.id)
      .eq("status", "approved")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tmpl) throw new Error("Template not found");
    return {
      id: tmpl.id as string,
      name: tmpl.name as string,
      run_cost_aura: tmpl.run_cost_aura as number,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ComfyUI node/edge payloads are dynamically typed at runtime
      graph: tmpl.graph_json as { name: string; nodes: any[]; edges: any[] },
    };
  });

// ─── Authenticated: charge a marketplace template run ─────────────────────────
// Called on first "Run pipeline" in canvas after loading a marketplace template.
//
// Task #214: reserve → finalize_marketplace_run (atomic) → update run count.
// finalize_marketplace_run inserts the run record, commits the buyer's reservation,
// and grants the creator's cut in one Postgres transaction. Any error inside that
// function rolls back all three writes atomically — no partial state where the
// buyer was charged but the creator wasn't paid, or the run was recorded but
// credits stayed reserved.

type TemplateRow = {
  id: string;
  creator_user_id: string;
  run_cost_aura: number;
  cut_pct: number;
  run_count: number;
};

type RpcResult = { data: unknown; error: { message: string } | null };

/** Injectable deps for chargeMarketplaceRunCore — enables unit testing without
 *  mock.module or a live database. */
export type MarketplaceChargeDeps = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult>;
  getTemplate: (id: string) => Promise<TemplateRow | null>;
  updateRunCount: (id: string, newCount: number) => Promise<void>;
};

async function buildMarketplaceDeps(): Promise<MarketplaceChargeDeps> {
  return {
    rpc: (name, args) =>
      (supabaseAdmin as unknown as { rpc: MarketplaceChargeDeps["rpc"] }).rpc(name, args),
    getTemplate: async (id) => {
      const { data, error } = await supabaseAdmin
        .from("marketplace_templates")
        .select("id, creator_user_id, run_cost_aura, cut_pct, run_count")
        .eq("id", id)
        .eq("status", "approved")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as TemplateRow | null;
    },
    updateRunCount: async (id, newCount) => {
      // Best-effort display counter — do not fail the committed charge on error.
      await supabaseAdmin
        .from("marketplace_templates")
        .update({ run_count: newCount })
        .eq("id", id);
    },
  };
}

/** Core charge logic, extracted for testability. Used by chargeMarketplaceTemplateRun. */
export async function chargeMarketplaceRunCore(
  templateId: string,
  runnerUserId: string,
  deps: MarketplaceChargeDeps,
): Promise<{ ok: true } | { ok: false; error: string; insufficient?: boolean }> {
  const t = await deps.getTemplate(templateId);
  if (!t) throw new Error("Template not found or not approved");

  const cost = t.run_cost_aura;
  const ref = crypto.randomUUID();
  let reservedAmount = 0;

  try {
    const { data: reserved, error: resErr } = await deps.rpc("reserve_credits", {
      _user: runnerUserId,
      _amount: cost,
      _reason: `marketplace_template:${t.id}`,
      _ref: ref,
    });
    if (resErr) throw new Error(resErr.message);
    if (!reserved) return { ok: false, error: "Insufficient Aura credits", insufficient: true };
    reservedAmount = cost;

    // Integer split — consistent with grant_credits(_amount integer).
    const creatorCut = Math.round(cost * (Number(t.cut_pct) / 100));
    const platformCut = cost - creatorCut;
    const creatorRef = crypto.randomUUID();

    // Atomically: insert run record + commit buyer's reservation + grant creator
    // cut — all in one Postgres transaction (finalize_marketplace_run).
    // If this RPC returns an error, the transaction rolled back — the run was NOT
    // recorded and the reservation was NOT committed. The catch block then releases
    // the reservation so the user gets their credits back.
    const { error: finalizeErr } = await deps.rpc("finalize_marketplace_run", {
      _runner_user_id: runnerUserId,
      _creator_user_id: t.creator_user_id,
      _template_id: t.id,
      _aura_charged: cost,
      _creator_cut_aura: creatorCut,
      _platform_cut_aura: platformCut,
      _amount: cost,
      _reason: `marketplace_template:${t.id}`,
      _ref: ref,
      _creator_ref: creatorRef,
    });
    if (finalizeErr) {
      // Postgres transaction aborted — nothing written or committed.
      // The catch block will release the reservation.
      throw new Error(`Marketplace run finalization failed: ${finalizeErr.message}`);
    }
    reservedAmount = 0;

    // run_count is a display counter — update it but don't fail the committed charge.
    await deps.updateRunCount(t.id, t.run_count + 1).catch(() => {});

    return { ok: true };
  } catch (e) {
    if (reservedAmount > 0) {
      // The reservation is still active (finalize_marketplace_run rolled back or
      // was never called). Release so the user gets their credits back.
      await deps.rpc("release_reservation", {
        _user: runnerUserId,
        _amount: reservedAmount,
        _reason: `release_marketplace_template:${t.id}`,
        _ref: ref,
      });
      // Don't surface a release failure on top of the original error — the
      // stuck-reservation sweeper will reconcile any that slip through.
    }
    throw e;
  }
}

export const chargeMarketplaceTemplateRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const deps = await buildMarketplaceDeps();
    return chargeMarketplaceRunCore(data.id, context.userId, deps);
  });

// ─── Admin: list templates pending review ─────────────────────────────────────

export const adminListMarketplaceTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("marketplace_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as MarketplaceTemplate[];
    const creatorIds = [...new Set(rows.map((r) => r.creator_user_id))];
    const profilesMap = new Map<string, string | null>();
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, display_name, email")
        .in("user_id", creatorIds);
      for (const p of profiles ?? []) {
        const prof = p as { user_id: string; display_name: string | null; email: string | null };
        profilesMap.set(prof.user_id, prof.display_name ?? prof.email ?? null);
      }
    }

    return rows.map((r) => ({
      ...r,
      creator_display_name: profilesMap.get(r.creator_user_id) ?? null,
    }));
  });

// ─── Admin: approve / reject ──────────────────────────────────────────────────

export const adminReviewMarketplaceTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["approve", "reject"]),
      rejection_reason: z.string().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const update =
      data.action === "approve"
        ? { status: "approved", rejection_reason: null }
        : { status: "rejected", rejection_reason: data.rejection_reason ?? "Does not meet guidelines" };
    const { error } = await supabaseAdmin
      .from("marketplace_templates")
      .update(update as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
