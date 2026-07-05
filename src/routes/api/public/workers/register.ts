// Worker self-registration endpoint — POST /api/public/workers/register
// Lets a self-hosted GPU worker (e.g. the Colab/Kaggle notebook) upsert its own
// row in gpu_workers on boot, so a restart never needs a manual Admin → Workers
// edit. Authenticated via a dedicated, private AURORA_REGISTER_SECRET sent as the
// `apikey` header — deliberately NOT the Supabase anon/publishable key, because
// that key ships to every browser. Once image/video jobs route to this swarm
// first, a worker that registers is handed real job inputs (including signed
// links to private user media), so registration must require a secret only the
// operator holds, never the same key every visitor already has.

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

// Best-effort audit log of every register attempt (success AND failure) so a
// bad AURORA_REGISTER_SECRET, invalid payload, or DB error shows up in Admin ->
// Workers as a *reason*, instead of the attempt just vanishing with nothing to
// look at but a Kaggle/Colab notebook log the owner may never check. Logging
// itself must never fail the request — this is diagnostics, not the contract.
async function logAttempt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  fields: { name?: string | null; endpoint_url?: string | null; protocol?: string | null; ok: boolean; error?: string | null; outcome?: string | null },
) {
  try {
    await supabaseAdmin.from("worker_register_attempts").insert({
      name: fields.name ?? null,
      endpoint_url: fields.endpoint_url ?? null,
      protocol: fields.protocol ?? null,
      ok: fields.ok,
      error: fields.error ?? null,
      outcome: fields.outcome ?? null,
    });
  } catch {
    // Never let attempt-logging break registration itself.
  }
}

export const Route = createFileRoute("/api/public/workers/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const apikey =
          request.headers.get("apikey") ||
          request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
        // Deliberately gated on a private operator secret, not the Supabase
        // anon/publishable key — that key is shipped to every browser and would
        // let anyone who knows the Aurora URL register an arbitrary "worker" and
        // start receiving real job inputs. If the operator hasn't set the secret
        // yet, fail closed (never fall back to the public key).
        const expected = process.env.AURORA_REGISTER_SECRET;
        if (!expected) {
          await logAttempt(supabaseAdmin, { ok: false, error: "Registration disabled: AURORA_REGISTER_SECRET is not configured" });
          return json({ error: "Registration disabled" }, 503);
        }
        if (apikey !== expected) {
          await logAttempt(supabaseAdmin, { ok: false, error: "Unauthorized (apikey mismatch or missing)" });
          return json({ error: "Unauthorized" }, 401);
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          await logAttempt(supabaseAdmin, { ok: false, error: "Invalid JSON body" });
          return json({ error: "Invalid JSON body" }, 400);
        }

        let data: z.infer<typeof Schema>;
        try {
          data = Schema.parse(raw);
        } catch (e) {
          const msg =
            e instanceof z.ZodError ? e.issues.map((i) => i.message).join(", ") : "Invalid payload";
          const r = raw as Record<string, unknown> | null;
          await logAttempt(supabaseAdmin, {
            name: typeof r?.name === "string" ? r.name : null,
            endpoint_url: typeof r?.endpoint_url === "string" ? r.endpoint_url : null,
            protocol: typeof r?.protocol === "string" ? r.protocol : null,
            ok: false,
            error: msg,
          });
          return json({ error: msg }, 400);
        }

        // Dedup on the *normalized* endpoint so registering the bare origin or the
        // full …/generate URL — and the admin form vs auto-register — never create
        // duplicate rows for the same worker. (See normalizeWorkerBase.)
        const base = normalizeWorkerBase(data.endpoint_url);
        const { data: existing, error: listErr } = await supabaseAdmin
          .from("gpu_workers")
          .select("id, endpoint_url");
        if (listErr) {
          await logAttempt(supabaseAdmin, { name: data.name, endpoint_url: data.endpoint_url, protocol: data.protocol, ok: false, error: listErr.message });
          return json({ error: listErr.message }, 500);
        }
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
          if (error) {
            await logAttempt(supabaseAdmin, { name: data.name, endpoint_url: data.endpoint_url, protocol: data.protocol, ok: false, error: error.message });
            return json({ error: error.message }, 500);
          }
          await logAttempt(supabaseAdmin, { name: data.name, endpoint_url: data.endpoint_url, protocol: data.protocol, ok: true, outcome: "updated" });
          return json({ ok: true, id: match.id, updated: true });
        }

        const { data: row, error } = await supabaseAdmin
          .from("gpu_workers")
          .insert(patch)
          .select("id")
          .single();
        if (error) {
          await logAttempt(supabaseAdmin, { name: data.name, endpoint_url: data.endpoint_url, protocol: data.protocol, ok: false, error: error.message });
          return json({ error: error.message }, 500);
        }
        await logAttempt(supabaseAdmin, { name: data.name, endpoint_url: data.endpoint_url, protocol: data.protocol, ok: true, outcome: "created" });
        return json({ ok: true, id: row?.id, created: true });
      },
    },
  },
});
