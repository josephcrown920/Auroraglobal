import { z } from "zod";

export const PRODUCTION_PHASES = ["intake","intent","research","script","bibles","references","storyboard","shots","routing","generation","audio","edit","captions","qa","repair","creative_review","render","delivery"] as const;
export type ProductionPhase = (typeof PRODUCTION_PHASES)[number];

export const VIDEO_CAPABILITIES = ["prompt_to_video","script_to_video","image_to_video","video_to_video","url_to_video","document_to_video","presentation_to_video","longform_to_shorts","multi_aspect","templates","brand_kit","stock_media","ai_images","ai_video","voice","music","sfx","captions","timeline","ai_revision","repurposing","asset_management","provider_routing","qa","rough_cut_review","render_export"] as const;
export type VideoCapability = (typeof VIDEO_CAPABILITIES)[number];

export const SPECIALIST_AGENTS = ["producer","director","dop","character_identity","storyboard","video_generation","image_generation","voice","music","sound_design","editor","captioning","qa_critic","creative_reviewer","repurposing","delivery"] as const;
export type SpecialistAgent = (typeof SPECIALIST_AGENTS)[number];

export const AssetRefSchema = z.object({
  id: z.string(), role: z.enum(["identity","wardrobe","environment","style","prop","start-frame","end-frame","audio","stock","brand"]),
  url: z.string().optional(), locked: z.boolean().default(false), version: z.number().int().nonnegative().default(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type AssetRef = z.infer<typeof AssetRefSchema>;

export const ProductionNodeSchema = z.object({
  id: z.string(), type: z.enum(["brief","research","script","scene","shot","asset","audio","track","caption","transition","effect","brand","rough-cut","render"]),
  sceneId: z.string().optional(), dependsOn: z.array(z.string()).default([]), sourceAssetIds: z.array(z.string()).default([]),
  status: z.enum(["planned","queued","processing","approved","failed","stale","revising"]).default("planned"),
  version: z.number().int().nonnegative().default(1), payload: z.record(z.string(), z.unknown()).default({}),
});
export type ProductionNode = z.infer<typeof ProductionNodeSchema>;

export const TimelineTrackSchema = z.object({
  id: z.string(), kind: z.enum(["video","image","voice","music","sfx","text","captions","overlay","brand"]),
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
  creative: z.object({ brief: z.string(), script: z.string().default(""), treatment: z.string().default(""), characterBible: z.array(z.string()).default([]), worldBible: z.array(z.string()).default([]), styleBible: z.array(z.string()).default([]), assumptions: z.array(z.string()).default([]) }),
  references: z.array(AssetRefSchema).default([]), nodes: z.array(ProductionNodeSchema).default([]), timeline: z.array(TimelineTrackSchema).default([]),
  audio: z.object({ voiceId: z.string().optional(), musicDirection: z.string().default(""), sfxDirection: z.string().default(""), mixNotes: z.array(z.string()).default([]) }),
  delivery: z.object({ formats: z.array(z.string()).default([]), resolutions: z.array(z.string()).default([]), captions: z.boolean().default(false), cleanVersion: z.boolean().default(false), variants: z.array(z.string()).default([]), outputs: z.array(z.object({ id: z.string(), url: z.string(), format: z.string(), resolution: z.string(), createdAt: z.string() })).default([]) }),
  routing: z.array(z.object({ nodeId: z.string(), provider: z.string(), model: z.string(), reason: z.string(), score: z.number().min(0).max(100), createdAt: z.string() })).default([]),
  qa: z.array(z.object({ nodeId: z.string(), pass: z.boolean(), score: z.number().min(0).max(100), issues: z.array(z.string()).default([]), createdAt: z.string() })).default([]),
  creativeReview: z.object({ score: z.number().min(0).max(100).optional(), issues: z.array(z.string()).default([]), approved: z.boolean().default(false) }),
  history: z.array(z.object({ id: z.string(), at: z.string(), actor: z.string(), instruction: z.string(), affectedNodeIds: z.array(z.string()), summary: z.string() })).default([]),
});
export type ProductionBrain = z.infer<typeof ProductionBrainSchema>;

export const VIDEO_AGENT_SYSTEM_CONTRACT = `You are an autonomous Aurora video-production agent operating one persistent Production Operating System.
Never treat a follow-up request as a new project unless the user explicitly resets it. Own the complete lifecycle: intake → intent → research/context → script → treatment/bibles → locked references → storyboard → shot graph → autonomous model routing → parallel generation → audio → editable timeline → captions → QA → targeted repair → rough-cut assembly → creative review → final repair → render → delivery.
Use specialist roles internally: producer, director, DOP, character/identity, storyboard, image/video generation, voice, music, sound, editor, captions, QA/critic, creative reviewer, repurposing and delivery. They must write to ONE coherent project state.
The user should not need to select a provider, seed, queue, API or prompt-engineering detail. Choose the best available provider/model by task fit, reference control, quality, temporal consistency, latency, cost and availability; retain ModelArk/Seedream/Seedance as a preferred path when available, but never create a single-provider dependency.
Treat every scene, shot, asset, track and audio element as an addressable production object. Lock approved identity, wardrobe, environment, style, prop, frame and audio references. Propagate changes through dependency edges and regenerate only the smallest affected subgraph. Preserve approved outputs and timeline positions.
Evaluate both individual generations and the assembled rough cut. QA must cover brief fidelity, identity, anatomy, temporal quality, prompt adherence, camera, continuity, story, pacing, audio and delivery constraints. Failures create targeted repair work, not a project reset.
Natural-language commands are production commands. Interpret them against the current project: local shot edits stay local; scene/world/character changes propagate to dependents; global creative changes trigger replanning only when necessary. Keep history and explain impact succinctly.
Ask only genuinely necessary questions. Otherwise make sensible assumptions and move the production forward.`;

export type ChangeImpact = { instruction: string; affectedNodeIds: string[]; staleNodeIds: string[]; affectedTrackIds: string[]; requiresReplan: boolean; reason: string };

function addMatchingNodes(brain: ProductionBrain, ids: Set<string>, predicate: (n: ProductionNode) => boolean) {
  for (const n of brain.nodes) if (predicate(n)) ids.add(n.id);
}

export function planChange(brain: ProductionBrain, instruction: string): ChangeImpact {
  const text = instruction.toLowerCase();
  const direct = new Set<string>();
  const scene = text.match(/\bscene\s*(\d+)\b/);
  const shot = text.match(/\bshot\s*([\w-]+)\b/);
  if (scene) { const sid = `scene-${scene[1]}`; addMatchingNodes(brain, direct, n => n.id === sid || n.sceneId === sid); }
  if (shot) { const token = shot[1].toLowerCase(); addMatchingNodes(brain, direct, n => n.id.toLowerCase() === token || n.id.toLowerCase() === `shot-${token}`); }
  const character = /hair|age|face|character|wardrobe|outfit|clothing|appearance|identity|look/.test(text);
  const environment = /location|environment|background|weather|time of day|city|set|world/.test(text);
  const style = /style|lighting|palette|color|cinematic|lens|camera|visual language/.test(text);
  const audio = /voice|dialogue|music|score|sound|sfx|audio|narration/.test(text);
  const edit = /pacing|transition|trim|split|timeline|sequence|captions|subtitle|text overlay|volume|speed|opacity/.test(text);
  if (character) addMatchingNodes(brain, direct, n => n.type === "shot" || (n.type === "asset" && ["identity","wardrobe"].includes(String(n.payload.role))));
  if (environment) addMatchingNodes(brain, direct, n => n.type === "shot" || (n.type === "asset" && n.payload.role === "environment"));
  if (style) addMatchingNodes(brain, direct, n => n.type === "shot" || (n.type === "asset" && n.payload.role === "style"));
  if (audio) addMatchingNodes(brain, direct, n => n.type === "audio" || n.type === "shot");
  if (edit) addMatchingNodes(brain, direct, n => ["track","transition","caption","effect","rough-cut"].includes(n.type));
  const stale = new Set(direct);
  let changed = true;
  while (changed) { changed = false; for (const n of brain.nodes) if (n.dependsOn.some(id => stale.has(id)) || n.sourceAssetIds.some(id => stale.has(id))) { if (!stale.has(n.id)) { stale.add(n.id); changed = true; } } }
  const affectedTrackIds = brain.timeline.filter(t => t.items.some(i => stale.has(i.nodeId))).map(t => t.id);
  const requiresReplan = /\b(entire|whole|story|script|ending|duration|platform|audience|objective|concept)\b/.test(text) && direct.size === 0;
  if (requiresReplan) for (const n of brain.nodes) stale.add(n.id);
  return { instruction, affectedNodeIds: [...direct], staleNodeIds: [...stale], affectedTrackIds, requiresReplan, reason: requiresReplan ? "Project-level creative direction changed." : direct.size ? "Dependency-aware local revision." : "No production object matched; agent must inspect current project state before acting." };
}

export function buildInitialBrain(input: { projectId: string; brief: string; objective?: string; audience?: string; emotionalGoal?: string; durationSeconds?: number; aspectRatios?: string[] }): ProductionBrain {
  return ProductionBrainSchema.parse({ version: 1, projectId: input.projectId, phase: "intake", intent: { objective: input.objective ?? input.brief, audience: input.audience ?? "Infer from the brief", emotionalGoal: input.emotionalGoal ?? "Infer from the brief", durationSeconds: input.durationSeconds, aspectRatios: input.aspectRatios ?? [] }, creative: { brief: input.brief }, references: [], nodes: [{ id: "brief", type: "brief", payload: { text: input.brief } }], timeline: [], audio: { musicDirection: "", sfxDirection: "", mixNotes: [] }, delivery: { formats: input.aspectRatios ?? [], resolutions: [], captions: false, cleanVersion: false, variants: [], outputs: [] }, routing: [], qa: [], creativeReview: { issues: [], approved: false }, history: [] });
}

export function recordInstruction(brain: ProductionBrain, instruction: string, impact: ChangeImpact, actor = "user"): ProductionBrain {
  return ProductionBrainSchema.parse({ ...brain, phase: impact.requiresReplan ? "intent" : "repair", nodes: brain.nodes.map(n => impact.staleNodeIds.includes(n.id) ? { ...n, status: "stale" } : n), history: [...brain.history, { id: `change-${Date.now()}-${brain.history.length + 1}`, at: new Date().toISOString(), actor, instruction, affectedNodeIds: impact.staleNodeIds, summary: impact.reason }] });
}
