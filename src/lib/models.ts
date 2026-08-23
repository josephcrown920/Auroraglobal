import { Banana, Sparkles, Flame, Zap, Film, Wand2, Cloud, Crown, Layers, Image as ImageIcon, Cpu } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ModelMeta = {
  value: string;
  label: string;
  short: string;
  group: "Lovable AI" | "Replicate" | "BytePlus" | "Sync" | "Self-hosted" | "Replit";
  icon: LucideIcon;
  color: string;
  bg: string;
  tagline: string;
  status?: "live" | "preview";
  category: "image" | "video" | "lipsync" | "text" | "audio";
  /** Real backend endpoint we route to. */
  endpoint: string;
};

// IMAGE MODELS (selectable in studio)
export const MODEL_LIST: ModelMeta[] = [
  {
    value: "google/nano-banana",
    endpoint: "google/nano-banana",
    label: "Nano Banana",
    short: "Banana",
    group: "Replicate",
    icon: Banana,
    color: "text-yellow-500",
    bg: "bg-yellow-500/15 border-yellow-500/30",
    tagline: "Gemini 2.5 Flash image · great character lock",
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
    status: "live",
    category: "image",
  },
  {
    value: "fal-ai/seedream-5",
    // BytePlus-direct only (see BYTEPLUS_DEFAULTS in orchestrator.server.ts).
    // The internal value stays fal-ai/seedream-5 for backwards compatibility
    // with saved preferences and existing server callers.
    endpoint: "byteplus/seedream-5.0-pro",
    label: "Seedream 5.0 Pro",
    short: "Seedream 5 Pro",
    group: "BytePlus",
    icon: Flame,
    color: "text-fuchsia-400",
    bg: "bg-fuchsia-500/15 border-fuchsia-500/30",
    tagline: "Newest ByteDance image model · sharpest detail yet",
    status: "live",
    category: "image",
  },
];

// VIDEO MODELS (selectable for image-to-video)
export const VIDEO_MODEL_LIST: ModelMeta[] = [
  {
    value: "seedance-2.0-fast",
    endpoint: "fal-ai/bytedance/seedance/v1/pro/image-to-video",
    label: "Seedance 2.0 Fast",
    short: "Seedance Fast",
    group: "Replicate",
    icon: Film,
    color: "text-violet-300",
    bg: "bg-violet-500/10 border-violet-500/25",
    tagline: "Cheapest · quick previews & everyday shots",
    status: "live",
    category: "video",
  },
  {
    value: "seedance-2.0",
    endpoint: "fal-ai/bytedance/seedance/v1/pro/image-to-video",
    label: "Seedance 2.0",
    short: "Seedance 2.0",
    group: "Replicate",
    icon: Film,
    color: "text-violet-400",
    bg: "bg-violet-500/15 border-violet-500/30",
    tagline: "Premium · cinematic motion + character consistency",
    status: "live",
    category: "video",
  },
  {
    value: "seedance-3.0",
    endpoint: "byteplus/seedance-1.5-pro",
    label: "Seedance 1.5 Pro",
    short: "Seedance 1.5 Pro",
    group: "BytePlus",
    icon: Film,
    color: "text-violet-500",
    bg: "bg-violet-600/15 border-violet-600/30",
    tagline: "High-fidelity motion · cinematic detail",
    status: "live",
    category: "video",
    // BytePlus-direct only (see BYTEPLUS_DEFAULTS in orchestrator.server.ts).
    // The internal value stays seedance-3.0 for backwards compatibility with
    // saved preferences and existing server callers.
  },
  {
    value: "seedance-2.5",
    // Two real routes (routing keys off `value`, endpoint is display/index —
    // must stay UNIQUE for the ALL[m.endpoint] index):
    //   1. fal.ai bytedance/seedance-2.5/{image,text}-to-video (FAL_MAP) —
    //      verified in the fal catalog 2026-08-08, tried first in the chain.
    //   2. BytePlus/ModelArk dreamina-seedance-2-5-260628 (BYTEPLUS_MAP) —
    //      cheaper direct route, still needs Ark Console activation.
    endpoint: "bytedance/seedance-2.5/image-to-video",
    label: "Seedance 2.5",
    short: "Seedance 2.5",
    group: "Replicate",
    icon: Film,
    color: "text-fuchsia-400",
    bg: "bg-fuchsia-500/15 border-fuchsia-500/30",
    tagline: "ByteDance's newest · 30s scenes with native audio",
    // "preview" (same pattern as kling-3.0-omni): fully wired end-to-end on
    // BOTH routes, but neither can complete a render today —
    //   • fal route: FAL_KEY balance is $0 (403 "Exhausted balance")
    //   • BytePlus route: ModelNotOpen — needs Ark Console activation
    //     (2026-08-04 probe confirmed the slug itself is real)
    // Promote to "live" after topping up fal.ai OR activating in Ark Console,
    // plus one verified render (the model-watch cron probes the Ark slug and
    // emails when it flips callable).
    status: "preview",
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
    // Matches the real dispatched slug (REPLICATE_MAP in orchestrator.server.ts).
    // Was previously a copy-pasted duplicate of kling-3.0's fal-style endpoint,
    // which collided in the endpoint->meta index (ALL[m.endpoint]).
    endpoint: "kwaivgi/kling-v2.1-master",
    label: "Kling 3.0 Omni",
    short: "Kling Omni",
    group: "Replicate",
    icon: Layers,
    color: "text-teal-400",
    bg: "bg-teal-500/15 border-teal-500/30",
    tagline: "Omni-modal storytelling",
    // Left as "preview" (Task #244): confirmed kwaivgi/kling-v2.1-master is a
    // real, distinct Replicate model ("premium version of Kling v2.1...
    // superb dynamics") from kwaivgi/kling-v2.1 (kling-3.0) via the Replicate
    // models API, and it's now fully wired into fallback/priority routing —
    // but a live end-to-end render could NOT be verified because the
    // Replicate account currently has zero credit (confirmed account-wide:
    // even some models 402 with "Insufficient credit".
    // Promote to "live" once a real render completes after credit is added.
    status: "preview",
    category: "video",
  },
  {
    value: "veo-3-fast",
    endpoint: "google/veo-3-fast",
    label: "Veo 3 Fast",
    short: "Veo Fast",
    group: "Replicate",
    icon: Zap,
    color: "text-blue-400",
    bg: "bg-blue-500/15 border-blue-500/30",
    tagline: "Google Veo 3 · fast, with native audio",
    status: "live",
    category: "video",
  },
  {
    value: "veo-3",
    endpoint: "google/veo-3",
    label: "Veo 3",
    short: "Veo 3",
    group: "Replicate",
    icon: Crown,
    color: "text-blue-300",
    bg: "bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border-blue-400/40",
    tagline: "Google Veo 3 · top-tier cinematic quality",
    status: "live",
    category: "video",
  },
  {
    value: "sora-2",
    endpoint: "openai/sora-2",
    label: "Sora 2",
    short: "Sora",
    group: "Replicate",
    icon: Flame,
    color: "text-orange-400",
    bg: "bg-orange-500/15 border-orange-500/30",
    tagline: "OpenAI Sora 2 · physical realism & audio",
    status: "live",
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

export const LATENTSYNC_MODEL: ModelMeta = {
  value: "latentsync",
  endpoint: "latentsync",
  label: "LatentSync (self-hosted)",
  short: "LatentSync",
  group: "Self-hosted",
  icon: Cpu,
  color: "text-sky-400",
  bg: "bg-sky-500/15 border-sky-500/30",
  tagline: "Runs on your registered GPU worker · no hosted API",
  status: "live",
  category: "lipsync",
};

export const LIPSYNC_MODEL_LIST: ModelMeta[] = [LIPSYNC_MODEL, WAV2LIP_MODEL, LATENTSYNC_MODEL];

// REPLIT-BILLED MODELS (auto-selected server-side via orchestrator.server.ts's
// Replit-first priority chain — NOT user-pickable, so intentionally excluded
// from MODEL_LIST/VIDEO_MODEL_LIST/LIPSYNC_MODEL_LIST. Only exists so
// getModelMeta()/ModelBadge can show a real name+icon instead of the generic
// "Unknown" fallback in the generation history list.
export const REPLIT_MODEL_LIST: ModelMeta[] = [
  {
    value: "replit/gemini-2.5-flash-image",
    endpoint: "replit/gemini-2.5-flash-image",
    label: "Nano Banana (Replit)",
    short: "Nano Banana",
    group: "Replit",
    icon: Banana,
    color: "text-violet-300",
    bg: "bg-violet-500/15 border-violet-500/30",
    tagline: "Gemini 2.5 Flash image · billed to Replit credits",
    status: "live",
    category: "image",
  },
  {
    value: "replit/gpt-image-1",
    endpoint: "replit/gpt-image-1",
    label: "GPT Image 1 (Replit)",
    short: "GPT Image",
    group: "Replit",
    icon: ImageIcon,
    color: "text-violet-300",
    bg: "bg-violet-500/15 border-violet-500/30",
    tagline: "OpenAI image gen · billed to Replit credits",
    status: "live",
    category: "image",
  },
  {
    value: "replit/gpt-5-nano",
    endpoint: "replit/gpt-5-nano",
    label: "GPT-5 Nano (Replit)",
    short: "GPT-5 Nano",
    group: "Replit",
    icon: Zap,
    color: "text-violet-300",
    bg: "bg-violet-500/15 border-violet-500/30",
    tagline: "Fast OpenAI text · billed to Replit credits",
    status: "live",
    category: "text",
  },
  {
    value: "replit/gemini-2.5-flash",
    endpoint: "replit/gemini-2.5-flash",
    label: "Gemini 2.5 Flash (Replit)",
    short: "Gemini Flash",
    group: "Replit",
    icon: Sparkles,
    color: "text-violet-300",
    bg: "bg-violet-500/15 border-violet-500/30",
    tagline: "Gemini text · billed to Replit credits",
    status: "live",
    category: "text",
  },
  {
    value: "replit/gpt-audio-mini",
    endpoint: "replit/gpt-audio-mini",
    label: "GPT Audio Mini (Replit)",
    short: "GPT Audio",
    group: "Replit",
    icon: Wand2,
    color: "text-violet-300",
    bg: "bg-violet-500/15 border-violet-500/30",
    tagline: "OpenAI TTS · billed to Replit credits",
    status: "live",
    category: "audio",
  },
];

const ALL: Record<string, ModelMeta> = Object.fromEntries(
  [...MODEL_LIST, ...VIDEO_MODEL_LIST, ...LIPSYNC_MODEL_LIST, ...REPLIT_MODEL_LIST].map((m) => [
    m.value,
    m,
  ]),
);

// Also index by raw endpoint (for legacy rows stored with endpoint string)
[...MODEL_LIST, ...VIDEO_MODEL_LIST, ...LIPSYNC_MODEL_LIST, ...REPLIT_MODEL_LIST].forEach((m) => {
  if (!ALL[m.endpoint]) ALL[m.endpoint] = m;
});

// ── Auto-select sentinels ─────────────────────────────────────────────────────
// When users choose "Auto" in Canvas the system resolves these to a real model
// at run time based on priority: best = highest quality, cheapest = lowest cost.

export const AUTO_BEST = "auto:best";
export const AUTO_CHEAPEST = "auto:cheapest";

export const AUTO_MODEL_OPTIONS = [
  { value: AUTO_BEST,     label: "✦ Auto · Best Quality",  desc: "System picks the highest-quality active model" },
  { value: AUTO_CHEAPEST, label: "✦ Auto · Cheapest",       desc: "System picks the fastest, lowest-cost model" },
] as const;

/** Resolve an auto-sentinel (or any real value) to a concrete model key. */
export function resolveAutoModel(
  value: string | undefined | null,
  category: "image" | "video" | "lipsync",
): string {
  if (value === AUTO_BEST) {
    if (category === "image")   return "google/gemini-3-pro-image-preview"; // Nano Banana Pro
    if (category === "video")   return "seedance-3.0";                       // Seedance 3.0 — best motion
    if (category === "lipsync") return "fal-ai/sync-lipsync/v2";             // Sync 1.9 premium
  }
  if (value === AUTO_CHEAPEST) {
    if (category === "image")   return "fal-ai/seedream-4";                   // Seedream 4 — cheapest approved tier
    if (category === "video")   return "seedance-2.0-fast";                  // Seedance Fast — cheapest
    if (category === "lipsync") return "fal-ai/wav2lip";                     // Wav2Lip — fast & cheap
  }
  return value ?? "";
}

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

export function resolveImageEndpoint(value: string): {
  endpoint: string;
  provider: "lovable" | "replicate" | "byteplus" | "replit";
} {
  const m = ALL[value];
  if (m && m.category === "image") {
    const provider =
      m.group === "Lovable AI" ? "lovable" :
      m.group === "BytePlus" ? "byteplus" :
      m.group === "Replit" ? "replit" : "replicate";
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
  { name: "Veo 3", tag: "Video · Cinematic", glow: "from-blue-500/40 to-indigo-500/20", kind: "video", status: "LIVE" },
  { name: "Sora 2", tag: "Video · Premium", glow: "from-orange-500/40 to-amber-500/20", kind: "video", status: "LIVE" },
  { name: "Grok Imagine", tag: "Video · xAI", glow: "from-fuchsia-500/40 to-purple-500/20", kind: "video", status: "LIVE" },
];
