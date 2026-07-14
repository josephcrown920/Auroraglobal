// POST /api/ugc-line/variations
// Standalone-accessible REST wrapper around generateSceneVariationPrompts.
// Bearer token auth. CORS-open for the standalone artifacts/ugc-line SPA.
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
  direction: z.string().min(1).max(400),
  count: z.number().int().min(1).max(30).default(6),
  inputType: z.enum(["person", "product"]),
  productName: z.string().max(120).optional(),
});

export const Route = createFileRoute("/api/ugc-line/variations")({
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

          const { generateSceneVariationPrompts } = await import("@/lib/ugc-line.functions");
          const result = await (generateSceneVariationPrompts as unknown as (opts: { data: typeof data }) => Promise<{ prompts: string[] }>)({ data });
          return new Response(JSON.stringify(result), { headers: CORS });
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ error }), { status: 500, headers: CORS });
        }
      },
    },
  },
});
