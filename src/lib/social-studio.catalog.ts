export type AuroraMarketingFeature = {
  id: string;
  name: string;
  promise: string;
  proof: string;
  preview: string;
  route: string;
};

/**
 * Operator-safe capability catalogue for Aurora's own marketing.
 * Campaign generation receives these facts verbatim so social copy does not
 * invent features that the product cannot demonstrate.
 */
export const AURORA_MARKETING_FEATURES: readonly AuroraMarketingFeature[] = [
  {
    id: "studio",
    name: "Image & Video Studio",
    promise: "Direct cinematic images and short videos from a prompt and visual references.",
    proof: "Reference-led generation, image creation, image-to-video, and a persistent Gallery.",
    preview: "/nav-previews/studio.jpg",
    route: "/studio",
  },
  {
    id: "video-agent",
    name: "Video Agent",
    promise: "Turn a creative brief into a directed, multi-shot video production.",
    proof: "Conversational planning, shot generation, project state, and rendered video outputs.",
    preview: "/nav-previews/video-agent-workspace.jpg",
    route: "/agent",
  },
  {
    id: "perform-anywhere",
    name: "Perform Anywhere",
    promise: "Transform a phone-recorded performance into cinematic visual worlds.",
    proof: "A real performance clip drives the reskin rather than being replaced by generic footage.",
    preview: "/nav-previews/perform-anywhere.jpg",
    route: "/motion",
  },
  {
    id: "colors",
    name: "Colors Studio",
    promise: "Rebuild one performance across bold stages, palettes, outfits, and moods.",
    proof: "The same performance is preserved while its visual world changes.",
    preview: "/nav-previews/colors.jpg",
    route: "/colors",
  },
  {
    id: "tiktok30",
    name: "TikTok30",
    promise: "Turn one campaign idea into a coordinated month of short-form content.",
    proof: "Batch creation produces varied, downloadable campaign assets instead of one repeated post.",
    preview: "/nav-previews/spin.jpg",
    route: "/spin",
  },
  {
    id: "soul",
    name: "Aurora Soul",
    promise: "Train a reusable identity and create consistent character imagery.",
    proof: "Identity-locked training, generation, a reference library, and visual vibe matching.",
    preview: "/hero/hero-direct-identity.png",
    route: "/soul",
  },
  {
    id: "director-room",
    name: "Director's Room",
    promise: "Plan scenes, looks, shots, and production decisions in one directing workspace.",
    proof: "Moodboards, storyboard tools, shot direction, and an inspector stay inside one project.",
    preview: "/director-room/streets-performance-hero.jpeg",
    route: "/director-room",
  },
  {
    id: "custom",
    name: "Custom Aurora capability",
    promise: "Build a campaign around a newly launched or operator-supplied Aurora capability.",
    proof: "The operator's factual capability notes become the only approved source for claims.",
    preview: "/hero/hero-2.png",
    route: "/studio",
  },
] as const;

export function getAuroraMarketingFeature(id: string): AuroraMarketingFeature | undefined {
  return AURORA_MARKETING_FEATURES.find((feature) => feature.id === id);
}