import { createFileRoute } from "@tanstack/react-router";
import { getMasterStatus, isLandrConfigured } from "@/lib/landr-mastering.server";

export const Route = createFileRoute("/api/audio/master/$id/status")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { id } = params;

        if (!isLandrConfigured()) {
          return new Response(
            JSON.stringify({ error: "LANDR_MASTERING_API_KEY is not configured" }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          const result = await getMasterStatus(id);
          return new Response(JSON.stringify(result), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Status check failed";
          return new Response(JSON.stringify({ error: msg }), {
            status: 502,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
