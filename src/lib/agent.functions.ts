import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateWithFallback } from "@/lib/llm-fallback.server";
import { routedGenerate } from "@/lib/ai-router";
import { computeCost } from "@/lib/pricing";
import { assertOwnedReferenceImage } from "@/lib/url-guard";
import {
  PlanSchema,
  DIRECTOR_SYSTEM,
  buildDirectorPrompt,
  buildRefNote,
  ChatTurnSchema,
  CHAT_DIRECTOR_SYSTEM,
  buildChatPrompt,
  buildChatPromptWithSkill,
  type AgentPlan,
  type PlanIteration,
  type AgentChatTurn,
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
const COST_VIDEO = computeCost({ features: ["video"] }).total;

type RunAgentDeps = {
  assertOwned: (url: string, userId: string) => Promise<void>;
  generate: typeof generateWithFallback;
};

// Deps-injected core (same pattern as gifts.functions.ts): the createServerFn
// handler can't run without a Start request context, so unit tests exercise
// this core directly — proving the ownership guard fires BEFORE any reference
// image is sent to the LLM provider, and that owned references pass through.
export async function runAuroraAgentCore(
  userId: string,
  data: { brief: string; referenceImages?: string[] },
  deps: RunAgentDeps = { assertOwned: assertOwnedReferenceImage, generate: generateWithFallback },
): Promise<AgentPlan> {
  // Ownership guard: reference images (sent to the LLM as creative context) must
  // belong to the caller — a crafted request could otherwise expose another user's
  // private studio asset to the LLM provider.
  for (const url of data.referenceImages ?? []) {
    await deps.assertOwned(url, userId);
  }
  try {
    const { output } = await deps.generate({
      system: DIRECTOR_SYSTEM,
      prompt: buildDirectorPrompt(data.brief, buildRefNote(data.referenceImages)),
      schema: PlanSchema,
    });
    return output as AgentPlan;
  } catch (err) {
    throw mapLlmError(err);
  }
}

// ─── Single-shot planner (public, unchanged behaviour) ───────────────────────
export const runAuroraAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        brief: z.string().min(4).max(4000),
        referenceImages: z.array(z.string().url()).max(8).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => runAuroraAgentCore(context.userId, data));

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
    // Ownership guard: reference images used for LLM planning context must belong
    // to the authenticated caller — prevent exposure of private studio assets to
    // the LLM provider via a crafted referenceImages array.
    for (const url of data.referenceImages ?? []) {
      await assertOwnedReferenceImage(url, context.userId);
    }
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

// ─── Conversational Video Agent: persistent chat + permanent memory ──────────

export type SkillMeta = {
  name: string;
  icon: string;
  label: string;
  summary: string;
  durationMs: number;
};

export type AgentChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  plan: AgentPlan | null;
  skillMeta: SkillMeta | null;
  created_at: string;
};

const CHAT_CONTEXT_MESSAGES = 20;
const CHAT_CONTEXT_CHARS = 1000;

export const chatWithAuroraAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ message: z.string().min(1).max(4000), cinematicMode: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Load permanent memory + recent transcript (RLS scopes both to the caller).
    const [{ data: memRow }, { data: recent, error: histErr }] = await Promise.all([
      context.supabase
        .from("agent_user_memory")
        .select("memory, structured_memory")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("agent_chat_messages")
        .select("role, content")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(CHAT_CONTEXT_MESSAGES),
    ]);
    if (histErr) throw new Error(histErr.message);

    const freeText = memRow?.memory ?? "";
    const structured = (memRow?.structured_memory as Record<string, unknown> | null) ?? null;
    const structuredBlock =
      structured && Object.keys(structured).length > 0
        ? `\n\nSTRUCTURED BRAND PROFILE (auto-recalled):\n${JSON.stringify(structured, null, 2)}`
        : "";
    const memory = (freeText + structuredBlock).trim();
    const transcript = (recent ?? [])
      .reverse()
      .map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content.length > CHAT_CONTEXT_CHARS ? `${m.content.slice(0, CHAT_CONTEXT_CHARS)}…` : m.content,
      }));

    let turn: AgentChatTurn;
    try {
      const { output } = await routedGenerate({
        system: CHAT_DIRECTOR_SYSTEM,
        prompt: buildChatPrompt({ memory, transcript, message: data.message, cinematicMode: data.cinematicMode }),
        schema: ChatTurnSchema,
        degradedOutput: {
          reply: "Aurora is catching up right now. Your context is safe — please try again in about 30 seconds.",
          plan: null,
          memoryUpdate: null,
          skillCall: null,
        },
      });
      turn = output;
    } catch (err) {
      throw mapLlmError(err);
    }

    // ─── Skill dispatch ───────────────────────────────────────────────────────
    let skillMeta: SkillMeta | null = null;
    if (turn.skillCall) {
      const { skill, args } = turn.skillCall;
      const t0 = Date.now();
      try {
        const { dispatchSkill, SKILL_REGISTRY } = await import("@/lib/agent-skills.server");
        const skillResult = await dispatchSkill(skill, args, { userId: context.userId, supabase: context.supabase });
        const durationMs = Date.now() - t0;
        const skillInfo = SKILL_REGISTRY[skill];
        skillMeta = {
          name: skill,
          icon: skillInfo?.icon ?? "🔧",
          label: skillInfo?.label ?? skill,
          summary: skillResult.summary,
          durationMs,
        };
        if (skillResult.ok) {
          // Second LLM pass: inject skill result and compose the real reply.
          try {
            const { output: turn2 } = await routedGenerate({
              system: CHAT_DIRECTOR_SYSTEM,
              prompt: buildChatPromptWithSkill({
                memory,
                transcript,
                message: data.message,
                skillName: skill,
                skillData: skillResult.data,
                cinematicMode: data.cinematicMode,
              }),
              schema: ChatTurnSchema,
              degradedOutput: {
                reply: "Aurora is catching up right now. Your context is safe — please try again in about 30 seconds.",
                plan: null,
                memoryUpdate: null,
                skillCall: null,
              },
            });
            // Suppress further skill calls from the second pass to avoid loops.
            turn = { ...turn2, skillCall: null };
          } catch {
            // Second pass failed — keep the first-pass acknowledgment reply.
          }
        }
      } catch {
        // Skill dispatch threw — continue with the original turn.
      }
    }

    // Persist both turns server-side (never trust client-written assistant rows).
    const { error: insErr } = await context.supabase.from("agent_chat_messages").insert([
      { user_id: context.userId, role: "user", content: data.message },
      {
        user_id: context.userId,
        role: "assistant",
        content: turn.reply,
        plan: (turn.plan ?? null) as unknown as Json,
        skill_meta: (skillMeta ?? null) as unknown as Json,
      },
    ]);
    if (insErr) throw new Error(insErr.message);

    if (turn.memoryUpdate && turn.memoryUpdate.trim()) {
      const { error: memErr } = await context.supabase.from("agent_user_memory").upsert({
        user_id: context.userId,
        memory: turn.memoryUpdate.trim().slice(0, 2000),
        updated_at: new Date().toISOString(),
      });
      if (memErr) throw new Error(memErr.message);
    }

    return {
      reply: turn.reply,
      plan: turn.plan ?? null,
      memoryUpdated: !!(turn.memoryUpdate && turn.memoryUpdate.trim()),
      skillInvoked: skillMeta,
    };
  });

export const listAgentChat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: msgs, error }, { data: memRow }] = await Promise.all([
      context.supabase
        .from("agent_chat_messages")
        // skill_meta is a new column added in 20260713170000 migration.
        .select("id, role, content, plan, skill_meta, created_at")
        .eq("user_id", context.userId)
        // Newest 200, then reversed to chronological — ascending+limit would
        // pin the window to the OLDEST rows once history exceeds the cap.
        .order("created_at", { ascending: false })
        .limit(200),
      context.supabase
        .from("agent_user_memory")
        .select("memory, updated_at")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    return {
      messages: (msgs ?? [])
        .slice()
        .reverse()
        .map((m) => ({
          id: m.id,
          role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
          content: m.content,
          plan: (m.plan as unknown as AgentPlan | null) ?? null,
          skillMeta: ((m as { skill_meta?: unknown }).skill_meta as SkillMeta | null) ?? null,
          created_at: m.created_at,
        })) satisfies AgentChatMessage[],
      hasMemory: !!memRow?.memory?.trim(),
      memory: memRow?.memory ?? "",
    };
  });

/** Wipes the visible conversation but KEEPS permanent memory — that's the point of it. */
export const clearAgentChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("agent_chat_messages")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Directly saves the free-text memory document (used by the Director Memory sidebar textarea). */
export const saveAgentMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ memory: z.string().max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("agent_user_memory").upsert({
      user_id: context.userId,
      memory: data.memory.trim().slice(0, 2000),
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Explicit "forget me" — deletes the permanent memory document. */
export const deleteAgentMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("agent_user_memory")
      .delete()
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

// Turns an already-rendered shot still into a real motion clip. Looks up the
// shot's own last successful image generation (never trusts a client-supplied
// image URL — IDOR hardening) and feeds it into image-to-video ("video" kind,
// which has hosted providers, unlike "motion" which is GPU-worker-only).
export const renderAgentShotVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        shotId: z.string().min(1).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: session, error } = await context.supabase
      .from("agent_sessions")
      .select("id, plan")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error("Session not found");

    const plan = session.plan as unknown as AgentPlan | null;
    const shot = plan?.shots?.find((s) => s.id === data.shotId);
    if (!shot) throw new Error(`Shot ${data.shotId} is not part of this plan`);

    const { data: lastImage, error: imgErr } = await context.supabase
      .from("generations")
      .select("result_image_url")
      .eq("session_id", data.sessionId)
      .eq("agent_shot_id", data.shotId)
      .eq("kind", "image")
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (imgErr || !lastImage?.result_image_url) {
      throw new Error(`Render shot ${data.shotId} as an image first, then animate it`);
    }

    const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");
    let outcome;
    try {
      outcome = await reserveOrchestrateRecord({
        userId: context.userId,
        kind: "video",
        prompt: shot.camera ? `${shot.action} — camera: ${shot.camera}` : shot.action,
        imageUrls: [lastImage.result_image_url],
        cost: COST_VIDEO,
        reason: "agent_shot_animate",
        sessionId: data.sessionId,
        agentShotId: shot.id,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Animate failed";
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
