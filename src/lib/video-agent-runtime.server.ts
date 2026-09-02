/** Shared autonomous video-agent integration seam: memory + skills + presets + provider orchestration. */
import { buildGenerationContext, toPromptContext } from "./video-agent-memory-core";
import { selectVideoSkills } from "./video-agent-skill-selector";
import { resolvePreset } from "./video-agent-presets";
import { getBytePlusKey } from "./byteplus.server";
import { orchestrate, type GenerateRequest } from "./orchestrator.server";

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
};

export function prepareVideoRuntime(req: VideoRuntimeRequest) {
  const context = buildGenerationContext(req.memory, req.taskType, req.instruction);
  return {
    ...req,
    context,
    preset: req.preset ? resolvePreset(req.preset) : null,
    skills: selectVideoSkills(req.instruction),
    modelArkAvailable: Boolean(getBytePlusKey()),
    promptContext: toPromptContext(context),
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
    prompt: `${p.promptContext}\n\n${p.instruction}`,
    imageUrls: req.imageUrls,
    duration: req.duration,
    resolution: req.resolution,
    aspectRatio: req.aspectRatio,
  };
}

/** Generate through the canonical provider router, retaining ModelArk/Seedream as the default path. */
export async function generateReference(req: VideoRuntimeRequest) {
  const result = await orchestrate(buildRequest(req, "image"));
  return result.url;
}

/** Generate through the canonical provider router with autonomous retry/fallback behavior. */
export async function generateShot(req: VideoRuntimeRequest) {
  const result = await orchestrate(buildRequest(req, "video"));
  return result.url;
}
