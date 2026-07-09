// Shared Aurora Agent schemas + prompts. Pure (no server-only deps) so it can be
// imported by both server logic (agent-loop.server, agent.functions) and client
// UI (type-only). The director → critic refinement loop in agent-loop.server.ts
// builds on these.
import { z } from "zod";

export const ShotSchema = z.object({
  // coerce: models sometimes emit numeric ids (1, 2, 3) — accept and stringify.
  id: z.coerce.string().describe("Stable short id like S1, S2 — NEVER renumber across revisions"),
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

// ─── Conversational Video Agent (persistent chat + permanent memory) ─────────

export const ChatTurnSchema = z.object({
  reply: z
    .string()
    .describe("Your conversational reply to the artist. Plain text only — no markdown syntax. Keep it tight and directorial."),
  plan: z
    .union([
      PlanSchema,
      // Some models return a bare array of shots instead of the plan object —
      // accept it (ids optional) and wrap it into a minimal valid plan below.
      z.array(ShotSchema.extend({ id: z.coerce.string().default("") })),
    ])
    .nullable()
    .optional()
    .describe(
      "Full production plan ONLY when the artist explicitly asks for a shot list / storyboard / plan / breakdown — a single OBJECT with fields title, logline, direction, palette, shots, suggestions (never a bare array). Otherwise null.",
    )
    .transform((v): AgentPlan | null | undefined =>
      Array.isArray(v)
        ? {
            title: "Shot Plan",
            logline: "",
            direction: "",
            palette: ["#0B0B14", "#7C3AED", "#F0ABFC"],
            shots: v.map((s, i) => ({ ...s, id: s.id || `S${i + 1}` })),
            suggestions: ["Generate shot 1", "Send the plan to canvas"],
          }
        : v,
    ),
  memoryUpdate: z
    .union([z.string(), z.record(z.unknown())])
    .nullable()
    .optional()
    .describe(
      "The COMPLETE revised long-term memory document as ONE plain text string (bullet lines, not an object, not a diff) when this turn revealed something durable about the artist. Otherwise null.",
    )
    .transform((v): string | null | undefined =>
      // Models occasionally return a key/value object here despite the schema —
      // flatten it to bullet lines instead of failing the whole turn.
      v !== null && v !== undefined && typeof v === "object"
        ? Object.entries(v)
            .map(([k, val]) => `${k}: ${typeof val === "string" ? val : JSON.stringify(val)}`)
            .join("\n")
        : v,
    ),
});

export type AgentChatTurn = z.infer<typeof ChatTurnSchema>;

export const CHAT_DIRECTOR_SYSTEM = `You are AURORA AGENT — the artist's permanent AI co-director inside Aurora Studio.
You are a senior music-video and short-film director: fluent in lenses, lighting, blocking, color science, editing rhythm, and music-video history. You speak like a sharp collaborator on set — direct, warm, zero fluff.

YOU HAVE PERMANENT MEMORY of this artist across every conversation. Use it: reference their style, recurring characters, wardrobe, past projects and preferences without being asked. Never claim you can't remember previous sessions.

RESPONSE RULES (answer as a JSON object matching the schema — fields "reply", "plan", "memoryUpdate"):
- "reply" is plain conversational text (no markdown symbols like ** or #). 1-3 short paragraphs max.
- Set "plan" ONLY when the artist asks for a shot list, storyboard, plan, or full breakdown. For casual questions, feedback, or brainstorming, keep plan null and just talk.
- When you do return a plan, it is ONE JSON object with fields: title, logline, direction, palette (3-6 hex codes), shots (array of 4-8 shot objects with id/title/shotType/camera/action/prompt), suggestions (2-5 strings). Never return plan as a bare array. Each shot prompt is FULL and ready-to-run (~80-150 words, cinematic 16mm/35mm vocabulary, specific wardrobe/lighting/lens/camera move — so good it needs no edits).
- "memoryUpdate": when this turn reveals something durable about the artist (their name, genre, visual style, recurring characters, projects in flight, strong preferences), return the FULL revised memory document — rewrite the whole thing, merging old + new, under 2000 characters, as terse bullet lines in ONE plain-text string (never a JSON object). If nothing durable was learned, return null. Never store throwaway details.`;

export function buildChatPrompt(args: {
  memory: string;
  transcript: { role: "user" | "assistant"; content: string }[];
  message: string;
}): string {
  const memoryBlock = args.memory.trim()
    ? `YOUR PERMANENT MEMORY OF THIS ARTIST:\n${args.memory.trim()}`
    : "YOUR PERMANENT MEMORY OF THIS ARTIST: (empty — first conversations. Start learning who they are.)";
  const history = args.transcript.length
    ? `RECENT CONVERSATION:\n${args.transcript
        .map((m) => `${m.role === "user" ? "ARTIST" : "YOU"}: ${m.content}`)
        .join("\n")}`
    : "RECENT CONVERSATION: (none yet)";
  return `${memoryBlock}\n\n${history}\n\nARTIST'S NEW MESSAGE:\n${args.message}\n\nRespond now as their co-director.`;
}

export function buildCritiquePrompt(brief: string, plan: AgentPlan): string {
  return `USER BRIEF:\n${brief}\n\nDIRECTOR'S CURRENT PLAN (JSON):\n${JSON.stringify(plan, null, 2)}\n\nCritique this plan now.`;
}

export function buildRefinePrompt(brief: string, plan: AgentPlan, critique: Critique, refNote: string): string {
  const issues =
    critique.issues.map((i, idx) => `${idx + 1}. [${i.target}] ${i.problem} → FIX: ${i.fix}`).join("\n") || "(none listed)";
  return `BRIEF:\n${brief}${refNote}\n\nYOUR PREVIOUS PLAN (JSON):\n${JSON.stringify(plan, null, 2)}\n\nA critic reviewed it and scored it ${critique.score}/100.\nVerdict: ${critique.verdict}\nISSUES TO FIX:\n${issues}\n\nReturn a REVISED full production plan that resolves every issue while preserving what already works. Keep the SAME shot ids for shots you revise (do not renumber); only add or remove shots if a fix genuinely requires it. Return the COMPLETE plan, not a diff.`;
}
