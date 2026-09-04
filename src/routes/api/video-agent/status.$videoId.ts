// GET /api/video-agent/status/:videoId
// Polls HeyGen's v2 videos API and returns a normalised status payload.
// Bearer token auth. CORS-open for the standalone Video Agent SPA.
import { createFileRoute } from "@tanstack/react-router";
import type { UntypedDb } from "@/integrations/supabase/untyped";
import { safeErrorMessage } from "@/lib/safe-error.server";

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

export const Route = createFileRoute("/api/video-agent/status/$videoId")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }),
      GET: async ({ request, params }) => {
        const userId = await authUserId(request);
        if (!userId) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
        }
        const { videoId } = params;
        if (!videoId) {
          return new Response(JSON.stringify({ error: "Missing videoId" }), { status: 400, headers: CORS });
        }

        // Ownership: only the user who submitted this video may poll it — the
        // HeyGen key is account-global, so without this check any authenticated
        // caller could read another user's video URL by guessing/leaking an id.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: submission } = await (supabaseAdmin as unknown as UntypedDb)
          .from("video_agent_submissions")
          .select("video_id")
          .eq("video_id", videoId)
          .eq("user_id", userId)
          .maybeSingle();
        if (!submission) {
          return new Response(JSON.stringify({ error: "Unknown video" }), { status: 404, headers: CORS });
        }

        const heygenKey = process.env.HEYGEN_API_KEY;
        if (!heygenKey) {
          return new Response(JSON.stringify({ error: "HEYGEN_API_KEY not configured" }), { status: 503, headers: CORS });
        }
        try {
          // v2 API — consistent with the video/generate v2 submit endpoint.
          const res = await fetch(`https://api.heygen.com/v2/videos/${encodeURIComponent(videoId)}`, {
            headers: { "X-Api-Key": heygenKey },
            signal: AbortSignal.timeout(20_000),
          });
          if (!res.ok) {
            return new Response(
              JSON.stringify({ status: "error", error: `HeyGen ${res.status}` }),
              { status: res.status, headers: CORS },
            );
          }
          const json: unknown = await res.json();
          const data = (json as { data?: { status?: string; video_url?: string; error?: { message?: string } } })?.data;
          const status = data?.status ?? "unknown";
          const url = data?.video_url ?? null;
          const errorMsg = data?.error?.message ?? null;
          return new Response(JSON.stringify({ status, url, error: errorMsg }), { headers: CORS });
        } catch (e) {
          return new Response(
            JSON.stringify({ status: "error", error: safeErrorMessage("video-agent/status:heygen-poll", e) }),
            { status: 500, headers: CORS },
          );
        }
      },
    },
  },
});
