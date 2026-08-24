import { createFileRoute } from "@tanstack/react-router";
import { safeErrorMessage } from "@/lib/safe-error.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/site-images")({
  server: {
    handlers: {
      GET: async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- site_images not yet in generated types.ts; cast until next type regen
        const { data, error } = await (supabaseAdmin as any)
          .from("site_images")
          .select("key, url")
          .order("key");
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
