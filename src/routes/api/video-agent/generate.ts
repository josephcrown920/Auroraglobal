// POST /api/video-agent/generate
// Standalone-accessible REST wrapper around generateHeyGenAgentVideo logic.
// Bearer token auth (Supabase JWT or aurk_ CLI key). CORS-open for the
// standalone artifacts/video-agent SPA.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

async function authUserId(req: Request): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const token = h.slice(7);
  if (token.startsWith("aurk_")) {
    const { userIdForApiKey } = await import("@/lib/cli-device.server");
    return userIdForApiKey(token);
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

const GenerateSchema = z.object({
  prompt: z.string().min(3).max(4000),
  orientation: z.enum(["landscape", "portrait"]).optional(),
});

const HEYGEN_CREDIT_RE = /\b(402|insufficient.?credit|credit.?exhausted|40102)\b/i;

export const Route = createFileRoute("/api/video-agent/generate")({
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
        const userId = await authUserId(request);
        if (!userId) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: CORS,
          });
        }
        try {
          const body = await request.json();
          const data = GenerateSchema.parse(body);

          const { computeCost } = await import("@/lib/pricing");
          const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");

          const VIDEO_AGENT_COST = computeCost({
            features: ["video"],
            model: "heygen/video-agent",
          }).total;

          const outcome = await reserveOrchestrateRecord({
            userId,
            kind: "video",
            cost: VIDEO_AGENT_COST,
            reason: "heygen_video_agent",
            prompt: data.prompt,
            model: "heygen/video-agent",
            pinnedModelOnly: true,
            ...(data.orientation ? { params: { orientation: data.orientation } } : {}),
          });

          if (!outcome.ok) {
            const isHeygenCredit = HEYGEN_CREDIT_RE.test(outcome.error ?? "");
            return new Response(
              JSON.stringify({
                ok: false,
                error: outcome.error ?? "Generation failed",
                insufficient: outcome.insufficient,
                heygenCredit: isHeygenCredit,
              }),
              { status: 402, headers: CORS },
            );
          }

          return new Response(
            JSON.stringify({ ok: true, url: outcome.url, generationId: outcome.generationId }),
            { headers: CORS },
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const isHeygenCredit = HEYGEN_CREDIT_RE.test(msg);
          return new Response(
            JSON.stringify({ ok: false, error: msg, heygenCredit: isHeygenCredit }),
            { status: 500, headers: CORS },
          );
        }
      },
    },
  },
});
