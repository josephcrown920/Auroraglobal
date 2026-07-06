import { z } from "zod";

/**
 * Core Node Validation Schema
 * Handles minimum requirements for all node types in the pipeline
 */

export const promptSchema = z
  .string()
  .min(3, "Prompt must be at least 3 characters")
  .max(2000, "Prompt must not exceed 2000 characters")
  .or(z.literal("").describe("Empty if visual input is provided"));

export const optionalPromptSchema = z
  .string()
  .min(0)
  .max(2000)
  .optional()
  .default("");

export const characterInputNodeSchema = z.object({
  characterId: z.string().uuid("Invalid character ID"),
  characterName: z.string().min(1, "Character name required"),
  characterModel: z.enum(["wav2lip", "lipsync-gan", "mimic-motion"]),
  audioTrackId: z.string().uuid("Invalid audio track ID"),
  referenceImage: z.string().url("Invalid reference image URL"),
  pose: z.enum(["standing", "sitting", "dancing"]).default("standing"),
});

export const audioTrackNodeSchema = z.object({
  audioTrackId: z.string().uuid("Invalid audio track ID"),
  audioUrl: z.string().url("Invalid audio URL"),
  duration: z.number().positive("Duration must be positive"),
  sampleRate: z.number().default(44100),
  bpm: z.number().optional(),
  genre: z.string().optional(),
});

export const cycloramaStudioNodeSchema = z.object({
  backgroundColor: z.enum([
    "sunset-orange",
    "hot-pink",
    "neon-blue",
    "deep-purple",
    "emerald-green",
    "custom",
  ]),
  customColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, "Invalid hex color")
    .optional(),
  lightingPreset: z.enum([
    "cinematic",
    "concert",
    "studio",
    "moody",
    "bright",
  ]),
  lightIntensity: z.number().min(0).max(1).default(0.8),
  backgroundStyle: z.enum([
    "solid",
    "gradient",
    "bokeh",
    "particle-fx",
    "video-bg",
  ]),
  environmentPrompt: z
    .string()
    .min(3, "Environment prompt required")
    .max(1000),
});

export const lipSyncVideoGenNodeSchema = z.object({
  characterInputId: z.string().uuid("Invalid character input reference"),
  audioTrackId: z.string().uuid("Invalid audio track reference"),
  lipSyncModel: z.enum(["wav2lip", "kling-2.6", "mimic-motion"]),
  faceQuality: z.enum(["low", "medium", "high"]).default("high"),
  outputFramerate: z.number().default(30),
  motionIntensity: z.number().min(0).max(1).default(0.7),
  preserveFacialExpression: z.boolean().default(true),
});

export const motionTransferNodeSchema = z.object({
  videoInputId: z.string().uuid("Invalid video input reference"),
  motionReferenceVideoId: z.string().uuid("Invalid motion reference"),
  motionModel: z.enum(["mimic-motion", "champ", "dwpose-based"]),
  motionIntensity: z.number().min(0).max(1).default(0.8),
  gpuCapability: z.enum(["motion", "video", "standard"]).default("motion"),
  preserveIdentity: z.boolean().default(true),
  outputResolution: z.enum(["720p", "1080p", "4k"]).default("1080p"),
});

export const stageRenderingNodeSchema = z.object({
  cycloramaStudioId: z.string().uuid("Invalid studio reference"),
  lipSyncVideoId: z.string().uuid("Invalid video reference"),
  motionTransferId: z.string().uuid("Invalid motion transfer reference"),
  stylePrompt: optionalPromptSchema,
  renderQuality: z.enum(["preview", "standard", "high", "4k"]).default("standard"),
  outputFormat: z.enum(["mp4", "webm", "mov"]).default("mp4"),
  bitrate: z.number().default(8000),
});

export const validationRules = {
  minPromptLength: 3,
  maxPromptLength: 2000,
  minEnvironmentPrompt: 3,
  supportedLipSyncModels: ["wav2lip", "kling-2.6", "mimic-motion"],
  supportedMotionModels: ["mimic-motion", "champ", "dwpose-based"],
  minMotionIntensity: 0,
  maxMotionIntensity: 1,
};

/**
 * Utility function to check if node output can bypass prompt requirement
 */
export const canBypassPromptRequirement = (
  nodeType: string,
  inputs: Record<string, any>
): boolean => {
  const hasVisualInput =
    inputs.referenceImage ||
    inputs.videoInput ||
    inputs.characterImageId ||
    inputs.inputImageUrl;

  return nodeType === "character-input" && !!hasVisualInput;
};

/**
 * Validate entire node pipeline connectivity
 */
export const validatePipelineConnectivity = (nodes: any[], connections: any[]): string[] => {
  const errors: string[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  connections.forEach((conn) => {
    if (!nodeIds.has(conn.source)) {
      errors.push(`Source node ${conn.source} not found in pipeline`);
    }
    if (!nodeIds.has(conn.target)) {
      errors.push(`Target node ${conn.target} not found in pipeline`);
    }
  });

  return errors;
};
