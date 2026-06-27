// Unified generation endpoint — POST /api/public/generate
// Authenticates the caller, deducts credits, validates URL hosts to prevent SSRF,
// then delegates to the orchestrator.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { orchestrate, type GenerateKind } from "@/lib/orchestrator.server";
import { assertTrustedUrl } from "@/lib/url-guard";

const Schema = z.object({
  kind: z.enum(["image", "video", "lipsync", "upscale"]),
  prompt: z.string().max(2000).optional(),
  imageUrls: z.array(z.string().url()).max(6).optional(),
  audioUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  duration: z.number().int().min(3).max(12).optional(),
  resolution: z.enum(["480p", "720p", "1080p"]).optional(),
  model: z.string().max(120).optional(),
  // CLI ergonomics: `aurora video --from latest --motion orbit --seconds 10`
  from: z.enum(["latest"]).optional(),
  motion: z.enum(["orbit", "push-in", "pull-out", "pan-left", "pan-right", "tilt-up", "tilt-down", "static", "handheld"]).optional(),
  seconds: z.number().int().min(3).max(12).optional(),
  // Pluggable-backend passthrough: free-form provider params + a generic ComfyUI
  // workflow graph (+ per-node input patches) for `comfyui`-protocol workers.
  params: z.record(z.unknown()).optional(),
  comfyWorkflow: z.unknown().optional(),
  comfyInputs: z.record(z.unknown()).optional(),
});

function creditCost(kind: GenerateKind): number {
  switch (kind) {
    case "image":
      return 1;
    case "upscale":
      return 1;
    case "lipsync":
      return 3;
    case "video":
      return 5;
    case "motion":
      // Motion runs async on the job queue, never on this synchronous endpoint
      // (it is excluded from the request Schema). Present for type exhaustiveness.
      return 5;
  }
}

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
        let reservedAmount = 0;
        const reservationRef = crypto.randomUUID();
        let userId: string | null = null;
        try {
          userId = await authUserId(request);
          if (!userId) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });
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
                JSON.stringify({ ok: false, error: "No previous generation found for --from latest" }),
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

          // Reserve credits atomically (held in profiles.credits_reserved)
          const cost = creditCost(data.kind as GenerateKind);
          const rpcClient = supabaseAdmin as unknown as {
            rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
          };
          const { data: reserved, error: resErr } = await rpcClient.rpc("reserve_credits", {
            _user: userId,
            _amount: cost,
            _reason: `public_generate_${data.kind}`,
            _ref: reservationRef,
          });
          if (resErr) throw new Error(resErr.message);
          if (!reserved) {
            return new Response(JSON.stringify({ error: "Insufficient credits" }), { status: 402, headers: cors });
          }
          reservedAmount = cost;

          const result = await orchestrate({
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
            userId,
          });

          // Audit trail
          await supabaseAdmin.from("generations").insert({
            user_id: userId,
            prompt: data.prompt ?? "",
            kind: data.kind,
            mode: "performance",
            status: "succeeded",
            input_images: data.imageUrls ?? [],
            audio_url: data.audioUrl ?? null,
            model: result.provider,
            result_image_url: data.kind === "image" ? result.url : null,
            result_video_url: data.kind === "video" || data.kind === "lipsync" ? result.url : null,
            credits_cost: cost,
          });

          // Commit reservation now that the job succeeded
          await rpcClient.rpc("commit_reservation", {
            _user: userId,
            _amount: reservedAmount,
            _reason: `public_generate_${data.kind}`,
            _ref: reservationRef,
          });
          reservedAmount = 0;

          return new Response(
            JSON.stringify({
              ok: true,
              url: result.url,
              provider: result.provider,
              endpoint: result.endpoint,
              latencyMs: result.latencyMs,
              estimatedCostUsd: result.costUsd,
            }),
            { status: 200, headers: cors },
          );
        } catch (e) {
          // Release reservation on failure
          if (reservedAmount > 0 && userId) {
            const rpcClient = supabaseAdmin as unknown as {
              rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
            };
            await rpcClient.rpc("release_reservation", {
              _user: userId,
              _amount: reservedAmount,
              _reason: "release_public_generate",
              _ref: reservationRef,
            });
          }
          const msg = e instanceof Error ? e.message : "Unknown error";
          return new Response(JSON.stringify({ ok: false, error: msg }), { status: 400, headers: cors });
        }
      },
    },
  },
});
