/**
 * Final video-agent integration seam for Aurora Global.
 * Existing orchestration/queue code remains authoritative; this module adds
 * memory, skills, presets and direct ModelArk generation without bypassing
 * authentication, credits, RLS, or the existing provider fallback layer.
 */
import { buildGenerationContext, toPromptContext } from "./video-agent-memory-core";
import { selectVideoSkills } from "./video-agent-skills";
import { resolvePreset } from "./video-agent-presets";
import { bytePlusImage, bytePlusVideo, getBytePlusKey } from "./byteplus.server";

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

export async function generateReference(req: VideoRuntimeRequest) {
  const p = prepareVideoRuntime(req);
  return bytePlusImage({
    model: req.model ?? process.env.MODELARK_IMAGE_MODEL ?? "seedream-4-5-251128",
    prompt: `${p.promptContext}\n\n${p.instruction}`,
    imageUrls: req.imageUrls,
    size: "2048x2048",
  });
}

export async function generateShot(req: VideoRuntimeRequest) {
  const p = prepareVideoRuntime(req);
  return bytePlusVideo({
    model: req.model ?? process.env.MODELARK_VIDEO_MODEL ?? "seedance-2-5",
    prompt: `${p.promptContext}\n\n${p.instruction}`,
    imageUrls: req.imageUrls,
    duration: req.duration,
    resolution: req.resolution,
    aspectRatio: req.aspectRatio,
  });
}
