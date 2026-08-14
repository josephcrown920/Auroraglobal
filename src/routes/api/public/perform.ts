// Perform Anywhere — public enqueue endpoint for Performance Shots.
// POST /api/public/perform
//
// A bearer-token client (the mobile app) uploads a phone performance clip +
// an identity photo, and Aurora swaps the performer into a new scene/outfit
// as a music-video-grade reskin. Reuses the EXACT same enqueue core as the
// web /motion wizard (_enqueuePerformanceReskin) so guards, the
// preview-confirm gate, and pricing never drift between surfaces.
import { createFileRoute } from "@tanstack/react-router";

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

export const Route = createFileRoute("/api/public/perform")({
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
        try {
          const userId = await authUserId(request);
          if (!userId) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: cors,
            });
          }
          const body = await request.json();
          const { _enqueuePerformanceReskin, PerformanceReskinSchema, NO_MOTION_BACKEND_MSG } =
            await import("@/lib/studio.functions");
          const data = PerformanceReskinSchema.parse(body);
          try {
            const out = await _enqueuePerformanceReskin(userId, data);
            return new Response(
              JSON.stringify({
                ok: true,
                jobId: out.jobId,
                generationId: out.generationId,
                preview: out.preview,
                ...(out.preview
                  ? {
                      requiresConfirmation: true,
                      hint: "This run renders as a capped preview. Re-send with confirmPreviewId set to generationId to render full quality.",
                    }
                  : {}),
              }),
              { status: 200, headers: cors },
            );
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            if (msg === NO_MOTION_BACKEND_MSG) {
              return new Response(
                JSON.stringify({ ok: false, error: msg, code: "no_motion_backend" }),
                { status: 503, headers: cors },
              );
            }
            if (/not enough aura|insufficient/i.test(msg)) {
              return new Response(JSON.stringify({ ok: false, error: msg }), {
                status: 402,
                headers: cors,
              });
            }
            throw e;
          }
        } catch (e) {
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
