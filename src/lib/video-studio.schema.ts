import { z } from "zod";

export const VIDEO_EDIT_STYLE_IDS = ["hype", "cinematic", "talking_head", "tiktok_hook"] as const;

export const VideoEditRecommendationSchema = z.object({
  style: z.enum(VIDEO_EDIT_STYLE_IDS),
  includeMusic: z.boolean(),
  reason: z.string().trim().min(1).max(500),
});

export type VideoEditRecommendation = z.infer<typeof VideoEditRecommendationSchema>;

export const VIDEO_EDITOR_SYSTEM = `You are Aurora's video editing assistant. Map the user's creative direction to settings supported by Aurora AutoCut.
Choose exactly one supported style:
- hype: fast, energetic hard cuts
- cinematic: slower pacing and crossfades
- talking_head: speaker-led pacing
- tiktok_hook: a fast hook and short-form pacing
Choose whether to include the available style-matched music bed. Never claim to trim an exact moment, add captions, keyframes, overlays, or make any edit the available renderer cannot do.
Return a concise reason that clearly describes the supported settings you selected. Return only data matching the requested schema.`;

export function buildVideoEditorPrompt(brief: string, clipCount: number): string {
  return `The user has ${clipCount} uploaded video clip(s), arranged in the order they want.

CREATIVE DIRECTION:
${brief}

Recommend the closest supported AutoCut style and whether to add its style-matched music. The renderer concatenates clips in the supplied order and applies that style; it does not apply arbitrary prompt edits to individual clips.`;
}
