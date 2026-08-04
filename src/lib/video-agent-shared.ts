// Video Agent shared client-safe copy + helpers.
// Durable project state lives in `video_agent_projects` (see
// video-agent-projects.functions.ts) — this module is only labels, style
// copy, and id helpers shared by the Video Agent routes.

export type VideoStyle = "cinematic" | "minimal" | "vibrant" | "documentary";
export type VideoVoice = "narrator-deep" | "narrator-warm" | "news-anchor" | "conversational";

export const styleLabels: Record<VideoStyle, string> = {
  cinematic: "Cinematic",
  minimal: "Minimal",
  vibrant: "Vibrant",
  documentary: "Documentary",
};

export const styleDescriptions: Record<VideoStyle, string> = {
  cinematic: "Anamorphic lenses, film grain, teal-orange grade",
  minimal: "Clean white space, subtle motion, modern typography",
  vibrant: "Bold colors, dynamic cuts, energetic pacing",
  documentary: "Natural light, handheld feel, authentic moments",
};

export const voiceLabels: Record<VideoVoice, string> = {
  "narrator-deep": "Narrator — Deep",
  "narrator-warm": "Narrator — Warm",
  "news-anchor": "News Anchor",
  conversational: "Conversational",
};

export const vaUid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
