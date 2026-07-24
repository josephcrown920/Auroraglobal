import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { probeWorkerHealth } from "@/lib/gpu-worker-health";
import {
  isFreeGpuOnlyMode,
  setFreeGpuOnlyMode,
  freeGpuOnlyEnvDefault,
} from "@/lib/app-settings.server";
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
    // Recent register-endpoint calls (success AND failure) — surfaces *why* a
    // Kaggle/Colab/Vast worker never showed up as a gpu_workers row (bad
    // AURORA_REGISTER_SECRET, invalid payload, DB error) instead of the attempt
    // just vanishing with nothing to look at but a notebook log.
    const { data: registerAttempts } = await (supabaseAdmin as any)
      .from("worker_register_attempts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(15);
    // Never ship the per-worker auth_token (RunPod API key / bearer) to the client;
    // expose only whether one is set so the admin UI can show "configured".
    const workers = (data ?? []).map(({ auth_token, ...w }) => ({ ...w, has_auth_token: !!auth_token }));
    return { workers, jobs: jobs ?? [], registerAttempts: registerAttempts ?? [] };
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
    const probePatch = {
      last_probe_at: new Date().toISOString(),
      last_probe_ok: result.ok,
      last_probe_detail: result.detail ?? null,
      last_probe_error: result.error ?? null,
    };
    // Network error / timeout: no response received — record the probe but
    // don't flip the stored status (we can't tell active vs paused from a
    // transient blip).
    if (result.unreachable) {
      await supabaseAdmin.from("gpu_workers").update(probePatch).eq("id", w.id);
      return { ok: false, error: result.error, latency_ms };
    }
    await supabaseAdmin.from("gpu_workers").update({
      ...probePatch,
      last_heartbeat: new Date().toISOString(),
      status: result.ok ? "active" : "paused",
      // A manual ping that flips a worker to paused is still the sweep's
      // criteria firing early, not an admin action — tag it "auto" like the
      // background sweep does. Coming back online clears it.
      paused_reason: result.ok ? null : "auto",
    }).eq("id", w.id);
    return { ok: result.ok, status: result.status, detail: result.detail, error: result.error, latency_ms };
  });

// Pause / resume / drain a worker WITHOUT touching any other column. Using
// upsertWorker for this would round-trip the whole row and (because listWorkers
// strips auth_token) wipe the stored bearer token — so status changes get their
// own minimal server fn.
export const setWorkerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["active", "paused", "draining"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    // Minimal status-only update (NOT upsertWorker) so we never overwrite the
    // worker's auth_token, which listWorkers strips and would otherwise blank out.
    // This is always an explicit admin action, so tag/clear paused_reason
    // accordingly — it's how the dashboard tells "admin paused this" apart
    // from "the health sweep auto-paused this".
    const { count, error } = await supabaseAdmin
      .from("gpu_workers")
      .update({
        status: data.status,
        paused_reason: data.status === "active" ? null : "admin",
      }, { count: "exact" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (!count) throw new Error(`Worker ${data.id} not found`);
    return { ok: true, id: data.id, status: data.status };
  });

// "Free GPU only" global safety mode — read the current value (with the env
// default surfaced so the admin UI can show where the default comes from).
export const getFreeGpuMode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return { enabled: await isFreeGpuOnlyMode(), envDefault: freeGpuOnlyEnvDefault() };
  });

// Toggle the global "Free GPU only" mode. When ON, the orchestrator never calls a
// paid provider for any modality.
export const setFreeGpuMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await setFreeGpuOnlyMode(data.enabled);
    return { ok: true, enabled: data.enabled };
  });

// ── Pending-approval helpers ──────────────────────────────────────────────────
// Community workers land in 'pending_approval' on first self-registration. These
// two functions let the owner approve or reject them from the admin dashboard
// without going through the full upsertWorker form (which would wipe auth_token).

export const approveWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { count, error } = await supabaseAdmin
      .from("gpu_workers")
      .update({ status: "active", paused_reason: null })
      .eq("id", data.id)
      .eq("status", "pending_approval"); // safety: only approve pending workers
    if (error) throw new Error(error.message);
    if (!count) throw new Error(`Worker ${data.id} not found or already approved`);
    return { ok: true, id: data.id, status: "active" };
  });

export const rejectWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { count, error } = await supabaseAdmin
      .from("gpu_workers")
      .update({ status: "paused", paused_reason: "admin" })
      .eq("id", data.id)
      .eq("status", "pending_approval"); // safety: only reject pending workers
    if (error) throw new Error(error.message);
    if (!count) throw new Error(`Worker ${data.id} not found or already reviewed`);
    return { ok: true, id: data.id, status: "paused" };
  });

/** Public (non-admin) check: is there at least one live worker for a given capability? */
export const checkWorkerCapability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ capability: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const STALE_MS = 5 * 60_000;
    const now = Date.now();
    const { data: workers } = await supabaseAdmin
      .from("gpu_workers")
      .select("in_flight, max_concurrency, last_heartbeat, capabilities")
      .eq("status", "active")
      .contains("capabilities", [data.capability]);
    const available = (workers ?? []).some((w) => {
      if ((w.in_flight ?? 0) >= (w.max_concurrency ?? 1)) return false;
      if (w.last_heartbeat && now - new Date(w.last_heartbeat).getTime() > STALE_MS) return false;
      return true;
    });
    return { available };
  });
