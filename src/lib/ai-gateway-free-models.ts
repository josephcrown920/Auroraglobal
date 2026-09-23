export type AuroraAiModel = {
  id: string;
  label: string;
  modality: "chat" | "reasoning" | "vision" | "image" | "video-analysis";
  provider: "vercel-ai-gateway" | "openrouter" | "google-gemini" | "modelark";
  /** true only when the model has a documented zero-cost/free route. */
  free: boolean;
  /** Distinguishes provider free tiers/credits from permanently free endpoints. */
  access: "free" | "free-tier" | "free-credits" | "paid";
  notes: string;
};

/**
 * Verified free/free-tier routes from public provider catalogs.
 *
 * IMPORTANT: "free-tier" means the provider currently advertises a free
 * allowance; it can have rate limits, eligibility requirements, or change.
 * "free-credits" means ModelArk currently offers promotional/free tokens,
 * not that inference is permanently free.
 */
export const FREE_AI_MODELS: readonly AuroraAiModel[] = [
  {
    id: "poolside/laguna-s-2.1-free",
    label: "Laguna S 2.1 Free",
    modality: "reasoning",
    provider: "vercel-ai-gateway",
    free: true,
    access: "free",
    notes: "Coding and technical reasoning.",
  },
  {
    id: "zai/glm-5.3",
    label: "GLM 5.3 — Vercel free-user credits",
    modality: "reasoning",
    provider: "vercel-ai-gateway",
    free: true,
    access: "free-tier",
    notes: "Z.AI GLM 5.3; Vercel AI Gateway currently gives users who have not made a payment $5 of credits every 30 days. Not permanently free inference.",
  },
  {
    id: "zai/glm-5.3-flash",
    label: "GLM 5.3 Flash — Vercel free-user credits",
    modality: "vision",
    provider: "vercel-ai-gateway",
    free: true,
    access: "free-tier",
    notes: "Native multimodal GLM 5.3 Flash; accepts text, image and video inputs. Vercel currently gives unpaid/free users $5 of credits every 30 days.",
  },
  {
    id: "inclusionai/ling-3.0-flash-vl-free",
    label: "Ling 3.0 Flash VL Free",
    modality: "video-analysis",
    provider: "vercel-ai-gateway",
    free: true,
    access: "free",
    notes: "Text, image and video input with reasoning/tool use.",
  },
  {
    id: "inclusionai/ling-3.0-flash-fin-free",
    label: "Ling 3.0 Flash Fin Free",
    modality: "chat",
    provider: "vercel-ai-gateway",
    free: true,
    access: "free",
    notes: "Free general-purpose text model.",
  },
  {
    id: "inclusionai/ling-3.0-flash-sante-free",
    label: "Ling 3.0 Flash Sante Free",
    modality: "chat",
    provider: "vercel-ai-gateway",
    free: true,
    access: "free",
    notes: "Free Ling 3.0 Flash variant.",
  },
  {
    id: "openrouter/free",
    label: "OpenRouter Free Router",
    modality: "vision",
    provider: "openrouter",
    free: true,
    access: "free",
    notes: "Routes to an available free model; capability availability can change.",
  },
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    modality: "reasoning",
    provider: "google-gemini",
    free: true,
    access: "free-tier",
    notes: "Google Gemini API free tier; multimodal text/image/video input and reasoning.",
  },
  {
    id: "gemini-3.7-flash",
    label: "Gemini 3.7 Flash",
    modality: "reasoning",
    provider: "google-gemini",
    free: true,
    access: "free-tier",
    notes: "Google Gemini API free tier; fast multimodal reasoning and agentic tasks.",
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    modality: "vision",
    provider: "google-gemini",
    free: true,
    access: "free-tier",
    notes: "Google Gemini API free tier; multimodal image/video understanding.",
  },
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    modality: "chat",
    provider: "google-gemini",
    free: true,
    access: "free-tier",
    notes: "Google Gemini API free tier; high-throughput general tasks.",
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    modality: "vision",
    provider: "google-gemini",
    free: true,
    access: "free-tier",
    notes: "Google Gemini API free tier; efficient text/image/video processing.",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    modality: "reasoning",
    provider: "google-gemini",
    free: true,
    access: "free-tier",
    notes: "Google Gemini API currently lists free-tier input/output; complex reasoning and coding.",
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    modality: "vision",
    provider: "google-gemini",
    free: true,
    access: "free-tier",
    notes: "Google Gemini API free tier; text, image, audio and video input with thinking.",
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    modality: "vision",
    provider: "google-gemini",
    free: true,
    access: "free-tier",
    notes: "Google Gemini API free tier; lightweight multimodal processing.",
  },
  {
    id: "dola-seed-2-1-turbo",
    label: "Dola Seed 2.1 Turbo — ModelArk Free Tokens",
    modality: "chat",
    provider: "modelark",
    free: true,
    access: "free-credits",
    notes: "ModelArk free-token allowance; not permanently free inference.",
  },
  {
    id: "dola-seed-2-0-lite",
    label: "Dola Seed 2.0 Lite — ModelArk Free Tokens",
    modality: "chat",
    provider: "modelark",
    free: true,
    access: "free-credits",
    notes: "ModelArk free-token allowance; not permanently free inference.",
  },
  {
    id: "dola-seed-2-0-mini",
    label: "Dola Seed 2.0 Mini — ModelArk Free Tokens",
    modality: "chat",
    provider: "modelark",
    free: true,
    access: "free-credits",
    notes: "ModelArk free-token allowance; not permanently free inference.",
  },
  {
    id: "dola-seed-2-0-pro",
    label: "Dola Seed 2.0 Pro — ModelArk Free Tokens",
    modality: "chat",
    provider: "modelark",
    free: true,
    access: "free-credits",
    notes: "ModelArk free-token allowance; not permanently free inference.",
  },
  {
    id: "dola-seed-2-0-code",
    label: "Dola Seed 2.0 Code — ModelArk Free Tokens",
    modality: "reasoning",
    provider: "modelark",
    free: true,
    access: "free-credits",
    notes: "ModelArk free-token allowance; coding/reasoning model.",
  },
  {
    id: "bytedance-seed-1-8",
    label: "ByteDance Seed 1.8 — ModelArk Free Tokens",
    modality: "chat",
    provider: "modelark",
    free: true,
    access: "free-credits",
    notes: "Listed by ModelArk under models available with free tokens.",
  },
  {
    id: "skylark-pro",
    label: "Skylark Pro — ModelArk Free Tokens",
    modality: "chat",
    provider: "modelark",
    free: true,
    access: "free-credits",
    notes: "Listed by ModelArk under models available with free tokens.",
  },
  {
    id: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro — ModelArk Free Tokens",
    modality: "reasoning",
    provider: "modelark",
    free: true,
    access: "free-credits",
    notes: "Listed by ModelArk under models available with free tokens.",
  },
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash — ModelArk Free Tokens",
    modality: "reasoning",
    provider: "modelark",
    free: true,
    access: "free-credits",
    notes: "Listed by ModelArk under models available with free tokens.",
  },
  {
    id: "deepseek-v3-2",
    label: "DeepSeek V3.2 — ModelArk Free Tokens",
    modality: "reasoning",
    provider: "modelark",
    free: true,
    access: "free-credits",
    notes: "Listed by ModelArk under models available with free tokens.",
  },
  {
    id: "bytedance-seed-1-6",
    label: "ByteDance Seed 1.6 — ModelArk Free Tokens",
    modality: "chat",
    provider: "modelark",
    free: true,
    access: "free-credits",
    notes: "Listed by ModelArk under models available with free tokens.",
  },
  {
    id: "bytedance-seed-1-6-flash",
    label: "ByteDance Seed 1.6 Flash — ModelArk Free Tokens",
    modality: "chat",
    provider: "modelark",
    free: true,
    access: "free-credits",
    notes: "Listed by ModelArk under models available with free tokens.",
  },
  {
    id: "gpt-oss-120b",
    label: "GPT-OSS 120B — ModelArk Free Tokens",
    modality: "reasoning",
    provider: "modelark",
    free: true,
    access: "free-credits",
    notes: "Listed by ModelArk under models available with free tokens.",
  },
  {
    id: "prodia/flux-fast-schnell",
    label: "FLUX Schnell",
    modality: "image",
    provider: "vercel-ai-gateway",
    free: false,
    access: "paid",
    notes: "Low-cost image fallback; not classified as free.",
  },
];

export const FREE_CHAT_MODELS = FREE_AI_MODELS.filter(
  (model) => model.free && (model.modality === "chat" || model.modality === "reasoning"),
);

export const FREE_VISION_MODELS = FREE_AI_MODELS.filter(
  (model) => model.free && (model.modality === "vision" || model.modality === "video-analysis"),
);

export const FREE_VIDEO_ANALYSIS_MODELS = FREE_AI_MODELS.filter(
  (model) => model.free && model.modality === "video-analysis",
);

export const MODELARK_FREE_CREDIT_MODELS = FREE_AI_MODELS.filter(
  (model) => model.provider === "modelark" && model.access === "free-credits",
);
