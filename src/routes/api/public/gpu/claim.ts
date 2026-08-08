// POST /api/public/gpu/claim
// GPU workers call this to claim the next queued render_job.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  worker_id: z.string().uuid(),
  models: z.array(z.string().max(80)).max(20).default([]),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const Route = createFileRoute("/api/public/gpu/claim")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: "Invalid body" }, { status: 400, headers: cors });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as unknown as { from: (t: string) => any };

        // Update heartbeat
        await db.from("gpu_workers")
          .update({ last_seen_at: new Date().toISOString(), status: "online" })
          .eq("id", parsed.data.worker_id);

        // Claim the oldest queued job matching this worker's models
        const { data: jobs } = await db.from("render_jobs")
          .select("*")
          .eq("status", "queued")
          .in("model", parsed.data.models.length ? parsed.data.models : ["*"])
          .order("created_at", { ascending: true })
          .limit(10);

        const job = (jobs ?? []).find((j: { model: string }) =>
          !parsed.data.models.length || parsed.data.models.includes(j.model)
        );
        if (!job) {
          return Response.json({ job: null }, { headers: cors });
        }

        const { data: claimed } = await db.from("render_jobs")
          .update({ status: "running", worker_id: parsed.data.worker_id, updated_at: new Date().toISOString() })
          .eq("id", job.id)
          .eq("status", "queued") // CAS
          .select()
          .single();

        return Response.json({ job: claimed ?? null }, { headers: cors });
      },
    },
  },
});
