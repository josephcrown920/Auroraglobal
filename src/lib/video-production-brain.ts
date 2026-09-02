import { z } from "zod";

/** Canonical Production Operating System contract shared by every Aurora video agent. */
export const PRODUCTION_PHASES = ["brief","intent","research","script","bibles","references","storyboard","shots","routing","generation","audio","edit","captions","qa","repair","creative_review","render","delivery"] as const;
export type ProductionPhase = (typeof PRODUCTION_PHASES)[number];

export const VIDEO_CAPABILITIES = ["prompt_to_video","script_to_video","image_to_video","video_to_video","url_to_video","document_to_video","presentation_to_video","longform_to_shorts","multi_aspect","templates","brand_kit","stock_media","ai_images","ai_video","voice","music","sfx","captions","timeline","ai_revision","repurposing","asset_management","provider_routing","qa","render_export"] as const;
export type VideoCapability = (typeof VIDEO_CAPABILITIES)[number];

export const SPECIALIST_AGENTS = ["producer","director","dop","character_identity","storyboard","video_generation","image_generation","voice","music","sound_design","editor","captioning","qa_critic","repurposing","delivery"] as const;
export type SpecialistAgent = (typeof SPECIALIST_AGENTS)[number];

export const AssetRefSchema = z.object({
  id: z.string(),
  role: z.enum(["identity","wardrobe","environment","style","prop","start-frame","end-frame","audio","stock","brand"]),
  url: z.string().optional(),
  locked: z.boolean().default(false),
  version: z.number().int().nonnegative().default(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type AssetRef = z.infer<typeof AssetRefSchema>;

export const ProductionNodeSchema = z.object({
  id: z.string(),
  type: z.enum(["brief","scene","shot","asset","audio","track","caption","transition","effect","brand"]),
  sceneId: z.string().optional(),
  dependsOn: z.array(z.string()).default([]),
  sourceAssetIds: z.array(z.string()).default([]),
  status: z.enum(["planned","queued","processing","approved","failed","stale","revising"]).default("planned"),
  version: z.number().int().nonnegative().default(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type ProductionNode = z.infer<typeof ProductionNodeSchema>;

export const TimelineTrackSchema = z.object({
  id: z.string(),
  kind: z.enum(["video","image","voice","music","sfx","text","captions","overlay","brand"]),
  items: z.array(z.object({
    id: z.string(), nodeId: z.string(), start: z.number().nonnegative(), end: z.number().positive(), sourceUrl: z.string().optional(),
    volume: z.number().min(0).max(2).default(1), opacity: z.number().min(0).max(1).default(1), speed: z.number().positive().default(1),
    position: z.object({ x: z.number(), y: z.number() }).optional(), scale: z.number().positive().optional(),
    transitionIn: z.string().optional(), transitionOut: z.string().optional(), effects: z.array(z.string()).default([]),
  })).default([]),
});
export type TimelineTrack = z.infer<typeof TimelineTrackSchema>;

export const ProductionBrainSchema = z.object({
  version: z.literal(1), projectId: z.string(), phase: z.enum(PRODUCTION_PHASES),
  intent: z.object({ objective: z.string(), audience: z.string(), emotionalGoal: z.string(), platform: z.string().optional(), durationSeconds: z.number().positive().optional(), aspectRatios: z.array(z.string()).default([]) }),
  creative: z.object({ brief: z.string(), script: z.string().default(""), characterBible: z.array(z.string()).default([]), worldBible: z.array(z.string()).default([]), styleBible: z.array(z.string()).default([]), assumptions: z.array(z.string()).default([]) }),
  references: z.array(AssetRefSchema).default([]), nodes: z.array(ProductionNodeSchema).default([]), timeline: z.array(TimelineTrackSchema).default([]),
  audio: z.object({ voiceId: z.string().optional(), musicDirection: z.string().default(""), sfxDirection: z.string().default(""), mixNotes: z.array(z.string()).default([]) }),
  delivery: z.object({ formats: z.array(z.string()).default([]), resolutions: z.array(z.string()).default([]), captions: z.boolean().default(false), cleanVersion: z.boolean().default(false), variants: z.array(z.string()).default([]) }),
  history: z.array(z.object({ id: z.string(), at: z.string(), actor: z.string(), instruction: z.string(), affectedNodeIds: z.array(z.string()), summary: z.string() })).default([]),
});
export type ProductionBrain = z.infer<typeof ProductionBrainSchema>;

export const VIDEO_AGENT_SYSTEM_CONTRACT = `You are an autonomous Aurora video-production agent operating a shared Production Operating System.
The project brain is persistent. Never treat a follow-up request as a new project unless the user explicitly asks for a reset.
Own the complete chain: brief → intent → research/context → script → bibles → references → storyboard → shot graph → routing → generation → voice/music/SFX → edit → captions → QA → targeted repair → creative review → final render → delivery.
Use specialist roles internally (producer, director, DOP, character/identity, storyboard, generation, voice, music, sound, editor, captions, QA/critic, repurposing, delivery) but keep ONE coherent project state.
Model selection is an orchestration decision, never a user requirement. Compare task fit, reference control, quality, temporal consistency, latency, cost and availability before dispatch.
Maintain identity, wardrobe, environment, props, lighting, camera grammar, audio and emotional state through locked references and dependency edges.
For every change, determine the smallest affected dependency subgraph. Rebuild only stale/affected nodes and preserve approved nodes and timeline positions. Never regenerate an entire project for a local change.
The editable production representation includes scenes, shots, video/image/audio tracks, captions, text, transitions, effects and brand elements. Natural-language edits must map to concrete node/track mutations.
QA is closed-loop: evaluate each generated asset and the assembled rough cut against intent, continuity, identity, prompt adherence, anatomy, temporal quality, camera, story, pacing and audio. On failure, identify the failing node(s), issue a targeted repair, preserve unaffected work, and QA again.
Ask only genuinely necessary questions. Otherwise make sensible production assumptions and keep moving. The user should not need to know providers, APIs, seeds, queues or prompt engineering.`;

export type ChangeImpact = { instruction: string; affectedNodeIds: string[]; staleNodeIds: string[]; affectedTrackIds: string[]; requiresReplan: boolean; reason: string };

export function planChange(brain: ProductionBrain, instruction: string): ChangeImpact {
  const text = instruction.toLowerCase();
  const direct: string[] = [];
  const addBy = (predicate: (n: ProductionNode) => boolean) => { for (const n of brain.nodes) if (predicate(n)) direct.push(n.id); };
  const sceneMatch = text.match(/scene\s*(\d+)/i);
  if (sceneMatch) { const sceneId = `scene-${sceneMatch[1]}`; addBy((n) => n.id === sceneId || n.sceneId === sceneId); }
  const shotMatch = text.match(/shot\s*([\w-]+)/i);
  if (shotMatch) addBy((n) => n.id.toLowerCase() === `shot-${shotMatch[1].toLowerCase()}` || n.id.toLowerCase() === shotMatch[1].toLowerCase());
  const characterChange = /hair|age|face|character|wardrobe|outfit|clothing|appearance|identity/.test(text);
  const environmentChange = /location|environment|background|weather|time of day|city|set/.test(text);
  const styleChange = /style|lighting|palette|color|cinematic|lens|camera language/.test(text);
  const audioChange = /voice|dialogue|music|score|sound|sfx|audio|narration/.test(text);
  const editChange = /pacing|transition|trim|split|timeline|sequence|captions|subtitle|text overlay|volume/.test(text);
  if (characterChange) addBy((n) => (n.type === "asset" && (n.payload.role === "identity" || n.payload.role === "wardrobe")) || n.type === "shot");
  if (environmentChange) addBy((n) => (n.type === "asset" && n.payload.role === "environment") || n.type === "shot");
  if (styleChange) addBy((n) => (n.type === "asset" && n.payload.role === "style") || n.type === "shot");
  if (audioChange) addBy((n) => n.type === "audio" || n.type === "shot");
  if (editChange) addBy((n) => ["track","transition","caption","effect"].includes(n.type));
  const affected = [...new Set(direct)];
  const stale = new Set(affected);
  let changed = true;
  while (changed) { changed = false; for (const n of brain.nodes) if (n.dependsOn.some((id) => stale.has(id)) || n.sourceAssetIds.some((id) => stale.has(id))) { if (!stale.has(n.id)) { stale.add(n.id); changed = true; } } }
  const affectedTrackIds = brain.timeline.filter((t) => t.items.some((i) => stale.has(i.nodeId) || affected.includes(i.nodeId))).map((t) => t.id);
  const requiresReplan = /entire|whole|story|script|ending|duration|platform|audience|objective/.test(text) && affected.length === 0;
  if (requiresReplan) for (const n of brain.nodes) stale.add(n.id);
  return { instruction, affectedNodeIds: affected, staleNodeIds: [...stale], affectedTrackIds, requiresReplan, reason: requiresReplan ? "Creative direction changed at project level." : affected.length ? "Dependency-aware local revision." : "No explicit production object matched; inspect project context before acting." };
}

export function buildInitialBrain(input: { projectId: string; brief: string; objective?: string; audience?: string; emotionalGoal?: string; durationSeconds?: number; aspectRatios?: string[] }): ProductionBrain {
  return ProductionBrainSchema.parse({ version: 1, projectId: input.projectId, phase: "brief", intent: { objective: input.objective ?? input.brief, audience: input.audience ?? "Infer from the brief", emotionalGoal: input.emotionalGoal ?? "Infer from the brief", durationSeconds: input.durationSeconds, aspectRatios: input.aspectRatios ?? [] }, creative: { brief: input.brief }, references: [], nodes: [{ id: "brief", type: "brief", payload: { text: input.brief } }], timeline: [], audio: { musicDirection: "", sfxDirection: "", mixNotes: [] }, delivery: { formats: input.aspectRatios ?? [], resolutions: [], captions: false, cleanVersion: false, variants: [] }, history: [] });
}

export function recordInstruction(brain: ProductionBrain, instruction: string, impact: ChangeImpact, actor = "user"): ProductionBrain {
  return ProductionBrainSchema.parse({ ...brain, phase: impact.requiresReplan ? "intent" : "repair", nodes: brain.nodes.map((n) => impact.staleNodeIds.includes(n.id) ? { ...n, status: "stale" } : n), history: [...brain.history, { id: `change-${Date.now()}-${brain.history.length + 1}`, at: new Date().toISOString(), actor, instruction, affectedNodeIds: impact.staleNodeIds, summary: impact.reason }] });
}
