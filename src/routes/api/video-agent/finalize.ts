// POST /api/video-agent/finalize
// Called by the Video Agent frontend once polling confirms the video is
// completed. Commits the credit reservation and writes the generation record
// in a single Postgres transaction (finalize_sync_render).
// Body: { videoId, url, prompt, reservationRef, cost, orientation }
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

const FinalizeSchema = z.object({
  videoId: z.string().min(1),
  url: z.string().url(),
  prompt: z.string().min(1).max(4000),
  reservationRef: z.string().uuid(),
  cost: z.number().int().positive(),
});

export const Route = createFileRoute("/api/video-agent/finalize")({
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
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
        }

        let body: unknown;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
        }

        const parsed = FinalizeSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.message }), { status: 400, headers: CORS });
        }
        const { url, prompt, reservationRef, cost } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const rpc = (supabaseAdmin as unknown as { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc.bind(supabaseAdmin);

        const { data: genId, error: finalizeErr } = await rpc("finalize_sync_render", {
          _user_id: userId,
          _prompt: prompt,
          _kind: "video",
          _mode: "performance",
          _input_images: [],
          _audio_url: null,
          _model: "heygen/video-agent",
          _result_image_url: null,
          _result_video_url: url,
          _result_text: null,
          _credits_cost: cost,
          _session_id: null,
          _agent_shot_id: null,
          _amount: cost,
          _reason: "heygen_video_agent",
          _ref: reservationRef,
        });

        if (finalizeErr) {
          // Finalize failed — try to release the reservation so credits aren't stranded.
          await rpc("release_reservation", {
            _user: userId,
            _amount: cost,
            _reason: "release_heygen_finalize_failed",
            _ref: reservationRef,
          });
          return new Response(
            JSON.stringify({ ok: false, error: `Failed to commit credits: ${finalizeErr.message}` }),
            { status: 500, headers: CORS },
          );
        }

        return new Response(
          JSON.stringify({ ok: true, generationId: genId as string }),
          { headers: CORS },
        );
      },
    },
  },
});
