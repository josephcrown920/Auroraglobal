import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateWithFallback } from "@/lib/llm-fallback.server";
import {
  PlanSchema,
  DIRECTOR_SYSTEM,
  buildDirectorPrompt,
  buildRefNote,
  type AgentPlan,
  type PlanIteration,
} from "@/lib/agent.schema";
import { refinePlan } from "@/lib/agent-loop.server";
import type { Json } from "@/integrations/supabase/types";

// Re-export shared types so existing consumers (e.g. AuroraAgentPanel) keep
// importing them from this module.
export type { AgentPlan, AgentShot, Critique, CritiqueIssue, PlanIteration } from "@/lib/agent.schema";

/** Translate raw provider failures into explicit, user-facing messages (no silent fallback). */
function mapLlmError(err: unknown): Error {
  const message = err instanceof Error ? err.message : "Agent failed";
  if (message.includes("No LLM provider"))
    return new Error(
      "No AI model is configured for planning. Add an LLM provider key (Lovable, Gemini, OpenAI, OpenRouter, or HuggingFace).",
    );
  if (message.includes("429")) return new Error("Aurora Agent is rate-limited. Try again in a moment.");
  if (message.includes("402")) return new Error("Out of AI credits. Add credits in workspace settings.");
  return new Error(message);
}

// ─── Single-shot planner (public, unchanged behaviour) ───────────────────────
export const runAuroraAgent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        brief: z.string().min(4).max(4000),
        referenceImages: z.array(z.string().url()).max(8).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    try {
      const { output } = await generateWithFallback({
        system: DIRECTOR_SYSTEM,
        prompt: buildDirectorPrompt(data.brief, buildRefNote(data.referenceImages)),
        schema: PlanSchema,
      });
      return output as AgentPlan;
    } catch (err) {
      throw mapLlmError(err);
    }
  });

// ─── Director → Critic refinement + session persistence (authed) ─────────────
export const refineAuroraPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        brief: z.string().min(4).max(4000),
        referenceImages: z.array(z.string().url()).max(8).optional(),
        sessionId: z.string().uuid().optional(),
        title: z.string().max(120).optional(),
        threshold: z.number().int().min(50).max(100).optional(),
        maxIterations: z.number().int().min(1).max(5).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let result;
    try {
      result = await refinePlan({
        brief: data.brief,
        referenceImages: data.referenceImages,
        threshold: data.threshold,
        maxIterations: data.maxIterations,
      });
    } catch (err) {
      throw mapLlmError(err);
    }

    const row = {
      user_id: context.userId,
      title: data.title ?? result.plan.title,
      brief: data.brief,
      plan: result.plan as unknown as Json,
      iterations: result.iterations as unknown as Json,
      status: "ready",
      updated_at: new Date().toISOString(),
    };

    let sessionId = data.sessionId;
    if (sessionId) {
      const { data: upd, error } = await context.supabase
        .from("agent_sessions")
        .update(row)
        .eq("id", sessionId)
        .eq("user_id", context.userId)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (!upd) throw new Error("Session not found");
      sessionId = upd.id;
    } else {
      const { data: ins, error } = await context.supabase
        .from("agent_sessions")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      sessionId = ins.id;
    }

    return {
      sessionId,
      plan: result.plan,
      iterations: result.iterations,
      finalScore: result.finalScore,
      stopReason: result.stopReason,
    };
  });

export const listAgentSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("agent_sessions")
      .select("id, title, brief, status, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getAgentSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: session, error } = await context.supabase
      .from("agent_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error("Session not found");

    // Per-shot render state is relational: generations linked by session_id + agent_shot_id.
    // Querying it here (rather than trusting nested JSON) keeps status correct even
    // when several shots are rendered concurrently.
    const { data: gens, error: gerr } = await context.supabase
      .from("generations")
      .select("agent_shot_id, status, result_image_url, created_at")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: false });
    if (gerr) throw new Error(gerr.message);

    const renders: Record<string, { status: string; url: string | null }> = {};
    for (const g of gens ?? []) {
      const sid = g.agent_shot_id;
      if (!sid || renders[sid]) continue; // rows are newest-first → keep the latest per shot
      renders[sid] = { status: g.status, url: g.result_image_url };
    }

    return {
      session: {
        id: session.id,
        title: session.title,
        brief: session.brief,
        status: session.status,
        plan: session.plan as unknown as AgentPlan,
        iterations: (session.iterations as unknown as PlanIteration[]) ?? [],
        created_at: session.created_at,
        updated_at: session.updated_at,
      },
      renders,
    };
  });

export const deleteAgentSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sessionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("agent_sessions")
      .delete()
      .eq("id", data.sessionId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ─── Render one approved shot through the EXISTING pipeline (orchestrate) ─────
export const renderAgentShot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        shotId: z.string().min(1).max(40),
        model: z.string().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Load the OWNED session and read the shot prompt from STORED state — never
    // trust a client-supplied prompt (IDOR / prompt-injection hardening). RLS on
    // context.supabase already scopes this to the caller's own rows.
    const { data: session, error } = await context.supabase
      .from("agent_sessions")
      .select("id, plan")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error("Session not found");

    const plan = session.plan as unknown as AgentPlan | null;
    const shot = plan?.shots?.find((s) => s.id === data.shotId);
    if (!shot) throw new Error(`Shot ${data.shotId} is not part of this plan`);
    if (!shot.prompt?.trim()) throw new Error(`Shot ${data.shotId} has no prompt to render`);

    const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");
    let outcome;
    try {
      outcome = await reserveOrchestrateRecord({
        userId: context.userId,
        kind: "image",
        prompt: shot.prompt,
        model: data.model,
        cost: 1,
        reason: "agent_shot_render",
        sessionId: data.sessionId,
        agentShotId: shot.id,
      });
    } catch (err) {
      // orchestrate throws explicit errors when no provider can serve the request.
      const message = err instanceof Error ? err.message : "Render failed";
      throw new Error(message);
    }
    if (!outcome.ok) throw new Error(outcome.error);

    return {
      shotId: shot.id,
      status: "succeeded" as const,
      url: outcome.url,
      provider: outcome.provider,
      generationId: outcome.generationId,
    };
  });
