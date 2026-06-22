import { Banana, Sparkles, Flame, Zap, Film, Wand2, Cloud, Crown, Layers, Image as ImageIcon, Cpu } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ModelMeta = {
  value: string;
  label: string;
  short: string;
  group: "Lovable AI" | "Replicate" | "Hugging Face" | "Sync";
  icon: LucideIcon;
  color: string;
  bg: string;
  tagline: string;
  status?: "live" | "preview";
  category: "image" | "video" | "lipsync";
  /** Real backend endpoint we route to. */
  endpoint: string;
};

// IMAGE MODELS (selectable in studio)
export const MODEL_LIST: ModelMeta[] = [
  {
    value: "google/gemini-2.5-flash-image",
    endpoint: "google/gemini-2.5-flash-image",
    label: "Nano Banana",
    short: "Banana",
    group: "Lovable AI",
    icon: Banana,
    color: "text-yellow-500",
    bg: "bg-yellow-500/15 border-yellow-500/30",
    tagline: "Fast, free, great character lock",
    status: "live",
    category: "image",
  },
  {
    value: "google/gemini-3.1-flash-image-preview",
    endpoint: "google/gemini-3.1-flash-image-preview",
    label: "Nano Banana 2",
    short: "Banana 2",
    group: "Lovable AI",
    icon: Banana,
    color: "text-amber-400",
    bg: "bg-amber-500/15 border-amber-500/30",
    tagline: "Sharper edges, better text rendering",
    status: "live",
    category: "image",
  },
  {
    value: "google/gemini-3-pro-image-preview",
    endpoint: "google/gemini-3-pro-image-preview",
    label: "Nano Banana Pro",
    short: "Banana Pro",
    group: "Lovable AI",
    icon: Crown,
    color: "text-amber-300",
    bg: "bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border-amber-400/40",
    tagline: "Highest quality detail & lighting",
    status: "live",
    category: "image",
  },
  {
    value: "fal-ai/seedream-4",
    endpoint: "fal-ai/bytedance/seedream/v4/edit",
    label: "Seedream 4",
    short: "Seedream",
    group: "Replicate",
    icon: Flame,
    color: "text-rose-400",
    bg: "bg-rose-500/15 border-rose-500/30",
    tagline: "Cinematic ByteDance edit model",
    status: "live",
    category: "image",
  },
  {
    value: "fal-ai/seedream-4.5",
    endpoint: "fal-ai/bytedance/seedream/v4/edit",
    label: "Seedream 4.5",
    short: "Seedream 4.5",
    group: "Replicate",
    icon: Flame,
    color: "text-pink-400",
    bg: "bg-pink-500/15 border-pink-500/30",
    tagline: "Refined cinematic edits, sharper",
    status: "preview",
    category: "image",
  },
  {
    value: "hf/flux-schnell",
    endpoint: "black-forest-labs/FLUX.1-schnell",
    label: "FLUX.1 Schnell",
    short: "FLUX",
    group: "Hugging Face",
    icon: Cpu,
    color: "text-sky-400",
    bg: "bg-sky-500/15 border-sky-500/30",
    tagline: "Open-source, fast, free tier via HF",
    status: "live",
    category: "image",
  },
  {
    value: "hf/sdxl",
    endpoint: "stabilityai/stable-diffusion-xl-base-1.0",
    label: "SDXL Base",
    short: "SDXL",
    group: "Hugging Face",
    icon: Cpu,
    color: "text-indigo-400",
    bg: "bg-indigo-500/15 border-indigo-500/30",
    tagline: "Stable Diffusion XL · classic open model",
    status: "live",
    category: "image",
  },
];

// VIDEO MODELS (selectable for image-to-video)
export const VIDEO_MODEL_LIST: ModelMeta[] = [
  {
    value: "seedance-2.0",
    endpoint: "fal-ai/bytedance/seedance/v1/pro/image-to-video",
    label: "Seedance 2.0",
    short: "Seedance 2.0",
    group: "Replicate",
    icon: Film,
    color: "text-violet-400",
    bg: "bg-violet-500/15 border-violet-500/30",
    tagline: "Cinematic motion + character consistency",
    status: "live",
    category: "video",
  },
  {
    value: "seedance-2.0-fast",
    endpoint: "fal-ai/bytedance/seedance/v1/pro/image-to-video",
    label: "Seedance 2.0 Fast",
    short: "Seedance Fast",
    group: "Replicate",
    icon: Film,
    color: "text-violet-300",
    bg: "bg-violet-500/10 border-violet-500/25",
    tagline: "Speed-tuned Seedance, quick previews",
    status: "live",
    category: "video",
  },
  {
    value: "kling-3.0",
    endpoint: "fal-ai/kling-video/v2.1/master/image-to-video",
    label: "Kling 3.0",
    short: "Kling 3.0",
    group: "Replicate",
    icon: Cloud,
    color: "text-cyan-400",
    bg: "bg-cyan-500/15 border-cyan-500/30",
    tagline: "Smooth narrative motion, multi-shot",
    status: "live",
    category: "video",
  },
  {
    value: "kling-3.0-omni",
    endpoint: "fal-ai/kling-video/v2.1/master/image-to-video",
    label: "Kling 3.0 Omni",
    short: "Kling Omni",
    group: "Replicate",
    icon: Layers,
    color: "text-teal-400",
    bg: "bg-teal-500/15 border-teal-500/30",
    tagline: "Omni-modal storytelling",
    status: "preview",
    category: "video",
  },
];

export const LIPSYNC_MODEL: ModelMeta = {
  value: "fal-ai/sync-lipsync/v2",
  endpoint: "fal-ai/sync-lipsync/v2",
  label: "Sync 1.9 Lipsync",
  short: "Sync",
  group: "Sync",
  icon: Wand2,
  color: "text-emerald-400",
  bg: "bg-emerald-500/15 border-emerald-500/30",
  tagline: "Audio → lip-sync video",
  status: "live",
  category: "lipsync",
};

export const WAV2LIP_MODEL: ModelMeta = {
  value: "fal-ai/wav2lip",
  endpoint: "fal-ai/wav2lip",
  label: "Wav2Lip",
  short: "Wav2Lip",
  group: "Replicate",
  icon: Wand2,
  color: "text-lime-400",
  bg: "bg-lime-500/15 border-lime-500/30",
  tagline: "Classic GAN lip-sync · fast & cheap",
  status: "live",
  category: "lipsync",
};

export const LIPSYNC_MODEL_LIST: ModelMeta[] = [LIPSYNC_MODEL, WAV2LIP_MODEL];

const ALL: Record<string, ModelMeta> = Object.fromEntries(
  [...MODEL_LIST, ...VIDEO_MODEL_LIST, ...LIPSYNC_MODEL_LIST].map((m) => [m.value, m]),
);

// Also index by raw endpoint (for legacy rows stored with endpoint string)
[...MODEL_LIST, ...VIDEO_MODEL_LIST, ...LIPSYNC_MODEL_LIST].forEach((m) => {
  if (!ALL[m.endpoint]) ALL[m.endpoint] = m;
});

export function getModelMeta(value?: string | null): ModelMeta {
  if (value && ALL[value]) return ALL[value];
  return {
    value: value ?? "unknown",
    endpoint: value ?? "unknown",
    label: value ?? "Unknown",
    short: "AI",
    group: "Lovable AI",
    icon: Zap,
    color: "text-muted-foreground",
    bg: "bg-muted/40 border-border",
    tagline: "",
    category: "image",
  };
}

export function resolveImageEndpoint(value: string): { endpoint: string; provider: "lovable" | "replicate" | "huggingface" } {
  const m = ALL[value];
  if (m && m.category === "image") {
    const provider =
      m.group === "Lovable AI" ? "lovable" :
      m.group === "Hugging Face" ? "huggingface" : "replicate";
    return { endpoint: m.endpoint, provider };
  }
  return { endpoint: "google/gemini-2.5-flash-image", provider: "lovable" };
}

export function resolveVideoEndpoint(value: string): string {
  const m = ALL[value];
  if (m && m.category === "video") return m.endpoint;
  return "fal-ai/bytedance/seedance/v1/pro/image-to-video";
}

// Marketing-only list used on the landing page (matches Magnific-style display)
export type ShowcaseKind = "video" | "image" | "lipsync" | "soon";
export const SHOWCASE_MODELS: {
  name: string; tag: string; glow: string; kind: ShowcaseKind; status?: "LIVE" | "SOON";
}[] = [
  { name: "Seedance 2.0", tag: "Video · Core", glow: "from-violet-500/40 to-fuchsia-500/20", kind: "video", status: "LIVE" },
  { name: "Kling 3.0", tag: "Video · Narrative", glow: "from-cyan-500/40 to-blue-500/20", kind: "video", status: "LIVE" },
  { name: "Nano Banana Pro", tag: "Image · Premium", glow: "from-amber-400/40 to-yellow-500/20", kind: "image", status: "LIVE" },
  { name: "Nano Banana 2", tag: "Image · Fast", glow: "from-amber-500/40 to-orange-500/20", kind: "image", status: "LIVE" },
  { name: "Seedream 4.5", tag: "Image · Cinematic", glow: "from-pink-500/40 to-rose-500/20", kind: "image", status: "LIVE" },
  { name: "Sync 1.9", tag: "Lip-sync", glow: "from-emerald-500/40 to-teal-500/20", kind: "lipsync", status: "LIVE" },
  { name: "Runway Gen 4.5", tag: "Video · Coming soon", glow: "from-slate-500/20 to-zinc-500/10", kind: "soon", status: "SOON" },
  { name: "GPT Image 1.5", tag: "Image · Coming soon", glow: "from-blue-500/20 to-indigo-500/10", kind: "soon", status: "SOON" },
];
