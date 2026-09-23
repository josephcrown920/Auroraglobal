export type AuroraAiModel = {
  id: string;
  label: string;
  modality: "chat" | "reasoning" | "vision" | "image" | "video-analysis";
  provider: "vercel-ai-gateway" | "openrouter";
  free: boolean;
  notes: string;
};

/**
 * Verified free/zero-token-cost routes found in the current public catalogs.
 * Keep image/video generation separate: a free video *analysis* model is not
 * the same thing as a free video *generation* model.
 */
export const FREE_AI_MODELS: readonly AuroraAiModel[] = [
  {
    id: "poolside/laguna-s-2.1-free",
    label: "Laguna S 2.1 Free",
    modality: "reasoning",
    provider: "vercel-ai-gateway",
    free: true,
    notes: "Coding and technical reasoning.",
  },
  {
    id: "inclusionai/ling-3.0-flash-vl-free",
    label: "Ling 3.0 Flash VL Free",
    modality: "vision",
    provider: "vercel-ai-gateway",
    free: true,
    notes: "Text, image and video input with text output, reasoning and tool use.",
  },
  {
    id: "inclusionai/ling-3.0-flash-fin-free",
    label: "Ling 3.0 Flash Fin Free",
    modality: "chat",
    provider: "vercel-ai-gateway",
    free: true,
    notes: "Free general-purpose text model.",
  },
  {
    id: "inclusionai/ling-3.0-flash-sante-free",
    label: "Ling 3.0 Flash Sante Free",
    modality: "chat",
    provider: "vercel-ai-gateway",
    free: true,
    notes: "Free Ling 3.0 Flash variant.",
  },
  {
    id: "openrouter/free",
    label: "OpenRouter Free Router",
    modality: "vision",
    provider: "openrouter",
    free: true,
    notes: "Routes to an available free model and can filter for image understanding/tool support.",
  },
  {
    id: "prodia/flux-fast-schnell",
    label: "FLUX Schnell",
    modality: "image",
    provider: "vercel-ai-gateway",
    free: false,
    notes: "Not a free model; currently listed as a very-low-cost image fallback ($0.001/image).",
  },
];

export const FREE_CHAT_MODELS = FREE_AI_MODELS.filter(
  (model) => model.free && (model.modality === "chat" || model.modality === "reasoning"),
);

export const FREE_VISION_MODELS = FREE_AI_MODELS.filter(
  (model) => model.free && model.modality === "vision",
);

export const FREE_VIDEO_ANALYSIS_MODELS = FREE_AI_MODELS.filter(
  (model) => model.free && model.modality === "video-analysis" || model.id === "inclusionai/ling-3.0-flash-vl-free",
);
