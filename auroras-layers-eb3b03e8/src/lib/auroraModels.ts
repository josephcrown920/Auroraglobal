export const IMAGE_MODELS = [
  { id: "google/gemini-3-pro-image", label: "Nano Banana Pro", note: "Best reference editing", available: true },
  { id: "google/gemini-3.1-flash-image", label: "Nano Banana 2", note: "Fast reference editing", available: true },
  { id: "openai/gpt-image-2", label: "GPT Image 2", note: "High-detail image editing", available: true },
  { id: "seedream/5.0", label: "Seedream 5.0", note: "Connector required", available: false },
  { id: "xai/grok-imagine", label: "Grok Imagine", note: "Connector required", available: false },
] as const;

export const VIDEO_MODELS = [
  { id: "google/veo-3.1-lite", label: "Veo 3.1 Lite", note: "Fast image-to-video", available: true },
  { id: "google/veo-3.1-fast", label: "Veo 3.1 Fast", note: "Higher motion quality", available: true },
  { id: "google/veo-3.1", label: "Veo 3.1", note: "Maximum quality", available: true },
  { id: "seedance/2.5", label: "Seedance 2.5", note: "Connector required", available: false },
  { id: "kling/omni", label: "Kling Omni", note: "Connector required", available: false },
  { id: "wan/2", label: "Wan 2", note: "Connector required", available: false },
  { id: "wan/1", label: "Wan 1", note: "Connector required", available: false },
] as const;

export const BRAIN_MODELS = [
  { id: "google/gemini-3.7-flash", label: "Gemini Director", note: "Fast cinematic direction", available: true },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini Pro Brain", note: "Deep visual reasoning", available: true },
  { id: "openai/gpt-5.5", label: "Synthetic Council", note: "Premium story intelligence", available: true },
  { id: "deepseek/reasoner", label: "DeepSeek", note: "Connector required", available: false },
  { id: "anthropic/claude", label: "Claude", note: "Connector required", available: false },
] as const;

export const DEFAULT_IMAGE_MODEL = IMAGE_MODELS[0].id;
export const DEFAULT_VIDEO_MODEL = VIDEO_MODELS[0].id;
export const DEFAULT_BRAIN_MODEL = BRAIN_MODELS[0].id;