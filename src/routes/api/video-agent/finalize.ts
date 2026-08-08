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

// Only videoId matters — the server-persisted submission record (written by
// /submit) is authoritative for prompt/cost/reservationRef, and the result URL
// is re-fetched from HeyGen here rather than trusted from the client. The
// legacy fields remain accepted for wire-compat with older frontends.
const FinalizeSchema = z.object({
  videoId: z.string().min(1),
  url: z.string().optional(),
  prompt: z.string().optional(),
  reservationRef: z.string().optional(),
  cost: z.number().optional(),
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
        const { videoId } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const rpc = (supabaseAdmin as unknown as { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc.bind(supabaseAdmin);

        // Server-side provenance: the submission row binds videoId → user →
        // reservation → cost. No row = not this user's video (or never
        // submitted through us) — refuse.
        const { data: submission } = await (supabaseAdmin as any)
          .from("video_agent_submissions")
          .select("video_id, reservation_ref, prompt, cost, finalized_at, generation_id")
          .eq("video_id", videoId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!submission) {
          return new Response(JSON.stringify({ ok: false, error: "Unknown video" }), { status: 404, headers: CORS });
        }
        if (submission.finalized_at) {
          // Idempotent: already committed.
          return new Response(
            JSON.stringify({ ok: true, generationId: submission.generation_id ?? null, alreadyFinalized: true }),
            { headers: CORS },
          );
        }
        const prompt: string = submission.prompt;
        const reservationRef: string = submission.reservation_ref;
        const cost: number = Number(submission.cost);

        // Verify completion with HeyGen directly — never trust a client URL.
        const heygenKey = process.env.HEYGEN_API_KEY;
        if (!heygenKey) {
          return new Response(JSON.stringify({ ok: false, error: "HEYGEN_API_KEY not configured" }), { status: 503, headers: CORS });
        }
        let url: string;
        try {
          const res = await fetch(`https://api.heygen.com/v2/videos/${encodeURIComponent(videoId)}`, {
            headers: { "X-Api-Key": heygenKey },
          });
          if (!res.ok) throw new Error(`HeyGen ${res.status}`);
          const json: unknown = await res.json();
          const d = (json as { data?: { status?: string; video_url?: string } })?.data;
          if (d?.status !== "completed" || !d.video_url) {
            return new Response(
              JSON.stringify({ ok: false, error: `Video not completed yet (status: ${d?.status ?? "unknown"})` }),
              { status: 409, headers: CORS },
            );
          }
          url = d.video_url;
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
            { status: 502, headers: CORS },
          );
        }

        // CAS the finalized flag so a concurrent double-finalize can't commit
        // the reservation twice.
        const { data: claimed } = await (supabaseAdmin as any)
          .from("video_agent_submissions")
          .update({ finalized_at: new Date().toISOString() })
          .eq("video_id", videoId)
          .eq("user_id", userId)
          .is("finalized_at", null)
          .select("video_id");
        if (!claimed || claimed.length === 0) {
          return new Response(JSON.stringify({ ok: true, alreadyFinalized: true }), { headers: CORS });
        }

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

        await (supabaseAdmin as any)
          .from("video_agent_submissions")
          .update({ generation_id: genId })
          .eq("video_id", videoId)
          .eq("user_id", userId);

        return new Response(
          JSON.stringify({ ok: true, generationId: genId as string }),
          { headers: CORS },
        );
      },
    },
  },
});
