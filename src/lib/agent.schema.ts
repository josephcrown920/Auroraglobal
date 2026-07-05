// Shared Aurora Agent schemas + prompts. Pure (no server-only deps) so it can be
// imported by both server logic (agent-loop.server, agent.functions) and client
// UI (type-only). The director → critic refinement loop in agent-loop.server.ts
// builds on these.
import { z } from "zod";

export const ShotSchema = z.object({
  id: z.string().describe("Stable short id like S1, S2 — NEVER renumber across revisions"),
  title: z.string().describe("Shot title, 3-6 words"),
  shotType: z.string().describe("Wide / Medium / Close-up / OTS / Dutch / etc"),
  camera: z.string().describe("Lens, movement, frame e.g. '35mm, slow push in, handheld'"),
  action: z.string().describe("1-2 sentence description of what happens"),
  prompt: z.string().describe("Full ready-to-run image prompt, ~80-150 words"),
});

export const PlanSchema = z.object({
  title: z.string(),
  logline: z.string().describe("One sentence pitch"),
  direction: z.string().describe("1-2 sentence creative direction with mood/palette/references"),
  palette: z.array(z.string()).min(3).max(6).describe("Hex codes for the color story"),
  shots: z.array(ShotSchema).min(3).max(8),
  suggestions: z.array(z.string()).min(2).max(5),
});

export type AgentShot = z.infer<typeof ShotSchema>;
export type AgentPlan = z.infer<typeof PlanSchema>;

export const CritiqueIssueSchema = z.object({
  target: z
    .string()
    .describe("Which part this concerns: a shot id like 'S2', or 'overall' / 'palette' / 'direction' / 'pacing'"),
  problem: z.string().describe("Specific weakness — what is wrong and why it hurts the film"),
  fix: z.string().describe("Concrete, actionable revision the director can apply immediately"),
});

export const CritiqueSchema = z.object({
  score: z.number().min(0).max(100).describe("Overall quality 0-100. 85+ means genuinely shippable."),
  verdict: z.string().describe("1-2 sentence summary judgement of the plan"),
  strengths: z.array(z.string()).min(1).max(5).describe("What already works"),
  issues: z
    .array(CritiqueIssueSchema)
    .max(8)
    .describe("Blocking/important problems. Return EMPTY only when the plan is genuinely shippable — do not invent nitpicks."),
});

export type CritiqueIssue = z.infer<typeof CritiqueIssueSchema>;
export type Critique = z.infer<typeof CritiqueSchema>;

/** One round of the director → critic loop: the plan produced and how it scored. */
export type PlanIteration = {
  n: number;
  plan: AgentPlan;
  critique: Critique;
};

export const DIRECTOR_SYSTEM = `You are AURORA AGENT — a senior music-video / short-film director.
A user gives you ONE paragraph describing a story/shoot they want to create.
Return a complete production breakdown the user can execute immediately:
- 1-2 sentence creative direction (mood, references, palette)
- 4-8 shots, each with: shot type, camera, action, and a FULL ready-to-use image prompt
  (~80-150 words, cinematic, 16mm/35mm-film vocabulary, deep focus, no bloom/no lens flare)
- 3-5 color/grade keywords
- A short list of next-step suggestions ("generate shot 1", "split-reality on shot 3", etc.)
Write prompts so good the user does not need to edit them. Be specific about wardrobe,
lighting, lens, camera move, and environment. Never use markdown formatting in fields —
return clean text only.`;

export const CRITIC_SYSTEM = `You are AURORA CRITIC — a ruthless but constructive creative director reviewing another director's shot plan for a short film / music video.
Judge the plan against the user's brief on: fidelity to the brief, visual originality, cinematic craft (lens/lighting/camera language), shot-to-shot continuity and pacing, palette cohesion, and prompt quality (specific, shoot-ready, no markdown).
Be specific and honest:
- score is 0-100; reserve 85+ for plans that are genuinely shippable with NO blocking issues.
- Each issue MUST name a concrete target (a shot id like "S3", or "overall"/"palette"/"direction"/"pacing"), the problem, and a concrete fix.
- If the plan is already shippable, return an EMPTY issues array — do not invent nitpicks.
- Do NOT rewrite the plan yourself; only critique it.`;

export const buildRefNote = (referenceImages?: string[]): string =>
  referenceImages?.length
    ? `\n\nThe user attached ${referenceImages.length} reference image(s). Treat them as the talent / wardrobe / location anchor — keep them visually consistent across every shot.`
    : "";

export function buildDirectorPrompt(brief: string, refNote: string): string {
  return `BRIEF:\n${brief}${refNote}\n\nReturn the full production plan now.`;
}

export function buildCritiquePrompt(brief: string, plan: AgentPlan): string {
  return `USER BRIEF:\n${brief}\n\nDIRECTOR'S CURRENT PLAN (JSON):\n${JSON.stringify(plan, null, 2)}\n\nCritique this plan now.`;
}

export function buildRefinePrompt(brief: string, plan: AgentPlan, critique: Critique, refNote: string): string {
  const issues =
    critique.issues.map((i, idx) => `${idx + 1}. [${i.target}] ${i.problem} → FIX: ${i.fix}`).join("\n") || "(none listed)";
  return `BRIEF:\n${brief}${refNote}\n\nYOUR PREVIOUS PLAN (JSON):\n${JSON.stringify(plan, null, 2)}\n\nA critic reviewed it and scored it ${critique.score}/100.\nVerdict: ${critique.verdict}\nISSUES TO FIX:\n${issues}\n\nReturn a REVISED full production plan that resolves every issue while preserving what already works. Keep the SAME shot ids for shots you revise (do not renumber); only add or remove shots if a fix genuinely requires it. Return the COMPLETE plan, not a diff.`;
}
