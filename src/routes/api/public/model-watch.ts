/**
 * /api/public/model-watch
 *
 * Cron-called endpoint (server-only CRON_SECRET via `apikey` header). Scans provider catalogs for newly
 * released AI models, probes anticipated ModelArk slugs, records everything
 * in `model_watch`, and emails the operator when something genuinely new
 * appears. See src/lib/model-watch.server.ts for the scan logic.
 */

import { createFileRoute } from "@tanstack/react-router";
import { authorizeCronStrict } from "@/lib/cron-auth";
import { safeErrorMessage } from "@/lib/safe-error.server";
import { runModelWatchScan } from "@/lib/model-watch.server";

export const Route = createFileRoute("/api/public/model-watch")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!authorizeCronStrict(request)) {
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
          return new Response(JSON.stringify({ ok: false, error: safeErrorMessage("model-watch", err) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
