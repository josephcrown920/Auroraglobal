// Worker self-registration endpoint — POST /api/public/workers/register
// Lets a self-hosted GPU worker (e.g. the Colab/Kaggle notebook) upsert its own
// row in gpu_workers on boot, so a restart never needs a manual Admin → Workers
// edit. Authenticated via the Supabase anon/publishable `apikey` header — the same
// pattern as /api/public/workers/health and /api/public/jobs/tick — so the worker
// only needs the public anon key, never a Supabase service-role key.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { normalizeWorkerBase } from "@/lib/gpu-worker-health";
import type { Database } from "@/integrations/supabase/types";

type WorkerInsert = Database["public"]["Tables"]["gpu_workers"]["Insert"];

const Schema = z.object({
  name: z.string().min(1).max(100),
  endpoint_url: z.string().url(),
  // Wire protocol the worker speaks. Self-hosted notebooks serve the flat
  // POST /generate contract → "custom" (default). Mirrors upsertWorker.
  protocol: z.enum(["custom", "runpod", "comfyui", "hfspace", "vast"]).default("custom"),
  capabilities: z.array(z.string()).min(1).default(["lipsync", "motion"]),
  // The worker's own /generate bearer (optional). Stored so the dispatcher can
  // authenticate to it. Only overwrites an existing token when provided.
  auth_token: z.string().optional().nullable(),
  max_concurrency: z.number().int().min(1).max(64).optional(),
  region: z.string().optional(),
  // Queue lanes this worker is willing to serve. Omitted → keep the DB default
  // (both lanes), so legacy notebooks keep serving everything.
  lanes: z.array(z.enum(["standard", "heavy"])).min(1).optional(),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/workers/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ||
          request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!expected || apikey !== expected) {
          return json({ error: "Unauthorized" }, 401);
        }

        let data: z.infer<typeof Schema>;
        try {
          data = Schema.parse(await request.json());
        } catch (e) {
          const msg =
            e instanceof z.ZodError ? e.issues.map((i) => i.message).join(", ") : "Invalid payload";
          return json({ error: msg }, 400);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Dedup on the *normalized* endpoint so registering the bare origin or the
        // full …/generate URL — and the admin form vs auto-register — never create
        // duplicate rows for the same worker. (See normalizeWorkerBase.)
        const base = normalizeWorkerBase(data.endpoint_url);
        const { data: existing, error: listErr } = await supabaseAdmin
          .from("gpu_workers")
          .select("id, endpoint_url");
        if (listErr) return json({ error: listErr.message }, 500);
        const match = (existing ?? []).find((w) => normalizeWorkerBase(w.endpoint_url) === base);

        // A freshly-booted worker announcing itself is, by definition, up: set it
        // active and stamp the heartbeat so dispatch routes to it immediately.
        const patch: WorkerInsert = {
          name: data.name,
          endpoint_url: data.endpoint_url,
          protocol: data.protocol,
          capabilities: data.capabilities,
          status: "active",
          last_heartbeat: new Date().toISOString(),
        };
        if (data.auth_token != null) patch.auth_token = data.auth_token;
        if (data.max_concurrency != null) patch.max_concurrency = data.max_concurrency;
        if (data.region != null) patch.region = data.region;
        // `lanes` postdates the generated Database types (migration 20260702120000).
        if (data.lanes) (patch as WorkerInsert & { lanes?: string[] }).lanes = [...data.lanes];

        if (match) {
          const { error } = await supabaseAdmin
            .from("gpu_workers")
            .update(patch)
            .eq("id", match.id);
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true, id: match.id, updated: true });
        }

        const { data: row, error } = await supabaseAdmin
          .from("gpu_workers")
          .insert(patch)
          .select("id")
          .single();
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, id: row?.id, created: true });
      },
    },
  },
});
