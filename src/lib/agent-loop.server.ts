// Aurora Agent: two-agent DIRECTOR → CRITIC refinement loop.
//
// The director proposes a cinematic plan; the critic scores it (0-100) and
// returns structured, actionable issues; the director refines using that
// critique. The loop continues until the plan is shippable (score >= threshold
// or no blocking issues), improvement stalls, or we hit maxIterations.
//
// `refinePlan` takes injectable `deps` so the loop is unit-testable WITHOUT real
// LLM calls. The default deps call generateWithFallback, which throws explicitly
// ("No LLM provider keys configured") when no provider is available — no silent
// fallback.
import { generateWithFallback } from "@/lib/llm-fallback.server";
import {
  PlanSchema,
  CritiqueSchema,
  DIRECTOR_SYSTEM,
  CRITIC_SYSTEM,
  buildDirectorPrompt,
  buildCritiquePrompt,
  buildRefinePrompt,
  buildRefNote,
  type AgentPlan,
  type Critique,
  type PlanIteration,
} from "@/lib/agent.schema";

export type RefineDeps = {
  propose: (brief: string, refNote: string) => Promise<AgentPlan>;
  critique: (brief: string, plan: AgentPlan) => Promise<Critique>;
  refine: (brief: string, plan: AgentPlan, critique: Critique, refNote: string) => Promise<AgentPlan>;
};

export const defaultRefineDeps: RefineDeps = {
  async propose(brief, refNote) {
    const { output } = await generateWithFallback({
      system: DIRECTOR_SYSTEM,
      prompt: buildDirectorPrompt(brief, refNote),
      schema: PlanSchema,
    });
    return output as AgentPlan;
  },
  async critique(brief, plan) {
    const { output } = await generateWithFallback({
      system: CRITIC_SYSTEM,
      prompt: buildCritiquePrompt(brief, plan),
      schema: CritiqueSchema,
    });
    return output as Critique;
  },
  async refine(brief, plan, critique, refNote) {
    const { output } = await generateWithFallback({
      system: DIRECTOR_SYSTEM,
      prompt: buildRefinePrompt(brief, plan, critique, refNote),
      schema: PlanSchema,
    });
    return output as AgentPlan;
  },
};

export const DEFAULT_THRESHOLD = 85;
export const DEFAULT_MAX_ITERATIONS = 3;
/** Stop chasing diminishing returns once a refine round gains less than this. */
const MIN_IMPROVEMENT = 5;

export type RefineArgs = {
  brief: string;
  referenceImages?: string[];
  maxIterations?: number;
  threshold?: number;
};

export type RefineResult = {
  plan: AgentPlan;
  iterations: PlanIteration[];
  finalScore: number;
  stopReason: "threshold" | "converged" | "max_iterations";
};

export async function refinePlan(args: RefineArgs, deps: RefineDeps = defaultRefineDeps): Promise<RefineResult> {
  const threshold = args.threshold ?? DEFAULT_THRESHOLD;
  const maxIterations = Math.max(1, Math.min(5, args.maxIterations ?? DEFAULT_MAX_ITERATIONS));
  const refNote = buildRefNote(args.referenceImages);
  const shippable = (c: Critique) => c.score >= threshold || c.issues.length === 0;

  const iterations: PlanIteration[] = [];

  let plan = await deps.propose(args.brief, refNote);
  let critique = await deps.critique(args.brief, plan);
  iterations.push({ n: 1, plan, critique });

  let stopReason: RefineResult["stopReason"] = "max_iterations";

  if (shippable(critique)) {
    stopReason = "threshold";
  } else {
    for (let n = 2; n <= maxIterations; n++) {
      const prevScore = critique.score;
      plan = await deps.refine(args.brief, plan, critique, refNote);
      critique = await deps.critique(args.brief, plan);
      iterations.push({ n, plan, critique });

      if (shippable(critique)) {
        stopReason = "threshold";
        break;
      }
      if (critique.score - prevScore < MIN_IMPROVEMENT) {
        stopReason = "converged";
        break;
      }
    }
  }

  return { plan, iterations, finalScore: critique.score, stopReason };
}
