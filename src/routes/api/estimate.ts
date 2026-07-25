// GET /api/estimate — server-side cost preview, no job enqueued.
//
// The client (orchestrate.tsx) already renders an instant preview by calling
// computeCost()/detectFeatures() from pricing.ts directly (dependency-free, so
// it can run in the browser). That client-side number is a genuine preview,
// but it's still just a copy of the pricing logic running in the browser: if
// this route and the client ever drift (a bug, a future tier-aware pricing
// rule, a stale bundle), the button could show a number the server wouldn't
// actually charge. This endpoint runs the EXACT SAME pricing module
// (computeCost/detectFeatures from pricing.ts) server-side and returns the
// quote, so the UI can do a live round-trip right before the user commits
// Aura and never show a number the server disagrees with.
//
// Intentionally side-effect-free: no auth, no credit reservation, no DB
// writes — just a pure quote, safe to call as often as the UI likes.
//
// Contract note: this endpoint accepts the pricing-relevant SUBSET of the
// orchestrate/public-generate payload (kind, resolution, duration, model,
// features, and the URLs/camera-movement used only for feature detection) —
// not every field those endpoints accept (e.g. prompt, imageUrls). Only the
// params that feed computeCost()/detectFeatures() or the tier guardrails are
// needed for an accurate quote.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { detectFeatures, computeCost, type Feature } from "@/lib/pricing";
import { durationCapMessage, tierFor, type SubscriptionTier } from "@/lib/billing.plans";

// Duration bounds MUST match the executable charge paths (OrchestrateSchema in
// orchestration.functions.ts, Schema in api/public/generate.ts) — a quote for a
// length the render path would reject is worse than no quote at all.
const EstimateSchema = z.object({
  kind: z.enum(["image", "upscale", "text", "audio", "lipsync", "motion", "video"]),
  resolution: z.enum(["480p", "720p", "1080p", "2160p"]).optional(),
  duration: z.coerce.number().int().min(3).max(15).optional(),
  model: z.string().max(120).optional(),
  audioUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  cameraMovement: z.string().max(60).optional(),
  features: z
    .array(z.enum(["image", "upscale", "text", "audio", "lipsync", "motion", "video"]))
    .optional(),
});

export type EstimateBlock = { message: string } | null;

/**
 * Tier-aware guardrail check mirroring assertDurationCap/assertHdEntitlement
 * (src/lib/cost-guardrails.server.ts) without requiring a DB round trip here —
 * callers pass the already-resolved tier. Returns the same TERMINAL message
 * text the real charge path would throw, or null when the request is allowed.
 * Keeping this pure (no Supabase import) means it can be unit-tested directly
 * and reused by both the authenticated and unauthenticated estimate paths.
 */
export function checkGuardrails(
  tier: SubscriptionTier,
  durationSeconds: number | undefined,
  resolution: string | undefined,
  isTemporalKind: boolean,
): EstimateBlock {
  if (isTemporalKind && durationSeconds) {
    const msg = durationCapMessage(tier, durationSeconds);
    if (msg) return { message: msg };
  }
  if ((resolution === "1080p" || resolution === "2160p") && tier !== "pro") {
    const label = resolution === "2160p" ? "4K (2160p)" : "HD (1080p)";
    return {
      message: `Unsupported resolution for Free plan: ${label} requires Pro. Upgrade to unlock HD and 4K exports.`,
    };
  }
  return null;
}

/**
 * Pure request→quote logic, exported so it can be unit-tested without a
 * Request object. `tier` is optional: when the caller is unauthenticated we
 * can't know their plan, so we skip tier-specific guardrails (duration bounds
 * are still clamped to the global 3-15s window every plan shares). Passing a
 * tier (resolved from the caller's auth token by the route handler) makes the
 * quote fully match what orchestrateGenerate/the public API would allow.
 */
export async function estimateFromParams(
  params: Record<string, string | string[] | undefined>,
  tier?: SubscriptionTier,
) {
  const raw = {
    kind: params.kind,
    resolution: params.resolution || undefined,
    duration: params.duration || undefined,
    model: params.model || undefined,
    audioUrl: params.audioUrl || undefined,
    videoUrl: params.videoUrl || undefined,
    cameraMovement: params.cameraMovement || undefined,
    features:
      typeof params.features === "string" && params.features.length > 0
        ? params.features.split(",")
        : Array.isArray(params.features)
          ? params.features
          : undefined,
  };
  const data = EstimateSchema.parse(raw);
  const { features, primaryKind } = detectFeatures({
    kind: data.kind as Feature,
    audioUrl: data.audioUrl,
    videoUrl: data.videoUrl,
    cameraMovement: data.cameraMovement,
    features: data.features,
  });
  const quote = computeCost({
    features,
    resolution: data.resolution,
    durationSeconds: data.duration,
    model: data.model,
  });
  const isTemporalKind = data.kind === "video" || data.kind === "motion";
  const blocked = tier ? checkGuardrails(tier, data.duration, data.resolution, isTemporalKind) : null;

  // Sign the quoted features into an opaque token that the caller MUST pass to
  // orchestrateGenerate as quoteToken. The server validates the token at execution
  // and uses the quoted features as the authoritative billing set — enforcing that
  // motion-priced quotes are charged at the motion price (never silently downgraded).
  const { signQuoteToken } = await import("@/lib/quote-token.server");
  const quoteToken = await signQuoteToken({
    k: data.kind,
    f: features,
    r: data.resolution,
    d: data.duration,
  });

  return {
    credits: quote.total,
    breakdown: quote.breakdown,
    resolution: quote.resolution,
    durationSeconds: quote.durationSeconds,
    features,
    primaryKind,
    blocked,
    quoteToken,
  };
}

/**
 * Best-effort tier resolution from an optional Bearer token — mirrors
 * authUserId() in api/public/generate.ts. Returns null (not a throw) on any
 * failure so an unauthenticated or expired-token caller still gets a quote;
 * they just don't get tier-specific guardrail checks (duration bounds are
 * still globally clamped by EstimateSchema).
 */
async function resolveTier(request: Request): Promise<SubscriptionTier | undefined> {
  const h = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return undefined;
  const token = h.slice(7);
  if (!token) return undefined;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) return undefined;
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("plan")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    return tierFor((data as { plan?: string | null } | null)?.plan ?? null);
  } catch {
    return undefined;
  }
}

export const Route = createFileRoute("/api/estimate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cors = {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        };
        try {
          const url = new URL(request.url);
          const params: Record<string, string | undefined> = {};
          for (const key of [
            "kind",
            "resolution",
            "duration",
            "model",
            "audioUrl",
            "videoUrl",
            "cameraMovement",
            "features",
          ]) {
            params[key] = url.searchParams.get(key) ?? undefined;
          }
          const tier = await resolveTier(request);
          const result = estimateFromParams(params, tier);
          return new Response(JSON.stringify(result), { status: 200, headers: cors });
        } catch (e) {
          const message = e instanceof z.ZodError ? e.errors[0]?.message ?? "Invalid params" : e instanceof Error ? e.message : "Invalid params";
          return new Response(JSON.stringify({ error: message }), { status: 400, headers: cors });
        }
      },
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            // Authorization is included so cross-origin callers can pass a Bearer
            // token to get tier-aware guardrail checks (see resolveTier below) —
            // the same-origin orchestrate.tsx flow already sends this header.
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }),
    },
  },
});
