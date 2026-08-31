import { createFileRoute } from "@tanstack/react-router";
import { safeErrorMessage } from "@/lib/safe-error.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/site-copy")({
  server: {
    handlers: {
      GET: async () => {
        let data: Array<{ key: string; value: string }> | null = null;
        let error: { code?: string; message: string } | null = null;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- site_copy not yet in generated types.ts
          ({ data, error } = await (supabaseAdmin as any)
            .from("site_copy")
            .select("key, value")
            .order("key"));
        } catch (caught) {
          // The server-only key is not needed to render the public preview.
          // Keep the bundled copy available in development, while production
          // still surfaces a real configuration failure.
          if (!import.meta.env.PROD && caught instanceof Error && /Missing Supabase environment variable/i.test(caught.message)) {
            return new Response("[]", { headers: { "Content-Type": "application/json" } });
          }
          throw caught;
        }
        // Graceful fallback: if the migration hasn't run yet, return an empty
        // array so the UI renders its hardcoded defaults without a 500.
        if (error) {
          const missingTable =
            error.code === "PGRST205" ||
            /could not find the table ['"]?public\.site_copy/i.test(error.message);
          if (missingTable) {
            return new Response("[]", {
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ error: safeErrorMessage("site-copy", error.message) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(data ?? []), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
  component: () => null,
});
