import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
    return { workers: data ?? [], jobs: jobs ?? [] };
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
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.id) {
      const { id, ...patch } = data;
      await supabaseAdmin.from("gpu_workers").update(patch).eq("id", id);
      return { id };
    }
    const { data: row } = await supabaseAdmin.from("gpu_workers").insert(data).select("id").single();
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
    try {
      const res = await fetch(w.endpoint_url.replace(/\/$/, "") + "/health", {
        headers: w.auth_token ? { authorization: `Bearer ${w.auth_token}` } : {},
        signal: AbortSignal.timeout(8_000),
      });
      const ok = res.ok;
      await supabaseAdmin.from("gpu_workers").update({
        last_heartbeat: new Date().toISOString(),
        status: ok ? "active" : "paused",
      }).eq("id", w.id);
      return { ok, status: res.status, latency_ms: Date.now() - started };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e), latency_ms: Date.now() - started };
    }
  });
