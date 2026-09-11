import { createFileRoute } from "@tanstack/react-router";

async function authenticatedUserId(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(header.slice(7));
  return error ? null : (data.user?.id ?? null);
}

export const Route = createFileRoute("/api/balance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await authenticatedUserId(request);
        if (!userId) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("profiles")
          .select("credits, credits_reserved")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) return Response.json({ error: "Balance unavailable" }, { status: 503 });
        if (!data) return Response.json({ error: "Profile not found" }, { status: 404 });
        return Response.json({
          credits: data.credits,
          creditsReserved: data.credits_reserved,
          creditsAvailable: Math.max(0, data.credits - data.credits_reserved),
        });
      },
    },
  },
});