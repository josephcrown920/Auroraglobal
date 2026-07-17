// GET  /api/video-agent/messages  — returns last 60 messages for the user (oldest first)
// DELETE /api/video-agent/messages — wipes the user's full conversation history
import { createFileRoute } from "@tanstack/react-router";

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

export const Route = createFileRoute("/api/video-agent/messages")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }),

      GET: async ({ request }) => {
        const userId = await authUserId(request);
        if (!userId)
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("video_agent_messages")
          .select("id, role, content, metadata, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(60);

        if (error)
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });

        return new Response(JSON.stringify({ messages: data ?? [] }), { headers: CORS });
      },

      DELETE: async ({ request }) => {
        const userId = await authUserId(request);
        if (!userId)
          return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("video_agent_messages")
          .delete()
          .eq("user_id", userId);

        if (error)
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS });

        return new Response(JSON.stringify({ ok: true }), { headers: CORS });
      },
    },
  },
});
