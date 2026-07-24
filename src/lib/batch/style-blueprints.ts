// Style blueprints for batch generation.
// Each blueprint is a reusable prompt suffix that locks in a visual style
// across every item in a batch run.

export type StyleBlueprint = {
  id: string;
  label: string;
  description: string;
  suffix: string;
  /** Suggested model tier for this style */
  tier?: "budget" | "standard" | "premium";
};

export const STYLE_BLUEPRINTS: readonly StyleBlueprint[] = [
  {
    id: "editorial-fashion",
    label: "Editorial Fashion",
    description: "Clean studio light, high contrast, Vogue-style framing",
    suffix:
      "Editorial fashion photography: clean white or seamless backdrop, high-contrast three-point studio lighting, Vogue-style square crop, sharp focus on the subject with no depth-of-field blur, film-grade color grade.",
    tier: "premium",
  },
  {
    id: "street-documentary",
    label: "Street Documentary",
    description: "Candid city light, natural grain, photojournalistic energy",
    suffix:
      "Street documentary photography: candid natural light, slight film grain, photojournalistic perspective at eye level, urban environment with ambient context, unposed and authentic.",
    tier: "standard",
  },
  {
    id: "cinematic-portrait",
    label: "Cinematic Portrait",
    description: "ARRI anamorphic look, shallow bokeh, dramatic mood",
    suffix:
      "Cinematic portrait: ARRI anamorphic lens flare, shallow f/1.4 bokeh background, warm Kodak color grade, dramatic three-quarter lighting with deep shadows, moody and film-like.",
    tier: "premium",
  },
  {
    id: "neon-night",
    label: "Neon Night",
    description: "Neon signage reflections, rain-slick streets, cyberpunk palette",
    suffix:
      "Neon night photography: wet pavement reflections, vibrant neon sign light (red, blue, pink, green), dark urban setting, slight lens chromatic aberration, high-ISO cinematic look.",
    tier: "standard",
  },
  {
    id: "golden-hour",
    label: "Golden Hour",
    description: "Warm outdoor backlight, sun flares, glowing skin tones",
    suffix:
      "Golden hour photography: warm backlight at sunset or sunrise, soft lens flare, glowing skin tones, gentle outdoor breeze, naturalistic and radiant mood.",
    tier: "standard",
  },
  {
    id: "high-key-minimal",
    label: "High-Key Minimal",
    description: "Bright, clean, overexposed minimalist aesthetic",
    suffix:
      "High-key minimalist photography: pure white background, slight overexposure, very clean and minimal styling, soft diffused studio light with no hard shadows.",
    tier: "budget",
  },
  {
    id: "dark-luxury",
    label: "Dark Luxury",
    description: "Black background, dramatic spotlighting, high fashion",
    suffix:
      "Dark luxury photography: pure black background, single dramatic spotlight, rich fabric textures, ultra-high-end fashion editorial look, deep contrast.",
    tier: "premium",
  },
  {
    id: "ugc-casual",
    label: "UGC Casual",
    description: "Authentic, self-shot, social-media native style",
    suffix:
      "UGC-style photography: appears self-taken or lightly staged, natural indoor or outdoor light, casual styling, slightly imperfect framing, authentic and relatable social-media native look.",
    tier: "budget",
  },
];

export function blueprintById(id: string): StyleBlueprint | undefined {
  return STYLE_BLUEPRINTS.find((b) => b.id === id);
}

/** Apply a blueprint suffix to a base prompt. */
export function applyBlueprint(basePrompt: string, blueprintId: string): string {
  const blueprint = blueprintById(blueprintId);
  if (!blueprint) return basePrompt;
  return `${basePrompt.trim()} — ${blueprint.suffix}`;
}
