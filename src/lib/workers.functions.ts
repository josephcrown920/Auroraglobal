import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { probeWorkerHealth } from "@/lib/gpu-worker-health";
import { z } from "zod";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const listWorkers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin.from("gpu_workers").select("*").order("priority");
    const { data: jobs } = await supabaseAdmin.from("worker_jobs").select("*").order("created_at", { ascending: false }).limit(50);
    // Never ship the per-worker auth_token (RunPod API key / bearer) to the client;
    // expose only whether one is set so the admin UI can show "configured".
    const workers = (data ?? []).map(({ auth_token, ...w }) => ({ ...w, has_auth_token: !!auth_token }));
    return { workers, jobs: jobs ?? [] };
  });

export const upsertWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(100),
    endpoint_url: z.string().url(),
    auth_token: z.string().optional().nullable(),
    region: z.string().default("global"),
    capabilities: z.array(z.string()).default(["image"]),
    models: z.array(z.string()).default([]),
    priority: z.number().int().default(100),
    max_concurrency: z.number().int().min(1).max(64).default(4),
    status: z.enum(["active", "paused", "draining"]).default("active"),
    // Wire protocol the worker speaks. Defaults to the legacy flat POST /generate
    // (`custom`); `vast` shares that contract. `runpod`/`comfyui`/`hfspace` change
    // HOW the worker is called — routing stays capability-based (see orchestrator).
    protocol: z.enum(["custom", "runpod", "comfyui", "hfspace", "vast"]).default("custom"),
    worker_role: z.enum(["comfyui", "kling", "lipsync", "motion", ""]).optional().nullable().transform(v => v || null),
    runpod_sync: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { id, ...patch } = data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabaseAdmin.from("gpu_workers").update(patch as any).eq("id", id);
      return { id };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row } = await supabaseAdmin.from("gpu_workers").insert(data as any).select("id").single();
    return { id: row?.id };
  });

export const deleteWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("gpu_workers").delete().eq("id", data.id);
    return { ok: true };
  });

export const pingWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: w } = await supabaseAdmin.from("gpu_workers").select("*").eq("id", data.id).single();
    if (!w) throw new Error("Not found");
    const started = Date.now();
    const result = await probeWorkerHealth(w);
    const latency_ms = Date.now() - started;
    // Network error / timeout: no response received — report without flipping
    // the stored status (we can't tell active vs paused from a transient blip).
    if (result.unreachable) {
      return { ok: false, error: result.error, latency_ms };
    }
    await supabaseAdmin.from("gpu_workers").update({
      last_heartbeat: new Date().toISOString(),
      status: result.ok ? "active" : "paused",
    }).eq("id", w.id);
    return { ok: result.ok, status: result.status, detail: result.detail, error: result.error, latency_ms };
  });
