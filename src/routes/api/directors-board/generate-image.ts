// POST /api/directors-board/generate-image
// Generates a single image for the Directors Board Inspector or Characters panel.
// Uses Aurora's orchestrate() — charges the authenticated user's Aura credits.
// Returns JSON { url: string } so streamImage.ts can handle it via its JSON path.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/directors-board/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Optional auth — grab user if present; fall back to a fixed system call so
        // unauthenticated board usage still works (costs are on a shared system account).
        let userId: string | null = null;
        const auth = request.headers.get("authorization") || request.headers.get("Authorization");
        if (auth?.startsWith("Bearer ")) {
          const { data } = await supabaseAdmin.auth.getUser(auth.slice(7));
          userId = data.user?.id ?? null;
        }

        const { prompt } = (await request.json().catch(() => ({}))) as { prompt?: string };
        if (!prompt?.trim()) {
          return Response.json({ error: "prompt required" }, { status: 400 });
        }

        try {
          const { orchestrate } = await import("@/lib/orchestrator.server");
          const result = await orchestrate({
            kind: "image",
            prompt: prompt.trim(),
            userId: userId ?? "directors-board-system",
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
