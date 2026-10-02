import { VIDEO_EFFECTS, type VideoEffectDefinition } from "./video-effects-registry";

export type ProductionPreset = {
  id: string;
  label: string;
  category: "cinematic" | "music-video" | "social" | "performance" | "documentary";
  description: string;
  effects: Array<{ effectId: string; overrides?: Record<string, number | string | boolean> }>;
  editRules: string[];
};

export const PRODUCTION_PRESETS: readonly ProductionPreset[] = [
  {
    id: "cinematic-editorial",
    label: "Cinematic Editorial",
    category: "cinematic",
    description: "Controlled lens softness, restrained movement and premium editorial contrast.",
    effects: [{ effectId: "diffusion", overrides: { amount: 0.16 } }, { effectId: "bloom", overrides: { intensity: 0.18 } }, { effectId: "vignette", overrides: { amount: 0.2 } }],
    editRules: ["Prefer 24/35/50mm visual language.", "Use measured pacing.", "Avoid stacking more than three optical effects."],
  },
  {
    id: "music-video-maximal",
    label: "Music Video Maximal",
    category: "music-video",
    description: "Beat-driven movement, flashes, RGB separation and neon energy.",
    effects: [{ effectId: "speed_ramp" }, { effectId: "flash" }, { effectId: "rgb_split" }, { effectId: "neon_glow" }],
    editRules: ["Cut on musical accents.", "Use flashes sparingly.", "Keep identity continuity locked."],
  },
  {
    id: "retro-vhs",
    label: "Retro VHS",
    category: "music-video",
    description: "Analog tape texture with controlled chromatic drift.",
    effects: [{ effectId: "vhs" }, { effectId: "chromatic_aberration" }, { effectId: "film_grain" }],
    editRules: ["Keep degradation consistent across a sequence.", "Do not combine with heavy sharpen."],
  },
  {
    id: "noir-night",
    label: "Noir Night",
    category: "cinematic",
    description: "Graphic monochrome night treatment with focused contrast.",
    effects: [{ effectId: "noir" }, { effectId: "vignette" }, { effectId: "diffusion" }],
    editRules: ["Protect skin detail.", "Use negative fill and practical-light direction in prompts."],
  },
  {
    id: "viral-hook",
    label: "Viral Hook",
    category: "social",
    description: "Fast opening, punchy movement and social-safe framing.",
    effects: [{ effectId: "camera_push" }, { effectId: "speed_ramp" }, { effectId: "flash" }],
    editRules: ["Deliver the visual hook immediately.", "Default to 9:16.", "Keep text-safe areas clear."],
  },
  {
    id: "performance-hero",
    label: "Performance Hero",
    category: "performance",
    description: "Clean performance image with subtle movement and identity protection.",
    effects: [{ effectId: "camera_push" }, { effectId: "diffusion" }, { effectId: "vignette" }],
    editRules: ["Preserve face, wardrobe and jewelry.", "Favor slow camera movement.", "Do not over-process skin."],
  },
  {
    id: "documentary-real",
    label: "Documentary Real",
    category: "documentary",
    description: "Natural texture and restrained optical treatment.",
    effects: [{ effectId: "film_grain", overrides: { amount: 0.08 } }, { effectId: "sharpen", overrides: { amount: 0.08 } }],
    editRules: ["Prefer natural light.", "Allow imperfect handheld motion.", "Avoid stylized transitions."],
  },
] as const;

export function getProductionPreset(id: string) {
  return PRODUCTION_PRESETS.find((preset) => preset.id === id);
}

export function expandPreset(id: string): Array<{ effect: VideoEffectDefinition; overrides?: Record<string, number | string | boolean> }> {
  const preset = getProductionPreset(id);
  if (!preset) return [];
  return preset.effects
    .map((entry) => {
      const effect = requireEffect(entry.effectId);
      return effect ? { effect, overrides: entry.overrides } : null;
    })
    .filter((value): value is { effect: VideoEffectDefinition; overrides?: Record<string, number | string | boolean> } => Boolean(value));
}

function requireEffect(id: string) {
  return VIDEO_EFFECTS.find((effect) => effect.id === id);
}
