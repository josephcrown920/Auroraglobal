import type { z } from "zod";
import { routedGenerate, type RoutedGenerateArgs, type RoutedResult } from "./ai-router";
import {
  CINEMATIC_ANALYSIS_PROMPT,
  CINEMATIC_SYSTEM_PROMPT,
  PlannerRouterSchema,
  PlannerVideoPlanSchema,
  type VideoPlan,
} from "./video-agent-skills";
import { NATIVE_SEEDANCE_25 } from "./byteplus-video-contract";
import { createPlanReceipt } from "./video-plan-receipt.server";

export type CinematicPlanningRequest =
  | { mode: "full"; userIdea: string; format?: "16:9" | "9:16" | "1:1" | "2.39:1" }
  | { mode: "revision"; revisionRequest: string; previousPlan: VideoPlan };

type Generate = <T>(args: RoutedGenerateArgs<T>) => Promise<RoutedResult<T>>;

function deterministicWarnings(plan: VideoPlan): NonNullable<VideoPlan["warnings"]> {
  const warnings: NonNullable<VideoPlan["warnings"]> = [];
  const shots = plan.shots ?? [];
  const ids = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const shot of shots) {
    if (ids.has(shot.id)) duplicateIds.add(shot.id);
    ids.add(shot.id);
  }
  for (const id of [...duplicateIds].sort()) {
    warnings.push({
      code: "continuity",
      message: `Duplicate shot id "${id}" makes continuity references ambiguous.`,
      related_shot_ids: [id],
    });
  }

  for (const shot of shots) {
    if (shot.chain_from && !ids.has(shot.chain_from)) {
      warnings.push({
        code: "continuity",
        message: `Shot "${shot.id}" chains from unknown shot "${shot.chain_from}".`,
        related_shot_ids: [shot.id],
      });
    }
  }

  const byId = new Map(shots.map((shot) => [shot.id, shot]));
  const cycleMembers = new Set<string>();
  for (const shot of shots) {
    const path: string[] = [];
    const positions = new Map<string, number>();
    let current: typeof shot | undefined = shot;
    while (current?.chain_from && byId.has(current.chain_from)) {
      positions.set(current.id, path.length);
      path.push(current.id);
      const nextId = current.chain_from;
      const cycleStart = positions.get(nextId);
      if (cycleStart !== undefined) {
        for (const id of path.slice(cycleStart)) cycleMembers.add(id);
        break;
      }
      current = byId.get(nextId);
    }
  }
  if (cycleMembers.size) {
    const related = [...cycleMembers].sort();
    warnings.push({
      code: "continuity",
      message: `Shot chaining contains a cycle: ${related.join(", ")}.`,
      related_shot_ids: related,
    });
  }

  const beatIds = new Set(plan.screenplay?.beats.map((beat) => beat.id) ?? []);
  const duplicateBeatIds = new Set<string>();
  const seenBeatIds = new Set<string>();
  for (const beat of plan.screenplay?.beats ?? []) {
    if (seenBeatIds.has(beat.id)) duplicateBeatIds.add(beat.id);
    seenBeatIds.add(beat.id);
  }
  for (const beatId of [...duplicateBeatIds].sort()) {
    warnings.push({
      code: "continuity",
      message: `Duplicate screenplay beat id "${beatId}" makes shot references ambiguous.`,
    });
  }
  for (const shot of shots) {
    if (shot.screenplay_beat_id && !beatIds.has(shot.screenplay_beat_id)) {
      warnings.push({
        code: "continuity",
        message: `Shot "${shot.id}" references unknown screenplay beat "${shot.screenplay_beat_id}".`,
        related_shot_ids: [shot.id],
      });
    }
  }
  return warnings;
}

export function applyDeterministicPlanValidation(plan: VideoPlan): VideoPlan {
  const generated = deterministicWarnings(plan);
  const warnings = [...(plan.warnings ?? [])];
  const existing = new Set(warnings.map((warning) => `${warning.code}:${warning.message}`));
  for (const warning of generated) {
    if (!existing.has(`${warning.code}:${warning.message}`)) warnings.push(warning);
  }
  return { ...plan, ...(warnings.length ? { warnings } : {}) };
}

function plannerPrompt(request: CinematicPlanningRequest): string {
  if (request.mode === "revision") {
    const { receipt: _receipt, ...unsignedPreviousPlan } = request.previousPlan;
    return `Revise the existing plan only as requested. Preserve every unaffected story fact and exact supplied line. Do not silently resolve contradictions: record them in warnings.

Revision request:
${request.revisionRequest}

Existing plan:
${JSON.stringify(unsignedPreviousPlan)}

Return only the complete revised VideoPlan JSON with all structured stages. Do not include provenance.`;
  }

  const formatHint = request.format ? ` Preferred format: ${request.format}.` : "";
  return `User request: ${request.userIdea}${formatHint}

Create a complete plan with brief, screenplay, continuity ledger, direction, 4–8 shots, render plan, warnings, and stage statuses. Use ${NATIVE_SEEDANCE_25} as the default native render model, 720p resolution, and 4–8 seconds per shot. Preserve the requested story; warn instead of silently rewriting it. Return only valid VideoPlan JSON. Do not include provenance or receipt.`;
}

/**
 * Free cinematic planner. The router owns the bounded ModelArk-primary /
 * OpenRouter-free fallback chain; serving metadata is copied from the router
 * result, never accepted from model output.
 */
export async function planCinematicVideo(
  request: CinematicPlanningRequest,
  userId: string,
  generate: Generate = routedGenerate,
): Promise<VideoPlan> {
  const routed = await generate<z.infer<typeof PlannerRouterSchema>>({
    system: `${CINEMATIC_SYSTEM_PROMPT}\n\n${CINEMATIC_ANALYSIS_PROMPT}`,
    prompt: plannerPrompt(request),
    schema: PlannerRouterSchema,
    category: "VIDEO_DIRECTION",
    routingMode: "modelark-free",
    providerTimeoutMs: 55_000,
    routerTimeoutMs: 120_000,
    maxAttemptsPerProvider: 1,
    maxOutputTokens: 8_000,
    validateOutput: (output) =>
      PlannerVideoPlanSchema.parse(output) as z.infer<typeof PlannerRouterSchema>,
  });
  // Keep this defensive parse even though routedGenerate validates its output:
  // test seams and future router implementations must not bypass completeness.
  const validated = PlannerVideoPlanSchema.parse(routed.output);

  const plan = applyDeterministicPlanValidation({
    ...validated,
    provenance: {
      provider: routed.provider,
      model: routed.model,
      category: "VIDEO_DIRECTION",
      fallback_count: routed.fallbackCount,
      latency_ms: routed.latencyMs,
      planning_mode: request.mode,
      schema_version: "2",
      generated_at: new Date().toISOString(),
    },
  });
  return { ...plan, receipt: createPlanReceipt(plan, userId) };
}