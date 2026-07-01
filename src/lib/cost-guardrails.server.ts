// Server-only cost control helpers.
// Keeps the hot paths (worker loop, orchestrate) fast and readable by isolating
// plan-lookup + cap validation here. The only server-side dependency is a single
// Supabase profile read; all other helpers are pure functions.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tierFor, DURATION_CAPS, type SubscriptionTier } from "./billing.plans";

// ─── User-tier lookup ─────────────────────────────────────────────────────────

/** Fetch the user's active plan tier from their profile row. Returns 'free' on any lookup failure. */
export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();
  return tierFor((data as { plan?: string | null } | null)?.plan ?? null);
}

// ─── Duration cap ─────────────────────────────────────────────────────────────

/**
 * Throw a TERMINAL error when `durationSeconds` exceeds the user's plan cap.
 *
 * The message starts with "Unsupported" which matches TERMINAL_ERROR_RE in
 * jobs.server.ts, so the job is immediately failed + refunded rather than
 * retried. The user must shorten the request or upgrade their plan.
 */
export async function assertDurationCap(
  userId: string,
  durationSeconds: number,
): Promise<void> {
  const tier = await getUserTier(userId);
  const cap = DURATION_CAPS[tier];
  if (durationSeconds > cap) {
    const tierLabel = tier === "pro" ? "Pro" : "Free";
    const upgradeHint = tier === "free" ? " Upgrade to Pro for up to 15 seconds." : "";
    throw new Error(
      `Unsupported duration for your ${tierLabel} plan: ${durationSeconds}s exceeds the ${cap}s limit.${upgradeHint}`,
    );
  }
}

// ─── Heavy-queue classification ───────────────────────────────────────────────
// Pure helpers live in billing.plans.ts (no server deps) so tests can import
// them without mocking Supabase. Re-exported here for convenience.
export { HEAVY_JOB_KINDS, classifyJobQueue } from "./billing.plans";
