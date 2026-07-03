// Unified generation endpoint — POST /api/public/generate
// Authenticates the caller, deducts credits, validates URL hosts to prevent SSRF,
// then delegates to the orchestrator.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { type GenerateKind } from "@/lib/orchestrator.server";
import { reserveOrchestrateRecord } from "@/lib/generate-core.server";
import { assertTrustedUrl } from "@/lib/url-guard";
import { detectFeatures, computeCost, type Feature } from "@/lib/pricing";

const Schema = z.object({
  kind: z.enum(["image", "video", "lipsync", "upscale", "text", "audio"]),
  prompt: z.string().max(2000).optional(),
  imageUrls: z.array(z.string().url()).max(6).optional(),
  audioUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  duration: z.number().int().min(3).max(15).optional(),
  resolution: z.enum(["480p", "720p", "1080p"]).optional(),
  model: z.string().max(120).optional(),
  // CLI ergonomics: `aurora video --from latest --motion orbit --seconds 10`
  from: z.enum(["latest"]).optional(),
  motion: z
    .enum([
      "orbit",
      "push-in",
      "pull-out",
      "pan-left",
      "pan-right",
      "tilt-up",
      "tilt-down",
      "static",
      "handheld",
    ])
    .optional(),
  seconds: z.number().int().min(3).max(15).optional(),
  // Pluggable-backend passthrough: free-form provider params + a generic ComfyUI
  // workflow graph (+ per-node input patches) for `comfyui`-protocol workers.
  params: z.record(z.unknown()).optional(),
  comfyWorkflow: z.unknown().optional(),
  comfyInputs: z.record(z.unknown()).optional(),
  // Stacked-pricing override: force the exact set of billable features.
  features: z
    .array(z.enum(["image", "upscale", "text", "audio", "lipsync", "motion", "video"]))
    .optional(),
  // Preview-confirm gate (task #153): id of a succeeded preview generation the
  // caller owns. Without it, video/lipsync requests are forced to a cheap
  // 480p/≤5s preview pass.
  confirmPreviewId: z.string().uuid().optional(),
});

async function authUserId(req: Request): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const token = h.slice(7);
  // Personal CLI API keys (aurk_*) — looked up against api_keys.key_hash.
  if (token.startsWith("aurk_")) {
    const { userIdForApiKey } = await import("@/lib/cli-device.server");
    return userIdForApiKey(token);
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export const Route = createFileRoute("/api/public/generate")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }),
      POST: async ({ request }) => {
        const cors = {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let userId: string | null = null;
        try {
          userId = await authUserId(request);
          if (!userId) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: cors,
            });
          }
          const body = await request.json();
          const data = Schema.parse(body);

          // Resolve `from: latest` → user's most recent successful generation image/video
          if (data.from === "latest") {
            const { data: last } = await supabaseAdmin
              .from("generations")
              .select("result_image_url, result_video_url, input_images")
              .eq("user_id", userId)
              .eq("status", "succeeded")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            const latestImg =
              last?.result_image_url ||
              (Array.isArray(last?.input_images) && last.input_images.length
                ? (last.input_images[0] as string)
                : null);
            if (data.kind === "video" || data.kind === "image" || data.kind === "upscale") {
              if (latestImg && !(data.imageUrls && data.imageUrls.length)) {
                data.imageUrls = [latestImg];
              }
            } else if (data.kind === "lipsync") {
              if (last?.result_video_url && !data.videoUrl) data.videoUrl = last.result_video_url;
            }
            if (!data.imageUrls?.length && !data.videoUrl) {
              return new Response(
                JSON.stringify({
                  ok: false,
                  error: "No previous generation found for --from latest",
                }),
                { status: 400, headers: cors },
              );
            }
          }

          // Motion preset → prompt enrichment for video
          if (data.kind === "video" && data.motion) {
            const motionPhrase: Record<string, string> = {
              orbit: "smooth orbital camera circling the subject",
              "push-in": "slow cinematic push-in toward the subject",
              "pull-out": "graceful pull-out reveal",
              "pan-left": "steady pan to the left",
              "pan-right": "steady pan to the right",
              "tilt-up": "elegant tilt up",
              "tilt-down": "elegant tilt down",
              static: "locked-off static camera",
              handheld: "subtle handheld camera movement",
            };
            const m = motionPhrase[data.motion];
            data.prompt = data.prompt ? `${data.prompt}, ${m}` : m;
          }
          if (data.kind === "video" && data.seconds && !data.duration) {
            data.duration = data.seconds;
          }

          // SSRF guard
          for (const url of data.imageUrls ?? []) assertTrustedUrl(url);
          if (data.audioUrl) assertTrustedUrl(data.audioUrl);
          if (data.videoUrl) assertTrustedUrl(data.videoUrl);

          // Duration cap: enforce tier-aware limit (Free=10s, Pro=15s)
          if (data.duration && (data.kind === "video" || data.kind === "lipsync")) {
            const { assertDurationCap } = await import("@/lib/cost-guardrails.server");
            await assertDurationCap(userId, data.duration);
          }

          // Preview-confirm gate: unconfirmed temporal renders are forced down
          // to a cheap 480p/≤5s preview. The response carries the preview's
          // generation id — pass it back as `confirmPreviewId` to render full
          // quality. An invalid/expired id throws (never silently upgrades).
          let previewPass = false;
          if (data.kind === "video" || data.kind === "lipsync") {
            const { resolvePreviewGate, PREVIEW_RESOLUTION, PREVIEW_MAX_SECONDS } = await import(
              "@/lib/cost-guardrails.server"
            );
            const gate = await resolvePreviewGate({
              userId,
              confirmPreviewId: data.confirmPreviewId,
            });
            if (!gate.confirmed) {
              previewPass = true;
              data.resolution = PREVIEW_RESOLUTION;
              data.duration = Math.min(data.duration ?? PREVIEW_MAX_SECONDS, PREVIEW_MAX_SECONDS);
            }
          }

          // Detect the billable features (deterministic, off explicit inputs) and
          // price the stack via the shared module so the charge matches any preview.
          const { features } = detectFeatures({
            kind: data.kind as Feature,
            audioUrl: data.audioUrl,
            videoUrl: data.videoUrl,
            cameraMovement: data.motion,
            features: data.features,
          });
          const quote = computeCost({
            features,
            resolution: data.resolution,
            durationSeconds: data.duration,
            model: data.model,
          });

          // Reserve credits → orchestrate → record → commit (shared core; also
          // used by the Aurora Agent per-shot renderer so the credit flow never drifts).
          const cost = quote.total;
          const outcome = await reserveOrchestrateRecord({
            userId,
            kind: data.kind as GenerateKind,
            prompt: data.prompt,
            imageUrls: data.imageUrls,
            audioUrl: data.audioUrl,
            videoUrl: data.videoUrl,
            duration: data.duration,
            resolution: data.resolution,
            model: data.model,
            params: data.params,
            comfyWorkflow: data.comfyWorkflow,
            comfyInputs: data.comfyInputs,
            cost,
            reason: previewPass ? `public_generate_${data.kind}_preview` : `public_generate_${data.kind}`,
            mode: previewPass ? "preview" : undefined,
          });
          if (!outcome.ok) {
            return new Response(JSON.stringify({ error: outcome.error }), {
              status: outcome.insufficient ? 402 : 400,
              headers: cors,
            });
          }

          return new Response(
            JSON.stringify({
              ok: true,
              url: outcome.url,
              text: outcome.text,
              provider: outcome.provider,
              endpoint: outcome.endpoint,
              latencyMs: outcome.latencyMs,
              estimatedCostUsd: outcome.costUsd,
              creditsCost: cost,
              costBreakdown: quote.breakdown,
              ...(previewPass
                ? {
                    preview: true,
                    requiresConfirmation: true,
                    previewGenerationId: outcome.generationId,
                    hint: "This was rendered as a 480p/≤5s preview. Re-send the request with confirmPreviewId set to previewGenerationId to render at full quality.",
                  }
                : {}),
            }),
            { status: 200, headers: cors },
          );
        } catch (e) {
          // Credit release on failure is handled inside reserveOrchestrateRecord.
          const msg = e instanceof Error ? e.message : "Unknown error";
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 400,
            headers: cors,
          });
        }
      },
    },
  },
});
