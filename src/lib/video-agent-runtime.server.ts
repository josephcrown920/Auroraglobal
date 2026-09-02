/** Shared autonomous video-agent integration seam: persistent brain + skills + presets + provider orchestration. */
import { buildGenerationContext, toPromptContext } from "./video-agent-memory-core";
import { selectVideoSkills } from "./video-agent-skill-selector";
import { resolvePreset } from "./video-agent-presets";
import { getBytePlusKey } from "./byteplus.server";
import { orchestrate, type GenerateRequest } from "./orchestrator.server";
import { VIDEO_AGENT_SYSTEM_CONTRACT, buildInitialBrain, planChange, type ProductionBrain } from "./video-production-brain";

export type VideoRuntimeRequest = {
  instruction: string;
  taskType: string;
  memory: Parameters<typeof buildGenerationContext>[0];
  preset?: string;
  model?: string;
  imageUrls?: string[];
  duration?: number;
  resolution?: "480p" | "720p" | "1080p" | "2160p";
  aspectRatio?: string;
  projectId?: string;
  productionBrain?: ProductionBrain;
};

export function prepareVideoRuntime(req: VideoRuntimeRequest) {
  const context = buildGenerationContext(req.memory, req.taskType, req.instruction);
  const brain = req.productionBrain ?? buildInitialBrain({
    projectId: req.projectId ?? "ephemeral",
    brief: req.instruction,
    durationSeconds: req.duration,
    aspectRatios: req.aspectRatio ? [req.aspectRatio] : [],
  });
  const impact = planChange(brain, req.instruction);
  return {
    ...req,
    context,
    brain,
    impact,
    preset: req.preset ? resolvePreset(req.preset) : null,
    skills: selectVideoSkills(req.instruction),
    modelArkAvailable: Boolean(getBytePlusKey()),
    promptContext: `${VIDEO_AGENT_SYSTEM_CONTRACT}\n\n${toPromptContext(context)}`,
  };
}

function resolveModel(req: VideoRuntimeRequest, kind: GenerateRequest["kind"]): string {
  if (req.model) return req.model;
  if (kind === "image") return process.env.MODELARK_IMAGE_MODEL ?? "seedream-4-0-250828";
  return process.env.MODELARK_VIDEO_MODEL ?? "seedance-2.0";
}

function buildRequest(req: VideoRuntimeRequest, kind: GenerateRequest["kind"]): GenerateRequest {
  const p = prepareVideoRuntime(req);
  return {
    kind,
    model: resolveModel(req, kind),
    prompt: `${p.promptContext}\n\nProject phase: ${p.brain.phase}.\nAffected nodes: ${p.impact.staleNodeIds.join(", ") || "none"}.\n\n${p.instruction}`,
    imageUrls: req.imageUrls,
    duration: req.duration,
    resolution: req.resolution,
    aspectRatio: req.aspectRatio,
  };
}

/** Generate references through the canonical router while carrying the project brain. */
export async function generateReference(req: VideoRuntimeRequest) {
  const result = await orchestrate(buildRequest(req, "image"));
  return result.url;
}

/** Generate shots through the canonical router; provider fallback remains internal to the orchestrator. */
export async function generateShot(req: VideoRuntimeRequest) {
  const result = await orchestrate(buildRequest(req, "video"));
  return result.url;
}
