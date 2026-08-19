// POST /api/directors-board/generate-image
// Generates a single image for the Director Room Inspector or Characters panel.
// Uses the Replit-billed Gemini image adapter while charging the user's Aura.
// Returns JSON { url: string } so streamImage.ts can handle it via its JSON path.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/directors-board/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const auth = request.headers.get("authorization") || request.headers.get("Authorization");
        if (!auth?.startsWith("Bearer ")) {
          return Response.json({ error: "Sign in to generate Director Room images." }, { status: 401 });
        }
        const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(auth.slice(7));
        if (authError || !authData.user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = authData.user.id;

        const { prompt, references } = (await request.json().catch(() => ({}))) as {
          prompt?: string;
          references?: unknown;
        };
        if (!prompt?.trim()) {
          return Response.json({ error: "prompt required" }, { status: 400 });
        }
        const imageUrls = Array.isArray(references)
          ? references.filter((value): value is string => typeof value === "string").slice(0, 4)
          : [];

        try {
          const { orchestrate } = await import("@/lib/orchestrator.server");
          const result = await orchestrate({
            kind: "image",
            model: "replit/gemini-2.5-flash-image",
            pinnedModelOnly: true,
            prompt: prompt.trim(),
            imageUrls,
            userId,
          });
          const url = result.url;
          if (!url) {
            return Response.json({ error: "No image URL returned" }, { status: 502 });
          }
          return Response.json({ url });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const status = /insufficient|credit|balance/i.test(msg) ? 402 : /rate.?limit/i.test(msg) ? 429 : 502;
          return Response.json({ error: msg }, { status });
        }
      },
    },
  },
});
