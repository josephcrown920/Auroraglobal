// Server-only cost control helpers.
// Keeps the hot paths (worker loop, orchestrate) fast and readable by isolating
// plan-lookup + cap validation here. The only server-side dependency is a single
// Supabase profile read; all other helpers are pure functions.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { tierFor, durationCapMessage, type SubscriptionTier } from "./billing.plans";

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
  const msg = durationCapMessage(tier, durationSeconds);
  if (msg) throw new Error(msg);
}

// ─── Heavy-queue classification ───────────────────────────────────────────────
// Pure helpers live in billing.plans.ts (no server deps) so tests can import
// them without mocking Supabase. Re-exported here for convenience.
export { HEAVY_JOB_KINDS, classifyJobQueue } from "./billing.plans";
import { GENERATION_SUCCESS_STATUSES } from "./cost-stats";

// ─── Preview-confirm gate ─────────────────────────────────────────────────────
// Temporal renders (video / lipsync) are the expensive ones, so unconfirmed
// requests are forced down to a cheap preview (480p, ≤5s) first. To render at
// full quality the caller passes `confirmPreviewId` — the id of a succeeded
// preview generation they own — proving a human saw a draft before the big
// spend. Previews are marked `generations.mode = 'preview'`.

export const PREVIEW_RESOLUTION = "480p" as const;
export const PREVIEW_MAX_SECONDS = 5;
export const PREVIEW_CONFIRM_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Kinds gated behind a preview pass (all motion-producing renders). */
export function isTemporalKind(kind: string): boolean {
  return (
    kind === "video" || kind === "lipsync" || kind === "motion" || kind === "performance_reskin"
  );
}

export type PreviewRowCheck = {
  id: string;
  user_id: string;
  kind: string | null;
  mode: string | null;
  status: string | null;
  created_at: string | null;
};

/**
 * Pure validation of a claimed preview row. Throws a TERMINAL error (message
 * starts with "Unsupported", matching TERMINAL_ERROR_RE in jobs.server.ts) on
 * any mismatch — a bad confirmation must fail fast, never silently render at
 * full price.
 */
export function validateConfirmedPreview(
  row: PreviewRowCheck | null,
  userId: string,
  nowMs: number = Date.now(),
): void {
  const reject = (why: string): never => {
    throw new Error(`Unsupported preview confirmation: ${why}`);
  };
  if (!row || row.user_id !== userId) reject("preview not found");
  const r = row as PreviewRowCheck;
  if (r.mode !== "preview") reject("that generation is not a preview");
  if (!isTemporalKind(r.kind ?? "")) reject("preview is not a video/motion render");
  if (!(GENERATION_SUCCESS_STATUSES as readonly string[]).includes(r.status ?? "")) {
    reject("preview has not finished successfully");
  }
  const created = r.created_at ? Date.parse(r.created_at) : NaN;
  if (!Number.isFinite(created) || nowMs - created > PREVIEW_CONFIRM_WINDOW_MS) {
    reject("preview has expired — render a fresh preview first");
  }
}

// ─── HD / 4K resolution entitlement ──────────────────────────────────────────

/**
 * Throw a TERMINAL error when 1080p or 2160p is requested by a non-Pro user.
 *
 * Preview passes are always forced to 480p server-side so they are exempt.
 * The error message starts with "Unsupported" (matches TERMINAL_ERROR_RE in
 * jobs.server.ts) so the job is immediately failed rather than retried.
 *
 * @param userId - requesting user
 * @param resolution - the _effective_ resolution after preview-pass resolution
 * @param previewPass - true when the server is forcing a preview (always 480p)
 */
export async function assertHdEntitlement(
  userId: string,
  resolution: string | undefined,
  previewPass: boolean,
): Promise<void> {
  if (previewPass) return; // always capped at 480p by the preview gate
  if (resolution !== "1080p" && resolution !== "2160p") return;
  const tier = await getUserTier(userId);
  if (tier === "pro") return;
  const label = resolution === "2160p" ? "4K (2160p)" : "HD (1080p)";
  throw new Error(
    `Unsupported resolution for Free plan: ${label} requires Pro. Upgrade to unlock HD and 4K exports.`,
  );
}

/**
 * Resolve whether this request is confirmed for full quality.
 * - No `confirmPreviewId` → `{ confirmed: false }` (caller must force preview caps).
 * - A valid one → `{ confirmed: true }`.
 * - An invalid one → throws (terminal), so a stale/forged id never silently
 *   downgrades OR upgrades the render.
 */
export async function resolvePreviewGate(args: {
  userId: string;
  confirmPreviewId?: string | null;
}): Promise<{ confirmed: boolean }> {
  if (!args.confirmPreviewId) return { confirmed: false };
  const { data } = await supabaseAdmin
    .from("generations")
    .select("id, user_id, kind, mode, status, created_at")
    .eq("id", args.confirmPreviewId)
    .maybeSingle();
  validateConfirmedPreview((data as PreviewRowCheck | null) ?? null, args.userId);
  return { confirmed: true };
}
