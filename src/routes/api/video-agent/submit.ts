// POST /api/video-agent/submit
// Async-first HeyGen Video Agent submit: reserves credits immediately, submits
// to HeyGen, and returns the video_id right away so the frontend can poll
// /api/video-agent/status/:videoId without blocking the HTTP connection.
// The reservationRef must be forwarded to /api/video-agent/finalize once
// polling confirms the video is completed.
import { createFileRoute } from "@tanstack/react-router";
import type { UntypedDb } from "@/integrations/supabase/untyped";
import { z } from "zod";
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit.server";
import { safeErrorMessage } from "@/lib/safe-error.server";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

// Abuse guard: each call reserves credits AND submits to HeyGen, so cap raw
// request rate independent of balance (mirrors /api/public/generate).
const VIDEO_AGENT_SUBMIT_RATE_WINDOW_MS = 60_000;
const VIDEO_AGENT_SUBMIT_RATE_MAX_PER_WINDOW = 15;

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

const SubmitSchema = z.object({
  prompt: z.string().min(3).max(4000),
  orientation: z.enum(["landscape", "portrait"]).optional(),
});

export const Route = createFileRoute("/api/video-agent/submit")({
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
        try {
          assertRateLimit(`video-agent-submit:${userId}`, VIDEO_AGENT_SUBMIT_RATE_MAX_PER_WINDOW, VIDEO_AGENT_SUBMIT_RATE_WINDOW_MS);
        } catch (e) {
          if (e instanceof RateLimitError) {
            return new Response(JSON.stringify({ error: e.message }), { status: 429, headers: CORS });
          }
          throw e;
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS });
        }

        const parsed = SubmitSchema.safeParse(body);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: parsed.error.message }), { status: 400, headers: CORS });
        }
        const { prompt, orientation = "landscape" } = parsed.data;

        const heygenKey = process.env.HEYGEN_API_KEY;
        if (!heygenKey) {
          return new Response(JSON.stringify({ error: "HEYGEN_API_KEY not configured" }), { status: 503, headers: CORS });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { computeCost } = await import("@/lib/pricing");
        const VIDEO_AGENT_COST = computeCost({ features: ["video"], model: "heygen/video-agent" }).total;

        // Reserve credits before submitting to HeyGen — if HeyGen submit fails
        // we release them immediately; if it succeeds the ref is forwarded to
        // /finalize so finalize_sync_render can commit them.
        const reservationRef = crypto.randomUUID();
        const { data: reserved, error: resErr } = await (supabaseAdmin as unknown as { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc("reserve_credits", {
          _user: userId,
          _amount: VIDEO_AGENT_COST,
          _reason: "heygen_video_agent",
          _ref: reservationRef,
        });
        if (resErr) {
          return new Response(
            JSON.stringify({ ok: false, error: safeErrorMessage("video-agent/submit:reserve-credits", resErr) }),
            { status: 500, headers: CORS },
          );
        }
        if (!reserved) {
          return new Response(JSON.stringify({ ok: false, error: "Insufficient credits", insufficient: true }), { status: 402, headers: CORS });
        }

        // Submit to HeyGen — no polling, just get video_id.
        let videoId: string;
        try {
          // Resolve default avatar/voice.
          const avatarsRes = await fetch("https://api.heygen.com/v2/avatars?page=1&limit=1", {
            headers: { "X-Api-Key": heygenKey },
          });
          const avatarsJson = avatarsRes.ok ? await avatarsRes.json() : null;
          const pick = avatarsJson?.data?.avatars?.[0];
          const avatarId: string = pick?.avatar_id ?? "Angela-inTshirt-20220820";
          const voiceId: string = pick?.default_voice_id ?? "1bd001e7e50f421d891986aad5158bc8";

          const dimension = orientation === "portrait" ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
          const createRes = await fetch("https://api.heygen.com/v2/video/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Api-Key": heygenKey },
            body: JSON.stringify({
              title: "Aurora Video Agent",
              video_inputs: [
                {
                  character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
                  voice: { type: "text", input_text: prompt, voice_id: voiceId },
                },
              ],
              dimension,
            }),
          });
          const cj: unknown = await createRes.json();
          videoId = (cj as { data?: { video_id?: string } })?.data?.video_id ?? "";
          if (!videoId) {
            throw new Error(`HeyGen submit returned no video_id: ${JSON.stringify(cj).slice(0, 200)}`);
          }
        } catch (e) {
          // Release reserved credits since submit failed.
          await (supabaseAdmin as unknown as { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc("release_reservation", {
            _user: userId,
            _amount: VIDEO_AGENT_COST,
            _reason: "release_heygen_video_agent",
            _ref: reservationRef,
          });
          const rawMsg = e instanceof Error ? e.message : String(e);
          const heygenCredit = /\b(402|insufficient.?credit|credit.?exhausted|40102)\b/i.test(rawMsg);
          const msg = safeErrorMessage("video-agent/submit:heygen-submit", e);
          return new Response(JSON.stringify({ ok: false, error: msg, heygenCredit }), { status: 502, headers: CORS });
        }

        // Persist the submission so /status and /finalize can authorize by
        // ownership and use server-recorded prompt/cost/reservation instead of
        // trusting the client. If this insert fails we release the reservation
        // and fail loudly — an untracked videoId could never be finalized and
        // would strand the user's credits.
        const { error: subErr } = await (supabaseAdmin as unknown as UntypedDb)
          .from("video_agent_submissions")
          .insert({
            video_id: videoId,
            user_id: userId,
            reservation_ref: reservationRef,
            prompt,
            orientation,
            cost: VIDEO_AGENT_COST,
          });
        if (subErr) {
          await (supabaseAdmin as unknown as { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc("release_reservation", {
            _user: userId,
            _amount: VIDEO_AGENT_COST,
            _reason: "release_heygen_video_agent",
            _ref: reservationRef,
          });
          return new Response(
            JSON.stringify({ ok: false, error: safeErrorMessage("video-agent/submit:record-submission", subErr) }),
            { status: 500, headers: CORS },
          );
        }

        return new Response(
          JSON.stringify({ ok: true, videoId, reservationRef, cost: VIDEO_AGENT_COST }),
          { headers: CORS },
        );
      },
    },
  },
});
