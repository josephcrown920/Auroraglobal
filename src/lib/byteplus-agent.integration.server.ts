import { bytePlusVideo, getBytePlusKey } from "./byteplus.server";
import { isUnifiedWorkflow, UNIFIED_WORKFLOWS, type UnifiedWorkflow } from "./comfy-manager.integration.server";
import type { BytePlusVideoInput } from "./byteplus-video-contract";

export type VideoAgentMode = "standard" | "cinematic" | "viral";

export const VIDEO_AGENT_PRESETS = {
  cinematic: [
    "anamorphic_dolly", "slow_push_in", "vertigo_zoom", "parallax_depth",
    "cold_vision", "film_noir_key", "macro_lens_focus", "one_shot_tracking", "imax_landscape",
  ],
  viral: [
    "HOOK_THUMB_STOP", "FAST_CUT_MONTAGE", "FACELESS_TEXT_OVERLAY", "TRENDING_SPEED_RAMP",
    "SPLIT_SCREEN_REACTION", "NEON_DRIP", "CASH_RAIN", "FIRE_MEME", "WATER_RAP",
    "TRAP_HOUSE", "BROKEN_MIRROR", "FRAGMENTS", "EARTH_ZOOM",
  ],
} as const;

export type VideoAgentPlan = {
  mode: VideoAgentMode;
  workflow: UnifiedWorkflow;
  preset?: string;
  prompt: string;
  steps: ["plan", "generate", "inspect"];
};

export function planVideoAgent(input: {
  prompt: string;
  mode?: VideoAgentMode;
  preset?: string;
  workflowId?: string;
}): VideoAgentPlan {
  const mode = input.mode ?? "standard";
  const workflowId = input.workflowId ?? (mode === "cinematic" ? "cinematic-video" : mode === "viral" ? "viral-video" : "standard-video");
  if (!isUnifiedWorkflow(workflowId)) throw new Error(`Unsupported workflow: ${workflowId}`);
  const workflow = UNIFIED_WORKFLOWS.find((item) => item.id === workflowId)!;
  const preset = input.preset?.trim() || undefined;
  return {
    mode,
    workflow,
    preset,
    prompt: preset ? `${input.prompt}\nVisual preset: ${preset}` : input.prompt,
    steps: ["plan", "generate", "inspect"],
  };
}

export async function generateVideoAgent(input: {
  prompt: string;
  mode?: VideoAgentMode;
  preset?: string;
  workflowId?: string;
  imageUrls?: string[];
  model?: string;
  duration?: number;
  resolution?: string;
  aspectRatio?: string;
}): Promise<{ url: string; workflow: UnifiedWorkflow; mode: VideoAgentMode; preset?: string }> {
  if (!getBytePlusKey()) throw new Error("BytePlus/ModelArk credentials are not configured");
  const plan = planVideoAgent(input);
  const video = await bytePlusVideo({
    model: input.model ?? process.env.BYTEPLUS_VIDEO_MODEL ?? process.env.ARK_VIDEO_MODEL ?? "seedance-1-0-pro-250528",
    prompt: plan.prompt,
    imageUrls: input.imageUrls,
    duration: input.duration,
    resolution: input.resolution as BytePlusVideoInput["resolution"],
    aspectRatio: input.aspectRatio,
  });
  return { url: video, workflow: plan.workflow, mode: plan.mode, preset: plan.preset };
}
