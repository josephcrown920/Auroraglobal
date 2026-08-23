// POST /api/public/gpu/complete
// Called by a GPU worker when a render_job finishes (or fails).
import { createFileRoute } from "@tanstack/react-router";
import type { UntypedDb } from "@/integrations/supabase/untyped";
import { z } from "zod";

const Body = z.object({
  job_id: z.string().uuid(),
  worker_id: z.string().uuid(),
  output_url: z.string().url().max(2000).optional(),
  error: z.string().max(2000).optional(),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const Route = createFileRoute("/api/public/gpu/complete")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Invalid body" }, { status: 400, headers: cors });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as unknown as UntypedDb;
        const failed = Boolean(parsed.data.error) || !parsed.data.output_url;
        // CAS on status="running": a job is only ever completed once. Without
        // this, a duplicate/late completion POST (e.g. a worker retrying
        // after a timed-out response whose DB write actually landed) could
        // silently overwrite an already-finalized job's outcome — flipping a
        // completed render back to failed or vice versa. Mirrors the same
        // locked_by+status CAS pattern used by the credit-charging jobs
        // pipeline's finalize path (see jobs.server.ts).
        const { data, error } = await db.from("render_jobs")
          .update({
            status: failed ? "failed" : "completed",
            output_url: parsed.data.output_url ?? null,
            error: parsed.data.error ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", parsed.data.job_id)
          .eq("worker_id", parsed.data.worker_id)
          .eq("status", "running")
          .select()
          .maybeSingle();
        if (error) {
          return Response.json({ error: error.message }, { status: 500, headers: cors });
        }
        if (!data) {
          // Already completed/failed (or never claimed by this worker) —
          // treat as a no-op success rather than a hard error so a worker's
          // retry doesn't loop or alarm on something already settled.
          return Response.json({ ok: true, job: null, alreadyFinalized: true }, { headers: cors });
        }
        return Response.json({ ok: true, job: data }, { headers: cors });
      },
    },
  },
});
