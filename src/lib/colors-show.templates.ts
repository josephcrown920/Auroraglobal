import { COLOR_PRESETS, REALISM_SUFFIX } from "@/lib/colors.presets";
import { computeCost } from "@/lib/pricing";

export const COLORS_SHOW_COST_PER_SHOT = computeCost({ features: ["image"] }).total;

export type ColorsShowShot = {
  id: string;
  label: string;
  description: string;
  framingPrompt: string;
};

export const COLORS_SHOW_SHOTS: ColorsShowShot[] = [
  {
    id: "wide",
    label: "Wide Full Body",
    description: "Head-to-toe in the studio set",
    framingPrompt:
      "Full-body performance shot, head to toe, subject centered, wide negative space around the subject, vertical 9:16 framing.",
  },
  {
    id: "closeup",
    label: "Beauty Close-Up",
    description: "Shoulders-up beauty crop",
    framingPrompt:
      "Intimate beauty close-up, framed from upper chest to crown, face fills the frame, background softly bokeh'd, 85mm portrait lens feel.",
  },
];

export const OUTFIT_OPTIONS = [
  {
    id: "match",
    label: "Match my upload",
    description: "Keep the exact outfit from my reference photo",
  },
  {
    id: "stage",
    label: "Stage-ready",
    description: "Elevated performance outfit — bold, camera-ready",
  },
  {
    id: "streetwear",
    label: "Streetwear",
    description: "Oversized hoodie, fresh sneakers, relaxed but stylish",
  },
  {
    id: "formal",
    label: "Sharp & Formal",
    description: "Tailored suit or formal wear, polished and powerful",
  },
  {
    id: "custom",
    label: "Custom…",
    description: "Type your own outfit description",
  },
] as const;

export const ENERGY_OPTIONS = [
  {
    id: "auto",
    label: "Auto (from color)",
    description: "Use the energy this color was designed for",
  },
  {
    id: "ballad",
    label: "Slow Ballad",
    description: "Still, contemplative power",
  },
  {
    id: "hype",
    label: "High Hype",
    description: "Explosive energy, mid-verse peak",
  },
  {
    id: "anthem",
    label: "Anthem",
    description: "Raised chin, hero pose, crowd moment",
  },
  {
    id: "brooding",
    label: "Brooding",
    description: "Dark, cinematic, introspective",
  },
] as const;

export const COLORS_SHOW_STEPS = [
  {
    id: "portrait",
    title: "Your Portrait",
    subtitle: "Upload a clear front-facing photo",
  },
  {
    id: "color",
    title: "Color Theme",
    subtitle: "Choose your signature studio color",
  },
  {
    id: "outfit",
    title: "Your Look",
    subtitle: "What are you wearing in the shoot?",
  },
  {
    id: "shots",
    title: "Shot Types",
    subtitle: "Choose which angles to generate",
  },
  {
    id: "energy",
    title: "Stage Energy",
    subtitle: "Set the vibe and performance feel",
  },
  {
    id: "title",
    title: "Song Title",
    subtitle: "Optional — brand the shoot with your track name",
  },
  {
    id: "review",
    title: "Review & Generate",
    subtitle: "Everything looks good? Let's shoot.",
  },
] as const;

export type ColorsShowStep = (typeof COLORS_SHOW_STEPS)[number]["id"];

export type ColorsShowConfig = {
  portraitUrl: string | null;
  colorId: string;
  outfitOption: string;
  customOutfit: string;
  selectedShots: string[];
  energyOption: string;
  songTitle: string;
};

export const DEFAULT_COLORS_SHOW_CONFIG: ColorsShowConfig = {
  portraitUrl: null,
  colorId: "hot-pink",
  outfitOption: "match",
  customOutfit: "",
  selectedShots: ["wide", "closeup"],
  energyOption: "auto",
  songTitle: "",
};

function outfitInstruction(option: string, custom: string): string {
  if (option === "stage")
    return "Dress the subject in an elevated stage-ready performance outfit: bold colors, fitted silhouette, camera-ready energy.";
  if (option === "streetwear")
    return "Dress the subject in clean streetwear: oversized hoodie or graphic tee, fresh sneakers, relaxed but stylish.";
  if (option === "formal")
    return "Dress the subject in a sharply tailored suit or formal wear — polished, minimal, powerful.";
  if (option === "custom" && custom.trim())
    return `Dress the subject in: ${custom.trim()}.`;
  return "Keep the exact outfit worn in the reference photo — reproduce it faithfully.";
}

function energyInstruction(colorId: string, energyOption: string): string {
  if (energyOption === "auto") {
    const color = COLOR_PRESETS.find((c) => c.id === colorId);
    if (color)
      return `Energy and performance stance: ${color.performance.energy}. Pose: ${color.performance.pose}.`;
  }
  const MAP: Record<string, string> = {
    ballad:
      "Still, contemplative power — standing centered, chin slightly down, eyes closed or half-closed, both hands loosely at sides.",
    hype:
      "Explosive high-energy mid-verse peak — mid-stride, one arm raised, leaning into the mic, eyes wide open.",
    anthem:
      "Anthemic hero pose — chest open, chin raised, one fist lightly clenched, crowd-moment energy.",
    brooding:
      "Dark brooding stance — back slightly turned to camera, looking over one shoulder at the lens, one side of face in deep shadow.",
  };
  return MAP[energyOption] ?? MAP["ballad"];
}

export function buildColorsShowPrompt(
  config: ColorsShowConfig,
  shot: ColorsShowShot,
): string {
  const color = COLOR_PRESETS.find((c) => c.id === config.colorId) ?? COLOR_PRESETS[0];

  const parts: string[] = [
    "You are an AI performance compositor. Place the REAL person from the reference photo into the studio scene below and render one photoreal performance still.",
    `IDENTITY LOCK: preserve the subject's exact face, skin tone, hairstyle, facial hair, and body proportions from the reference photo. Never alter their identity or appearance.`,
    `OUTFIT: ${outfitInstruction(config.outfitOption, config.customOutfit)}`,
    `SCENE LOCK — reproduce this studio exactly: ${color.studioTemplate}`,
    `LIGHTING: ${color.promptName} lighting tone — background reflections and shadows all graded to match the color theme.`,
    `PERFORMANCE STANCE: ${energyInstruction(config.colorId, config.energyOption)}`,
    `CAMERA & FRAMING: ${shot.framingPrompt} Locked tripod, cinematic quality, gentle depth of field.`,
  ];

  if (config.songTitle.trim()) {
    parts.push(
      `SHOOT CONTEXT: This is a promo shoot for the track titled "${config.songTitle.trim()}".`,
    );
  }

  parts.push(REALISM_SUFFIX);

  return parts.join("\n\n");
}
