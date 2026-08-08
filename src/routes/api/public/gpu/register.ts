// POST /api/public/gpu/register
// GPU worker self-registration for the Directors Board render fleet.
// Workers call this on startup to announce themselves; returns their row id.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  name: z.string().min(1).max(120),
  gpu: z.string().max(200).optional(),
  models: z.array(z.string().max(80)).max(20).default([]),
  worker_id: z.string().uuid().optional(),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const Route = createFileRoute("/api/public/gpu/register")({
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
        const row = {
          name: parsed.data.name,
          gpu: parsed.data.gpu ?? null,
          models: parsed.data.models,
          status: "online",
          last_seen_at: new Date().toISOString(),
        };
        const q = parsed.data.worker_id
          ? db.from("gpu_workers")
              .update(row)
              .eq("id", parsed.data.worker_id)
              .select()
              .single()
          : db.from("gpu_workers")
              .insert(row)
              .select()
              .single();
        const { data, error } = await q;
        if (error) {
          return Response.json({ error: error.message }, { status: 500, headers: cors });
        }
        return Response.json({ ok: true, worker_id: (data as { id: string }).id }, { headers: cors });
      },
    },
  },
});
