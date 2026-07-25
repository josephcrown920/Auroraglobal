// Heuristic model + aspect-ratio selection.
// NOTE: these slugs are advisory only — they drive the human-readable "reason"
// and a rough credit estimate shown back to the caller. The actual provider is
// chosen by the app's orchestrator (orchestrator.server.ts), so we do NOT force
// these slugs onto /api/public/generate (they don't map 1:1 to its registry).

import type { VideoModel, ImageModel, AspectRatio, ModelSelection } from "./types";

const VIDEO_COSTS: Record<VideoModel, number> = {
  "kling-2.5": 100,
  "kling-2.5-turbo": 50,
  "kling-2.0": 70,
  "heygen-v2": 80,
  "wan-2.1": 30,
  "hailuo-v2": 40,
  "sora-turbo": 120,
};

const IMAGE_COSTS: Record<ImageModel, number> = {
  "kling-kolors": 8,
  "seedream-4": 6,
  "nano-banana-pro": 20,
};

const CINEMATIC_KEYWORDS = ["cinematic", "film", "professional", "premium", "high quality", "4k", "hq"];
const SPEED_KEYWORDS = ["quick", "fast", "turbo", "cheap", "budget", "draft"];
const LIPSYNC_KEYWORDS = ["talking", "speaking", "say", "lipsync", "voiceover", "narrate"];
const AMBIENT_KEYWORDS = ["loop", "ambient", "background", "cinemagraph", "subtle"];

export function selectVideoModel(prompt: string, preferred?: string): ModelSelection {
  if (preferred && preferred in VIDEO_COSTS) {
    const model = preferred as VideoModel;
    return { model, reason: `Explicit model: ${model}`, estimatedCredits: VIDEO_COSTS[model] };
  }

  const l = prompt.toLowerCase();
  if (LIPSYNC_KEYWORDS.some((k) => l.includes(k))) {
    return { model: "heygen-v2", reason: "Detected lip-sync / speech requirement", estimatedCredits: 80 };
  }
  if (CINEMATIC_KEYWORDS.some((k) => l.includes(k))) {
    return { model: "kling-2.5", reason: "Cinematic / premium quality requested", estimatedCredits: 100 };
  }
  if (SPEED_KEYWORDS.some((k) => l.includes(k))) {
    return { model: "kling-2.5-turbo", reason: "Speed / cost optimisation", estimatedCredits: 50 };
  }
  if (AMBIENT_KEYWORDS.some((k) => l.includes(k))) {
    return { model: "wan-2.1", reason: "Ambient / looping motion", estimatedCredits: 30 };
  }
  return { model: "kling-2.5-turbo", reason: "Default balanced model", estimatedCredits: 50 };
}

export function selectImageModel(prompt: string): ModelSelection {
  const l = prompt.toLowerCase();
  if (["realistic", "photo", "portrait", "skin", "natural"].some((k) => l.includes(k))) {
    return { model: "nano-banana-pro", reason: "Photorealistic output", estimatedCredits: 20 };
  }
  if (["fast", "quick", "cheap", "draft", "budget"].some((k) => l.includes(k))) {
    return { model: "seedream-4", reason: "Budget / speed option", estimatedCredits: 6 };
  }
  if (["art", "style", "creative", "illustration", "colourful"].some((k) => l.includes(k))) {
    return { model: "seedream-4", reason: "Creative / stylised output", estimatedCredits: 6 };
  }
  if (["vibrant", "colour", "color", "saturated"].some((k) => l.includes(k))) {
    return { model: "kling-kolors", reason: "Vivid colour palette", estimatedCredits: 8 };
  }
  return { model: "nano-banana-pro", reason: "Default high-quality image model", estimatedCredits: 20 };
}

export function inferAspectRatio(prompt: string): AspectRatio {
  const l = prompt.toLowerCase();
  if (l.includes("16:9") || l.includes("landscape") || l.includes("youtube")) return "16:9";
  if (l.includes("1:1") || l.includes("square")) return "1:1";
  if (l.includes("4:5") || l.includes("instagram") || l.includes("portrait")) return "4:5";
  return "9:16";
}

export { VIDEO_COSTS, IMAGE_COSTS };
