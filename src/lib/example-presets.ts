export type ToolPreset = {
  id: string;
  label: string;
  emoji: string;
  hint: string;
  prompt?: string;
  /** URL to a real Aurora-generated example image shown in the empty canvas strip. */
  imageUrl?: string;
  extra?: Record<string, string | number | boolean>;
};

export const STUDIO_EXAMPLE_PRESETS: ToolPreset[] = [
  {
    id: "golden-hour-perf",
    label: "Golden Hour",
    emoji: "🌅",
    hint: "Hyperrealistic performance in golden hour",
    imageUrl: "/sample-photos/fire-street.png",
    prompt:
      "Hyperrealistic full-body cinematic portrait of the subject performing on an open rooftop at golden hour — sun at 7° elevation raking warm 2700K amber light across the face from the left, creating razor-sharp Rembrandt shadow triangle on the right cheek. 85mm f/1.4 Leica Summicron-C lens, creamy cat-eye bokeh, subject in sharp relief against a soft city skyline bathed in orange haze. Skin micro-texture: individual pores catching the oblique raking light, subtle sweat sheen, realistic subsurface scattering in the ears and nose bridge. Fabric: denim jacket weave visible, chain-link jewelry with specular highlights. Atmospheric golden dust particles suspended in the air behind the subject. ARRI Alexa 35 color science, Kodak 2383 LUT warm-lifted blacks, teal-shadow / orange-skin grade. Perfect anatomy, no distortion, no warping, no artifacts. Preserve exact facial likeness, skin tone, hairstyle, and outfit.",
  },
  {
    id: "tokyo-rain",
    label: "Tokyo Rain",
    emoji: "🌧️",
    hint: "Cinematic rainy city night",
    imageUrl: "/demo-tokyo-rain-1.png",
    prompt:
      "Ultra-cinematic wide shot of the subject standing on a rain-soaked rooftop at night, vast Tokyo skyline behind — thousands of illuminated windows, neon billboard signs in pink, cyan, and gold, Tokyo Tower glowing amber in the mid-distance. Heavy rain falling in volumetric streaks caught by a single hard backlight at 5600K, creating a halo of silver rain particles around the subject. Subject center-frame, confident stance, wet clothing clinging with fabric thread detail, neon reflections shimmering in the puddles beneath their feet. 24mm Cooke S4 lens, deep focus f/8 — subject and skyline both sharp. Kodak Vision3 500T film stock, deep teal shadows, cyan-grade blue-black sky, magenta neon accent hits. Individual raindrops on jacket surface, wet-pavement light reflections, breath vapor visible in cold air. Perfect anatomy, no distortion. Preserve exact facial likeness and outfit.",
  },
  {
    id: "editorial-split",
    label: "Editorial",
    emoji: "📸",
    hint: "Magazine cover — split light studio",
    imageUrl: "/sample-photos/red-dreads-chain.png",
    prompt:
      "Cinematic editorial portrait of the subject in a professional studio — dramatic split lighting: warm key at 2700K from 45° left, cold blue-white fill at 5600K from the opposite side, creating vivid tonal separation across the face. 85mm f/1.8 lens, razor-sharp on the eyes, creamy bokeh fall-off on the seamless charcoal paper backdrop with a deep violet gradient glow. Subject at 30° angle to camera, direct confident eye contact. Ultra-photorealistic: natural skin pores, micro-texture, individual hair strands, precise fabric weave. Sony VENICE 2 sensor — 15-stop dynamic range, clinical sharpness, no digital smoothing. Deep navy + violet color palette, high-fashion composition, magazine-quality framing. Perfect anatomy and natural proportions — no distortion, no warping, no artifacts. Preserve exact facial likeness, skin tone, hairstyle, and outfit.",
  },
  {
    id: "concert-stage",
    label: "Stage",
    emoji: "🎤",
    hint: "Concert performance with crowd energy",
    imageUrl: "/__l5e/assets-v1/b7648a1b-297a-48cd-be0f-2effe57dc46f/josh-stage-shades.jpg",
    prompt:
      "Hyperrealistic low-angle power shot of the subject performing center-stage at a packed concert — crowd visible in soft focus below, stage wash of deep violet and electric blue SkyPanels from above, single hard follow-spot at 5600K rim-lighting the subject from behind creating an aura of white-silver light around their silhouette. Subject gripping microphone, mid-performance, mouth open, raw energy — individual sweat beads visible on forehead catching the follow-spot, chain jewelry catching specular highlights. 35mm Zeiss Master Prime, f/2.0, shallow depth of field — crowd blurs into a sea of raised phones and bokeh lights. Teal-shadow / orange-skin grade, deep blacks with lifted violet midtones, anamorphic horizontal lens flares from the follow-spot. Perfect anatomy, no distortion. Preserve exact facial likeness and outfit.",
  },
  {
    id: "gold-luxury",
    label: "Gold Luxury",
    emoji: "👑",
    hint: "Opulent penthouse music video frame",
    imageUrl: "/sample-photos/balloon-josh.png",
    prompt:
      "Opulent music-video frame — the subject in a floor-to-ceiling glass penthouse at night, city lights glittering 60 floors below. Warm amber practicals at 2200K from candelabras left and right, cool city-glow spill through the floor-to-ceiling windows at 4000K creating depth separation. 50mm Leica Summicron-C, f/2.4 — subject sharp, window city-glow softly bokeh'd. Gold and champagne color palette: warm amber skin tones, deep mahogany shadows, specular gold jewelry highlights. Suit fabric: woven silk sheen catching the candlelight, individual thread luminosity. Marble floor reflection of the subject below. ARRI Alexa 35, Kodak 2383 LUT, deep navy + gold luxury grade. Atmospheric warmth: suspended golden dust particles in the candle light shafts. Perfect anatomy, no distortion. Preserve exact facial likeness and outfit.",
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
