// Server-only cost control helpers.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  hasActiveProEntitlement,
  durationCapMessage,
  hdEntitlementMessage,
  type SubscriptionTier,
} from "./billing.plans";
import { GENERATION_SUCCESS_STATUSES } from "./cost-stats";

export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const { data } = await supabaseAdmin.from("profiles").select("plan, subscription_expires_at").eq("user_id", userId).maybeSingle();
  const profile = data as { plan?: string | null; subscription_expires_at?: string | null } | null;
  if (!profile) return "free";
  const { data: subscription } = await supabaseAdmin.from("subscriptions").select("status, next_payment_date").eq("user_id", userId).in("status", ["active", "cancellation_pending"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return hasActiveProEntitlement(profile, subscription) ? "pro" : "free";
}

export async function assertDurationCap(userId: string, durationSeconds: number): Promise<void> {
  const msg = durationCapMessage(await getUserTier(userId), durationSeconds);
  if (msg) throw new Error(msg);
}

export { HEAVY_JOB_KINDS, classifyJobQueue } from "./billing.plans";

export const PREVIEW_RESOLUTION = "480p" as const;
export const PREVIEW_MAX_SECONDS = 5;
export const PREVIEW_CONFIRM_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isTemporalKind(kind: string): boolean {
  return kind === "video" || kind === "lipsync" || kind === "motion" || kind === "performance_reskin";
}

export type PreviewRowCheck = { id: string; user_id: string; kind: string | null; mode: string | null; status: string | null; created_at: string | null };

export function validateConfirmedPreview(row: PreviewRowCheck | null, userId: string, nowMs: number = Date.now()): void {
  const reject = (why: string): never => { throw new Error(`Unsupported preview confirmation: ${why}`); };
  if (!row || row.user_id !== userId) reject("preview not found");
  const r = row as PreviewRowCheck;
  if (r.mode !== "preview") reject("that generation is not a preview");
  if (!isTemporalKind(r.kind ?? "")) reject("preview is not a video/motion render");
  if (!(GENERATION_SUCCESS_STATUSES as readonly string[]).includes(r.status ?? "")) reject("preview has not finished successfully");
  const created = r.created_at ? Date.parse(r.created_at) : NaN;
  if (!Number.isFinite(created) || nowMs - created > PREVIEW_CONFIRM_WINDOW_MS) reject("preview has expired — render a fresh preview first");
}

export async function assertHdEntitlement(userId: string, resolution: string | undefined, previewPass: boolean): Promise<void> {
  if (previewPass || (resolution !== "1080p" && resolution !== "2160p")) return;
  const msg = hdEntitlementMessage(await getUserTier(userId), resolution);
  if (msg) throw new Error(msg);
}

export type DailyBudgetDeps = {
  getProfile: (userId: string) => Promise<{ daily_spend_limit?: number | null } | null>;
  getLedgerRows: (userId: string, dayStart: string) => Promise<{ delta: number; reason: string }[]>;
};

const defaultDailyBudgetDeps: DailyBudgetDeps = {
  getProfile: async (userId) => {
    const { data } = await supabaseAdmin.from("profiles").select("daily_spend_limit").eq("user_id", userId).maybeSingle();
    return data as { daily_spend_limit?: number | null } | null;
  },
  getLedgerRows: async (userId, dayStart) => {
    const client = supabaseAdmin as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: number | null; error: { message: string } | null }> };
    const { data: totalSpent, error } = await client.rpc("get_daily_spend", { _user: userId, _day_start: dayStart });
    if (error) throw new Error(`Failed to fetch daily spend: ${error.message}`);
    return [{ delta: -(totalSpent ?? 0), reason: "reserve:aggregated" }];
  },
};

export async function assertDailyBudget(userId: string, estimatedCost: number, deps: DailyBudgetDeps = defaultDailyBudgetDeps): Promise<void> {
  const profile = await deps.getProfile(userId);
  const limit = profile?.daily_spend_limit ?? null;
  if (!limit) return;
  const dayStartUtc = new Date();
  dayStartUtc.setUTCHours(0, 0, 0, 0);
  const rows = await deps.getLedgerRows(userId, dayStartUtc.toISOString());
  const spentToday = rows.reduce((sum, r) => {
    // Preserve the original guardrail semantics for injected/test ledger rows:
    // only reservations consume daily budget; releases refund it. Production
    // uses the aggregate RPC above and supplies a synthetic reserve row.
    if (r.reason.startsWith("reserve:")) return sum - r.delta;
    if (r.reason.startsWith("release:")) return sum - r.delta;
    return sum;
  }, 0);
  if (spentToday + estimatedCost > limit) throw new Error(`Unsupported: daily_limit_reached — you've used ${spentToday} of your ${limit} Aura daily limit. Raise or clear your limit in Billing, or try again tomorrow.`);
}

export async function resolvePreviewGate(args: { userId: string; confirmPreviewId?: string | null }): Promise<{ confirmed: boolean }> {
  if (!args.confirmPreviewId) return { confirmed: false };
  const { data } = await supabaseAdmin.from("generations").select("id, user_id, kind, mode, status, created_at").eq("id", args.confirmPreviewId).maybeSingle();
  validateConfirmedPreview((data as PreviewRowCheck | null) ?? null, args.userId);
  return { confirmed: true };
}
