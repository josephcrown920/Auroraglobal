import { createFileRoute } from "@tanstack/react-router";
import { safeErrorMessage } from "@/lib/safe-error.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/site-images")({
  server: {
    handlers: {
      GET: async () => {
        let data: Array<{ key: string; url: string }> | null = null;
        let error: { code?: string; message: string } | null = null;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- site_images not yet in generated types.ts; cast until next type regen
          ({ data, error } = await (supabaseAdmin as any)
            .from("site_images")
            .select("key, url")
            .order("key"));
        } catch (caught) {
          // The server-only key is not needed for public bundled images.
          // Keep development pages usable without weakening production errors.
          if (!import.meta.env.PROD && caught instanceof Error && /Missing Supabase environment variable/i.test(caught.message)) {
            return new Response("[]", { headers: { "Content-Type": "application/json" } });
          }
          throw caught;
        }
        // This endpoint is an optional override layer. Some environments may
        // not have received the site_images migration yet; in that case the
        // landing page must keep using its bundled defaults instead of
        // surfacing a runtime 500. Preserve real database failures so they
        // remain observable and actionable.
        if (error) {
          const missingTable = error.code === "PGRST205" || /could not find the table ['"]?public\.site_images/i.test(error.message);
          if (missingTable) {
            return new Response("[]", { headers: { "Content-Type": "application/json" } });
          }
          return new Response(JSON.stringify({ error: safeErrorMessage("site-images", error.message) }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify(data ?? []), { headers: { "Content-Type": "application/json" } });
      },
    },
  },
  component: () => null,
});
