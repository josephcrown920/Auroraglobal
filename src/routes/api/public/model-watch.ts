/**
 * /api/public/model-watch
 *
 * Cron-called endpoint (same auth as the other public cron routes — anon key
 * or CRON_SECRET via `apikey` header). Scans provider catalogs for newly
 * released AI models, probes anticipated ModelArk slugs, records everything
 * in `model_watch`, and emails the operator when something genuinely new
 * appears. See src/lib/model-watch.server.ts for the scan logic.
 */

import { createFileRoute } from "@tanstack/react-router";
import { authorizeCron } from "@/lib/cron-auth";
import { runModelWatchScan } from "@/lib/model-watch.server";

export const Route = createFileRoute("/api/public/model-watch")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorizeCron(request)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const result = await runModelWatchScan();
          console.log(
            "[model-watch]",
            JSON.stringify({
              scanned: result.scanned,
              seeded: result.seeded,
              new: result.new_models.length,
              transitions: result.transitions.length,
              email_sent: result.email_sent,
              provider_errors: result.provider_errors,
            }),
          );
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[model-watch] scan failed:", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
