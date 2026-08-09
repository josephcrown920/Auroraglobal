// ComfyUI run + template server functions.
//
// Templates (`comfy_workflows`) hold a reusable ComfyUI /prompt graph plus a
// declared-input schema; runs (`comfy_runs`) record each execution. Running a
// template enqueues a background job through the shared atomic reserve RPC
// (create_generation_and_reserve) — the jobs/tick worker renders the graph and
// updates the comfy_runs row on finish (payload.comfyRunId), so the run
// survives the user closing the tab. A run is gated on an active
// comfyui-protocol worker existing for the template's kind, so it fails
// explicitly instead of silently falling back to an external provider that
// would ignore the graph.
//
// All access is service-role (bypasses RLS) and scoped manually by the
// authenticated context.userId — same pattern as the other *.functions.ts.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { type GenerateKind } from "./orchestrator.server";
import { assertTrustedUrl } from "./url-guard";
import { detectFeatures, computeCost, type Feature } from "./pricing";
import {
  validateDeclaredInputs,
  validateInputValues,
  validateWorkflowJson,
  buildComfyInputs,
  pickComfyWorkers,
  type DeclaredInput,
  type ComfyWorkerLite,
} from "./comfy-core";
import {
  hasStudio,
  getStudioBase,
  getStudioStatus,
  getStudioWorkflows,
  submitStudioJob,
  refreshStudioJob,
  getStudioJob,
  type StudioJob,
} from "./comfy-studio.server";

// The generated Supabase types don't include `comfy_workflows`/`comfy_runs` yet
// (added by migration, types regenerate later). Use a loose-typed handle, same as
// src/lib/mcp/avatars.server.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
type LooseTable = {
  select: (cols?: string) => any;
  insert: (row: Record<string, unknown> | Record<string, unknown>[]) => any;
  update: (patch: Record<string, unknown>) => any;
  delete: () => any;
};
function db(): { from: (table: string) => LooseTable } {
  return supabaseAdmin as unknown as { from: (table: string) => LooseTable };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function isAdminUser(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

/** Best-effort label for the recorded generation: first non-empty text input. */
function pickPromptText(declared: DeclaredInput[], values: Record<string, unknown>): string | undefined {
  for (const d of declared) {
    if (d.type === "text" && typeof values[d.key] === "string" && (values[d.key] as string).trim()) {
      return values[d.key] as string;
    }
  }
  return undefined;
}

// ─── Templates ────────────────────────────────────────────────────────────────

export const listComfyTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { data, error } = await db()
      .from("comfy_workflows")
      .select(
        "id,owner_user_id,name,description,kind,declared_inputs,default_inputs,is_public,created_by_admin,updated_at",
      )
      .or(`owner_user_id.eq.${userId},is_public.eq.true`)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const templates = ((data ?? []) as Array<Record<string, unknown>>).map((t) => ({
      ...t,
      mine: t.owner_user_id === userId,
    }));
    return { templates };
  });

export const getComfyTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const { data: tpl, error } = await db()
      .from("comfy_workflows")
      .select("*")
      .eq("id", data.id)
      .or(`owner_user_id.eq.${userId},is_public.eq.true`)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tpl) throw new Error("Workflow not found");
    return { template: { ...tpl, mine: tpl.owner_user_id === userId } };
  });

export const saveComfyTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        description: z.string().max(2000).optional().nullable(),
        kind: z.enum(["image", "video"]).default("image"),
        workflowJson: z.unknown(),
        declaredInputs: z.array(z.record(z.unknown())).default([]),
        defaultInputs: z.record(z.unknown()).default({}),
        isPublic: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const wf = validateWorkflowJson(data.workflowJson);
    if (!wf.ok) throw new Error(wf.error);
    const di = validateDeclaredInputs(data.declaredInputs);
    if (!di.ok) throw new Error(`Invalid inputs: ${di.errors.join("; ")}`);

    const isAdmin = await isAdminUser(userId);
    // Only admins can publish a template to everyone.
    const wantPublic = data.isPublic && isAdmin;
    const patch: Record<string, unknown> = {
      name: data.name,
      description: data.description ?? null,
      kind: data.kind,
      workflow_json: data.workflowJson,
      declared_inputs: data.declaredInputs,
      default_inputs: data.defaultInputs,
      is_public: wantPublic,
      created_by_admin: wantPublic,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      let q = db().from("comfy_workflows").update(patch).eq("id", data.id);
      if (!isAdmin) q = q.eq("owner_user_id", userId); // non-admins can only edit their own
      const { error } = await q;
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await db()
      .from("comfy_workflows")
      .insert({ ...patch, owner_user_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteComfyTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const isAdmin = await isAdminUser(userId);
    let q = db().from("comfy_workflows").delete().eq("id", data.id);
    if (!isAdmin) q = q.eq("owner_user_id", userId);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Runs ───────────────────────────────────────────────────────────────────

export const startComfyRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        workflowId: z.string().uuid(),
        values: z.record(z.unknown()).default({}),
        source: z.enum(["run", "admin", "canvas"]).default("run"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const { data: tpl, error: tErr } = await db()
      .from("comfy_workflows")
      .select("*")
      .eq("id", data.workflowId)
      .or(`owner_user_id.eq.${userId},is_public.eq.true`)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!tpl) throw new Error("Workflow not found");

    const declared = Array.isArray(tpl.declared_inputs) ? (tpl.declared_inputs as DeclaredInput[]) : [];
    const wfCheck = validateWorkflowJson(tpl.workflow_json);
    if (!wfCheck.ok) throw new Error(wfCheck.error);

    const v = validateInputValues(declared, data.values as Record<string, unknown>);
    if (!v.ok) throw new Error(v.errors.join("; "));
    // SSRF guard for any image-URL inputs before they reach a worker.
    for (const d2 of declared) {
      if (d2.type === "image" && typeof v.values[d2.key] === "string") {
        assertTrustedUrl(v.values[d2.key] as string);
      }
    }
    const comfyInputs = buildComfyInputs(declared, v.values, (tpl.default_inputs ?? {}) as Record<string, unknown>);
    const kind: GenerateKind = tpl.kind === "video" ? "video" : "image";

    // Gate on an active comfyui worker for this kind so the run can't silently
    // fall back to an external provider that would ignore the workflow graph.
    const { data: workers } = await db()
      .from("gpu_workers")
      .select("id,name,protocol,status,capabilities,worker_role");
    const capable = pickComfyWorkers((workers ?? []) as ComfyWorkerLite[], kind === "video" ? "video" : "image");
    const noWorkerMsg =
      "No active ComfyUI worker is available for this kind. Register and activate one in Admin → Workers (protocol: ComfyUI).";

    const { data: runRow, error: rErr } = await db()
      .from("comfy_runs")
      .insert({
        user_id: userId,
        workflow_id: tpl.id,
        status: capable.length ? "running" : "failed",
        progress_pct: capable.length ? 50 : 0,
        input_values: v.values,
        source: data.source,
        ...(capable.length ? {} : { error: noWorkerMsg }),
      })
      .select("*")
      .single();
    if (rErr) throw new Error(rErr.message);
    if (!capable.length) {
      return { ok: false as const, run: runRow, error: noWorkerMsg };
    }

    const { features } = detectFeatures({ kind: kind as Feature });
    const cost = computeCost({ features }).total;
    const promptText = pickPromptText(declared, v.values);

    // Enqueue-only (task #273): reserve credits + create the generations/jobs
    // rows atomically, then return immediately. The jobs/tick worker renders
    // the graph in the background (survives the tab closing); it updates this
    // comfy_runs row on finish via payload.comfyRunId, and the client polls
    // getComfyRun until the row goes terminal.
    try {
      const client = db() as unknown as {
        rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      const { data: reserved, error: resErr } = await client.rpc("create_generation_and_reserve", {
        _user: userId,
        _kind: kind,
        _prompt: promptText,
        _amount: cost,
        _payload: {
          kind,
          prompt: promptText,
          comfyWorkflow: tpl.workflow_json,
          comfyInputs,
          comfyRunId: runRow.id,
        },
      });
      if (resErr) {
        const insufficient = /insufficient_credits/i.test(resErr.message);
        const msg = insufficient ? "Not enough Aura. Buy more from the Aura panel." : resErr.message;
        await db()
          .from("comfy_runs")
          .update({ status: "failed", error: msg, updated_at: new Date().toISOString() })
          .eq("id", runRow.id);
        return {
          ok: false as const,
          run: { ...runRow, status: "failed", error: msg },
          error: msg,
          insufficient,
        };
      }
      const row = (Array.isArray(reserved) ? reserved[0] : reserved) as {
        job_id: string;
        generation_id: string;
      };
      const { data: queuedRun } = await db()
        .from("comfy_runs")
        .update({ generation_id: row.generation_id, updated_at: new Date().toISOString() })
        .eq("id", runRow.id)
        .select("*")
        .single();
      return {
        ok: true as const,
        queued: true as const,
        run: queuedRun ?? runRow,
        jobId: row.job_id,
        generationId: row.generation_id,
        creditsCost: cost,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Run failed";
      await db()
        .from("comfy_runs")
        .update({ status: "failed", error: msg, updated_at: new Date().toISOString() })
        .eq("id", runRow.id);
      return { ok: false as const, run: { ...runRow, status: "failed", error: msg }, error: msg };
    }
  });

export const getComfyRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: run, error } = await db()
      .from("comfy_runs")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!run) throw new Error("Run not found");
    return { run };
  });

export const listComfyRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await db()
      .from("comfy_runs")
      .select("id,workflow_id,status,progress_pct,output_url,output_kind,error,source,created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    return { runs: data ?? [] };
  });

// ─── Admin + reachability ─────────────────────────────────────────────────────

export const adminListComfyRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdminUser(context.userId))) throw new Error("Forbidden");
    const { data, error } = await db()
      .from("comfy_runs")
      .select("id,user_id,workflow_id,status,progress_pct,output_url,output_kind,error,source,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { runs: data ?? [] };
  });

/**
 * Reachability probe for the embedded editor / live ws.
 *
 * Returns ONLY booleans + an explicitly-public operator-configured editor URL —
 * never a worker's `endpoint_url` or `auth_token`. The browser cannot reach a
 * private GPU host, so an embedded ComfyUI editor is only offered when an
 * operator has deliberately published a browser-reachable URL via
 * `COMFYUI_EDITOR_URL`.
 */
export const comfyReachability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data: workers } = await db()
      .from("gpu_workers")
      .select("id,name,protocol,status,capabilities,worker_role");
    const comfyWorkers = pickComfyWorkers((workers ?? []) as ComfyWorkerLite[]);
    const editorUrl = (process.env.COMFYUI_EDITOR_URL ?? "").trim();
    const editorAllowed = /^https:\/\//i.test(editorUrl);
    return {
      serverHasWorker: comfyWorkers.length > 0,
      workerCount: comfyWorkers.length,
      editorAllowed,
      editorUrl: editorAllowed ? editorUrl : null,
    };
  });

// ─── ComfyUI Studio (external REST service) ───────────────────────────────────
//
// The user's own ComfyUI Studio is a separate service (a Replit project) that
// proxies / orchestrates a ComfyUI server. Aurora talks to it over plain HTTP
// via COMFY_STUDIO_URL. These functions sit alongside the gpu_workers path and
// are ONLY active when COMFY_STUDIO_URL is configured.

/**
 * Health + workflow list from the Studio service. Returns { configured: false }
 * when COMFY_STUDIO_URL is not set, so the UI can gracefully hide the section.
 */
export const comfyStudioStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    if (!hasStudio()) return { configured: false as const };
    try {
      const [status, workflows] = await Promise.all([
        getStudioStatus(),
        getStudioWorkflows(),
      ]);
      return { configured: true as const, status, workflows, studioUrl: getStudioBase() };
    } catch (e) {
      return {
        configured: true as const,
        error: e instanceof Error ? e.message : "Studio unreachable",
        status: null,
        workflows: [],
        studioUrl: getStudioBase(),
      };
    }
  });

/**
 * Submit a job to the Studio service and record it in comfy_runs with
 * source='studio' and the Studio job ID in external_run_id.
 */
export const startStudioRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        workflowId: z.string().min(1),
        params: z.record(z.unknown()).default({}),
        workflowName: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    if (!hasStudio()) throw new Error("ComfyUI Studio is not configured (set COMFY_STUDIO_URL)");

    // Create the run row first so the user sees it immediately in Recent runs.
    const { data: runRow, error: rErr } = await db()
      .from("comfy_runs")
      .insert({
        user_id: userId,
        status: "running",
        progress_pct: 10,
        input_values: data.params,
        source: "studio",
      })
      .select("*")
      .single();
    if (rErr) throw new Error(rErr.message);

    // Submit to the Studio.
    let job: StudioJob;
    try {
      job = await submitStudioJob(data.workflowId, data.params);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Studio submission failed";
      await db()
        .from("comfy_runs")
        .update({ status: "failed", error: msg, updated_at: new Date().toISOString() })
        .eq("id", runRow.id);
      return { ok: false as const, run: { ...runRow, status: "failed", error: msg }, error: msg };
    }

    // Store the Studio job ID so pollStudioRun can refresh it.
    const { data: updatedRun } = await db()
      .from("comfy_runs")
      .update({ external_run_id: job.id, updated_at: new Date().toISOString() })
      .eq("id", runRow.id)
      .select("*")
      .single();

    return { ok: true as const, run: updatedRun ?? runRow, studioJobId: job.id };
  });

/**
 * Refresh a Studio run: calls POST /api/jobs/{id}/refresh on the Studio, reads
 * the updated status, and writes it back to comfy_runs. Returns the updated row.
 * Client should call this every ~5 s while run.status === 'running'.
 */
export const pollStudioRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const { data: run, error } = await db()
      .from("comfy_runs")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!run) throw new Error("Run not found");

    const externalId = run.external_run_id as string | null;
    if (!externalId) throw new Error("Not a Studio run (no external_run_id)");

    // Already terminal — skip the network round-trip.
    if (run.status === "succeeded" || run.status === "failed") return { run };

    // Ask Studio to re-poll ComfyUI, then read the canonical status.
    let job: StudioJob;
    try {
      job = await refreshStudioJob(externalId);
    } catch {
      // refresh failed — fall back to a plain GET so we don't lose status.
      try {
        job = await getStudioJob(externalId);
      } catch {
        // Network error — leave run as-is and let the client retry.
        return { run };
      }
    }

    let newStatus = run.status as string;
    let outputUrl: string | undefined;
    let outputKind: string | undefined;
    let errorMsg: string | undefined;

    if (job.status === "completed") {
      newStatus = "succeeded";
      const first = job.outputs?.[0];
      if (first) {
        outputUrl = `${getStudioBase()}${first.comfyUrl}`;
        outputKind = /video/i.test(first.type ?? "") ? "video" : "image";
      }
    } else if (job.status === "failed") {
      newStatus = "failed";
      errorMsg = job.error ?? "Studio job failed";
    } else if (job.status === "pending" || job.status === "running") {
      newStatus = "running";
    }

    const patch: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...(outputUrl ? { output_url: outputUrl, output_kind: outputKind } : {}),
      ...(errorMsg ? { error: errorMsg } : {}),
    };

    const { data: updated } = await db()
      .from("comfy_runs")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();

    return { run: updated ?? { ...run, ...patch } };
  });
