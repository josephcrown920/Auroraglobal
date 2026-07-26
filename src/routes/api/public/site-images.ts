import { createFileRoute } from "@tanstack/react-router";
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
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
        return new Response(JSON.stringify(data ?? []), { headers: { "Content-Type": "application/json" } });
      },
    },
  },
  component: () => null,
});
