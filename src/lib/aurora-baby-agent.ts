import { z } from "zod";
import { VIDEO_AGENT_SYSTEM_CONTRACT } from "./video-production-brain";

export const BABY_AGENT_SYSTEM = `${VIDEO_AGENT_SYSTEM_CONTRACT}

You are Aurora Baby Agent, the individual autonomous video producer inside Aurora. You own production state from brief through delivery and may invoke every specialist role required by the project.

Work decisively. Ask at most one question and only when subject AND intent are both genuinely missing. Prefer generated assets when the brief requires specificity; prefer stock when a licensed existing asset can satisfy the shot.

Always reason in this order:
BRIEF → RESEARCH/CONTEXT → SCRIPT → STORY → CHARACTER/ENVIRONMENT/STYLE BIBLES → STORYBOARD → SHOT COVERAGE → CAMERA + BEHAVIOR → MODEL ROUTING → GENERATION → QA → TARGETED REPAIR → EDIT → CAPTIONS/SOUND → DELIVERY.

Return strict JSON matching the requested schema.`;

export const BabyShotSchema = z.object({
  id: z.string(),
  scene: z.number().int().min(1),
  purpose: z.enum(["hook", "establishing", "character", "action", "reaction", "detail", "transition", "payoff"]),
  durationSeconds: z.number().min(2).max(15),
  framing: z.enum(["extreme-wide", "wide", "medium-wide", "medium", "medium-close", "close-up", "extreme-close-up", "macro", "pov", "over-shoulder", "two-shot"]),
  lensMm: z.number().min(14).max(200),
  cameraMove: z.string(),
  cameraSpeed: z.enum(["static", "slow", "measured", "fast", "aggressive"]),
  lighting: z.string(),
  behavior: z.string(),
  continuityLocks: z.array(z.string()).max(12),
  prompt: z.string().min(20).max(1800),
  negativePrompt: z.string().min(10).max(1000),
  referenceRoles: z.array(z.enum(["identity", "wardrobe", "environment", "style", "prop", "start-frame", "end-frame"])).max(7),
  preferredProvider: z.enum(["modelark", "fal", "replicate", "vast"]).optional(),
});

export const BabyPlanSchema = z.object({
  needsClarification: z.boolean().optional(),
  question: z.string().optional(),
  brief: z.object({
    title: z.string(), intent: z.string(), audience: z.string(), durationSeconds: z.number().int().min(5).max(600),
    aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5", "2.39:1"]), tone: z.string(), visualLanguage: z.string(), assumptions: z.array(z.string()).max(12),
  }),
  script: z.object({ narration: z.string(), dialogue: z.array(z.object({ speaker: z.string(), line: z.string() })).max(30), musicDirection: z.string(), sfxDirection: z.string() }),
  bibles: z.object({ identityAnchor: z.string(), character: z.array(z.string()).max(20), environment: z.array(z.string()).max(20), style: z.array(z.string()).max(20) }),
  shots: z.array(BabyShotSchema).min(1).max(80),
  delivery: z.object({ formats: z.array(z.enum(["16:9", "9:16", "1:1", "4:5", "2.39:1"])).min(1), fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(60)]), resolution: z.enum(["720p", "1080p", "2160p"]), captions: z.boolean(), dubbing: z.boolean() }),
});

export type AuroraBabyPlan = z.infer<typeof BabyPlanSchema>;
export type AuroraBabyShot = z.infer<typeof BabyShotSchema>;

export const BABY_AGENT_ANALYSIS = `Build a complete autonomous video production plan.

Required behavior:
- Infer platform format from the brief; TikTok/Reels/Shorts = 9:16, YouTube = 16:9, feed = 1:1 or 4:5.
- Break the requested duration into purposeful scenes and 2–15 second shots.
- Establish a reusable identity anchor and repeat it verbatim whenever the same character appears.
- Give each shot a single dominant camera movement, real focal length, lighting direction and concrete behavior.
- Carry continuity locks from previous shots into every dependent shot.
- Mark reference roles so the executor knows which assets are identity, wardrobe, environment, style or frame references.
- Route dialogue/audio-synchronized shots toward models capable of native audio when available; route identity/control-heavy shots toward the strongest reference-capable provider.
- Keep negative prompts explicit: warped face, identity drift, extra fingers, duplicate subject, broken anatomy, temporal morphing, unwanted text, watermark, flicker, lighting discontinuity.
- Represent the project as addressable nodes and tracks so revisions can be local and dependency-aware.
- Include audio, captions, edit and delivery decisions when the brief requires them.
- Do not make the user select a model; provider choice belongs to the orchestrator.

Return only JSON matching BabyPlanSchema.`;

export function compileShotPrompt(shot: AuroraBabyShot, plan: AuroraBabyPlan): string {
  const continuity = shot.continuityLocks.length ? ` Continuity locks: ${shot.continuityLocks.join("; ")}.` : "";
  return [shot.framing.toUpperCase(), `${shot.lensMm}mm`, shot.cameraMove, `${shot.cameraSpeed} camera speed`, shot.behavior, shot.lighting, plan.brief.visualLanguage, `aspect ${plan.brief.aspectRatio}`, continuity, "natural motion, stable anatomy, coherent temporal movement"].filter(Boolean).join(". ");
}

export function chooseProvider(shot: AuroraBabyShot, available: Record<string, boolean>): "modelark" | "fal" | "replicate" | "vast" {
  const preferred = shot.preferredProvider;
  if (preferred && available[preferred]) return preferred;
  if (shot.referenceRoles.includes("identity") && available.vast) return "vast";
  if (shot.referenceRoles.includes("start-frame") && available.modelark) return "modelark";
  if (available.fal) return "fal";
  if (available.replicate) return "replicate";
  if (available.modelark) return "modelark";
  return "vast";
}

export type BabyQaResult = { pass: boolean; score: number; failures: string[] };

export function scoreBabyShot(input: { identity: number; promptAdherence: number; temporal: number; camera: number; anatomy: number; continuity: number }): BabyQaResult {
  const values = Object.values(input);
  const score = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const failures = Object.entries(input).filter(([, value]) => value < 70).map(([key, value]) => `${key}:${value}`);
  return { pass: score >= 78 && failures.length === 0, score, failures };
}

export function buildRevisionCommand(shot: AuroraBabyShot, qa: BabyQaResult): string {
  if (qa.pass) return "";
  return `Repair only ${shot.id}. Preserve all approved references, wardrobe, environment and timeline position. Fix: ${qa.failures.join(", ")}. Do not regenerate unaffected shots.`;
}
