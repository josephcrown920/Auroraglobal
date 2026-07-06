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
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { detectFeatures, computeCost, type Feature } from "@/lib/pricing";

const EstimateSchema = z.object({
  kind: z.enum(["image", "upscale", "text", "audio", "lipsync", "motion", "video"]),
  resolution: z.enum(["480p", "720p", "1080p", "2160p"]).optional(),
  duration: z.coerce.number().int().min(1).max(600).optional(),
  model: z.string().max(120).optional(),
  audioUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  cameraMovement: z.string().max(60).optional(),
  features: z
    .array(z.enum(["image", "upscale", "text", "audio", "lipsync", "motion", "video"]))
    .optional(),
});

/** Pure request→quote logic, exported so it can be unit-tested without a Request object. */
export function estimateFromParams(params: Record<string, string | string[] | undefined>) {
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
  return {
    credits: quote.total,
    breakdown: quote.breakdown,
    resolution: quote.resolution,
    durationSeconds: quote.durationSeconds,
    features,
    primaryKind,
  };
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
          const result = estimateFromParams(params);
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
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
    },
  },
});
