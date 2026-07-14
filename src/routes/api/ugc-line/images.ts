// POST /api/ugc-line/images
// Standalone-accessible REST wrapper around generateSceneImagesFromRef.
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
  referenceBase64: z.string().min(1),
  referenceMimeType: z.string().min(1),
  prompts: z.array(z.string().min(1)).min(1).max(30),
  aspectRatio: z.string().default("4:5"),
});

export const Route = createFileRoute("/api/ugc-line/images")({
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

          const { generateSceneImagesFromRef } = await import("@/lib/ugc-line.functions");
          const result = await (generateSceneImagesFromRef as unknown as (opts: { data: typeof data }) => Promise<{ results: unknown[] }>)({ data });
          return new Response(JSON.stringify(result), { headers: CORS });
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ error }), { status: 500, headers: CORS });
        }
      },
    },
  },
});
