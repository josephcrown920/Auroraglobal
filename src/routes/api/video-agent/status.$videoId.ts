// GET /api/video-agent/status/:videoId
// Polls HeyGen's video_status.get API and returns the result.
// Bearer token auth. CORS-open for the standalone Video Agent SPA.
import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

const HEYGEN_API = "https://api.heygen.com";

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
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: CORS,
          });
        }
        const { videoId } = params;
        if (!videoId) {
          return new Response(JSON.stringify({ error: "Missing videoId" }), {
            status: 400,
            headers: CORS,
          });
        }
        try {
          const heygenKey = process.env.HEYGEN_API_KEY;
          if (!heygenKey) {
            return new Response(JSON.stringify({ error: "HEYGEN_API_KEY not configured" }), {
              status: 503,
              headers: CORS,
            });
          }
          const res = await fetch(
            `${HEYGEN_API}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
            { headers: { "x-api-key": heygenKey } },
          );
          const json = await res.json();
          return new Response(JSON.stringify(json), { headers: CORS });
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ error }), { status: 500, headers: CORS });
        }
      },
    },
  },
});
