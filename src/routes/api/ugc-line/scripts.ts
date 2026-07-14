// POST /api/ugc-line/scripts
// Standalone-accessible REST wrapper around generateUgcScriptArc.
// Bearer token auth (Supabase JWT or aurk_ CLI key). CORS-open for the
// standalone artifacts/ugc-line SPA.
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

const InputSchema = z.object({
  product: z.string().min(1).max(600),
  audience: z.string().min(1).max(300),
  niche: z.string().min(1).max(80),
  angles: z.array(z.string()).min(1).max(10),
  length: z.enum(["15s", "30s", "45s"]).default("30s"),
  count: z.number().int().min(1).max(15).default(6),
});

export const Route = createFileRoute("/api/ugc-line/scripts")({
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
          const data = InputSchema.parse(body);

          const { generateUgcScriptArc } = await import("@/lib/ugc-line.functions");
          const result = await (generateUgcScriptArc as unknown as (opts: { data: typeof data }) => Promise<{ briefs: unknown[] }>)({ data });
          return new Response(JSON.stringify(result), { headers: CORS });
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ error }), { status: 500, headers: CORS });
        }
      },
    },
  },
});
