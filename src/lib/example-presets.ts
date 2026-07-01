export type ToolPreset = {
  id: string;
  label: string;
  emoji: string;
  hint: string;
  prompt?: string;
  extra?: Record<string, string | number | boolean>;
};

export const STUDIO_EXAMPLE_PRESETS: ToolPreset[] = [
  {
    id: "neon-street",
    label: "Neon Street",
    emoji: "🌃",
    hint: "Cinematic night shot",
    prompt:
      "Cinematic night street performance, neon purple and pink reflections, rain-soaked pavement, motion blur background, professional cinematic still, moody atmospheric lighting",
  },
  {
    id: "editorial",
    label: "Editorial",
    emoji: "📸",
    hint: "Magazine cover look",
    prompt:
      "High-fashion editorial cover shot, studio lighting with violet rim light, seamless paper backdrop, confident pose, magazine quality, medium format camera look",
  },
  {
    id: "gold-luxury",
    label: "Gold Luxury",
    emoji: "👑",
    hint: "Opulent music video frame",
    prompt:
      "Luxury music video frame, gold and amber tones, opulent penthouse setting, candlelight and backlit columns, cinematic shallow depth of field, high fashion",
  },
];

export const MOTION_EXAMPLE_PRESETS: ToolPreset[] = [
  {
    id: "push-in-perf",
    label: "Stage Performance",
    emoji: "🎤",
    hint: "Camera pushes in on a performer",
    prompt: "natural body movement, expressive performance, cinematic",
    extra: { pose: "perform", cameraMovement: "push_in" },
  },
  {
    id: "orbit-walk",
    label: "Walk + Orbit",
    emoji: "🎬",
    hint: "Orbit as artist walks toward cam",
    prompt: "confident walk towards camera, mid-stride, arms relaxed, cinematic motion",
    extra: { pose: "walk", cameraMovement: "orbit_cw" },
  },
  {
    id: "low-hero",
    label: "Hero Low-Angle",
    emoji: "🏆",
    hint: "Low-angle pull-out on a hero pose",
    prompt: "low-angle hero pose, chin raised, dramatic lighting, cinematic",
    extra: { pose: "low-angle", cameraMovement: "pull_out" },
  },
];

const LIPSYNC_DEMO_VIDEO = "/__l5e/assets-v1/7a355f0a-3435-4950-8e12-15a1507a5f1d/hero-lipsync.mp4";
const LIPSYNC_DEMO_AUDIO = "/__l5e/assets-v1/47f5baf7-c85b-43cc-b2bc-e65072bbf30b/the-one-hook.mp3";

export const LIPSYNC_EXAMPLE_PRESETS: ToolPreset[] = [
  {
    id: "studio-quality",
    label: "Studio Grade",
    emoji: "🎙️",
    hint: "Best quality, ~45s",
    extra: { engine: "sync-v2", sampleVideoUrl: LIPSYNC_DEMO_VIDEO, sampleAudioUrl: LIPSYNC_DEMO_AUDIO },
  },
  {
    id: "fast-preview",
    label: "Fast Preview",
    emoji: "⚡",
    hint: "Quick turnaround, 15s",
    extra: { engine: "wav2lip", sampleVideoUrl: LIPSYNC_DEMO_VIDEO, sampleAudioUrl: LIPSYNC_DEMO_AUDIO },
  },
  {
    id: "latent",
    label: "Latent Sync",
    emoji: "🔮",
    hint: "Experimental, ultra-realistic",
    extra: { engine: "latentsync", sampleVideoUrl: LIPSYNC_DEMO_VIDEO, sampleAudioUrl: LIPSYNC_DEMO_AUDIO },
  },
];

const TIKTOK_DEMO_SOURCE = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

export const TIKTOK_EXAMPLE_PRESETS: ToolPreset[] = [
  {
    id: "urban-cut",
    label: "Urban Cut",
    emoji: "🌆",
    hint: "Beat-synced luxury showcase",
    prompt: "luxury outfit showcase, runway energy, multi-angle beat-synced cuts",
    extra: { style: "urban_cut", count: 10, sampleVideoUrl: TIKTOK_DEMO_SOURCE },
  },
  {
    id: "grwm",
    label: "GRWM",
    emoji: "💅",
    hint: "Get Ready With Me arc",
    prompt: "getting ready routine, mirror moments, outfit reveal, styling journey",
    extra: { style: "grwm", count: 8, sampleVideoUrl: TIKTOK_DEMO_SOURCE },
  },
  {
    id: "auto",
    label: "Auto Remix",
    emoji: "🚀",
    hint: "Aurora picks the best hooks",
    prompt: "",
    extra: { style: "auto", count: 10, sampleVideoUrl: TIKTOK_DEMO_SOURCE },
  },
];

export const SPEECH_EXAMPLE_PRESETS: ToolPreset[] = [
  {
    id: "hype-hook",
    label: "Hype Hook",
    emoji: "🔥",
    hint: "Energetic intro voiceover",
    prompt: "This is not a music video. This is your moment.",
  },
  {
    id: "chill-narration",
    label: "Narration",
    emoji: "🎧",
    hint: "Smooth brand voice",
    prompt: "Aurora is where artists come to bring their vision to life. One click. Total control.",
  },
  {
    id: "artist-intro",
    label: "Artist Intro",
    emoji: "🎤",
    hint: "Personal intro drop",
    prompt: "Lights. Camera. Action. Let me show you what I'm working with.",
  },
];
