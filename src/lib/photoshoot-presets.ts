export const PHOTO_SHOOT_CATEGORIES = [
  "All",
  "Surreal",
  "Studio",
  "Performance",
  "Street",
  "Editorial",
] as const;

export type PhotoShootCategory = (typeof PHOTO_SHOOT_CATEGORIES)[number];

export type PhotoShootPreset = {
  id: string;
  title: string;
  category: Exclude<PhotoShootCategory, "All">;
  image: string;
  scene: string;
  camera: string;
  styling: string;
  location: string;
  outfit: string;
  prop: string;
  prompt: string;
};

export const PHOTO_SHOOT_PRESETS: PhotoShootPreset[] = [
  {
    id: "sun-portal",
    title: "Sun Portal",
    category: "Surreal",
    image: "/photoshoots/sun-portal.jpeg",
    scene: "Textured amber stairs rising into a monumental circular portal at golden hour.",
    camera: "Full-length editorial frame · low, centered angle",
    styling: "Monochrome ivory tailoring against sculptural orange texture",
    location: "A surreal ochre architectural portal with deep amber sunset light",
    outfit: "Clean ivory floor-length coat, sharp minimalist tailoring",
    prop: "No prop — let the portal architecture carry the frame",
    prompt:
      "Full-length premium fashion editorial in a surreal amber architectural portal. A monumental circular opening frames the subject ascending textured ochre steps, warm sunset light, ivory tailored coat, precise centered composition, cinematic 35mm lens, high-fashion magazine finish. Preserve the artist's face and identity. No text or watermark.",
  },
  {
    id: "orbit-orange",
    title: "Orbit Orange",
    category: "Surreal",
    image: "/photoshoots/orbit-orange.jpeg",
    scene: "A saturated orange studio with a glowing circular orbit and airborne performer.",
    camera: "Wide fashion frame · diagonal movement",
    styling: "Glossy orange technical suit and black boots",
    location: "Minimal orange cyclorama with a luminous white ring sculpture",
    outfit: "Orange retro-future flight suit with a polished helmet",
    prop: "Luminous orbit ring",
    prompt:
      "Cinematic editorial photoshoot in a saturated orange cyclorama. The artist moves weightlessly beside a glowing circular orbit sculpture, glossy orange retro-future suit, sharp black boots, hard graphic shadows, controlled wide-angle composition, premium fashion campaign finish. Preserve identity and natural proportions. No text or watermark.",
  },
  {
    id: "neon-rehearsal",
    title: "Neon Rehearsal",
    category: "Performance",
    image: "/photoshoots/neon-rehearsal.png",
    scene: "A late-night rehearsal set with violet practicals and a poised artist.",
    camera: "Seated portrait · intimate 50mm",
    styling: "Dark stagewear with violet edge light",
    location: "Purple rehearsal room with practical neon lighting",
    outfit: "Black artist performance look with textured layers",
    prop: "Microphone stand or instrument case",
    prompt:
      "Intimate late-night music rehearsal portrait. Violet neon practicals, textured dark stagewear, confident seated artist, low-key cinematic contrast, shallow depth of field, premium 50mm editorial photography. Preserve the artist's identity and face. No text or watermark.",
  },
  {
    id: "blue-hour-mic",
    title: "Blue Hour Mic",
    category: "Performance",
    image: "/photoshoots/blue-hour-mic.jpg",
    scene: "A moody blue-hour vocal performance with a tactile vintage microphone.",
    camera: "Close performance portrait · shallow depth",
    styling: "Midnight tones and soft haze",
    location: "Blue-lit performance room with a dark cinematic background",
    outfit: "Deep navy or black performance styling",
    prop: "Vintage chrome microphone",
    prompt:
      "Moody blue-hour artist portrait performing into a vintage chrome microphone. Deep navy light, intimate haze, rich skin detail, cinematic low-key lighting, tactile grain, premium music editorial. Preserve identity and face. No text or watermark.",
  },
  {
    id: "red-spotlights",
    title: "Red Spotlight",
    category: "Performance",
    image: "/photoshoots/red-spotlights.jpg",
    scene: "A concert-scale red light field with the artist held in a dramatic hero pose.",
    camera: "Full body · stage-wide hero shot",
    styling: "High-contrast black and red performance wardrobe",
    location: "Dark concert space cut by saturated red spotlights",
    outfit: "Black leather, tailored streetwear, or a red accent piece",
    prop: "Handheld microphone",
    prompt:
      "High-impact concert campaign portrait under saturated red spotlights. Full-body hero pose, dark negative space, crisp stage haze, elevated black performance wardrobe with red accents, cinematic concert photography, powerful silhouette. Preserve identity. No text or watermark.",
  },
  {
    id: "color-stripes",
    title: "Color Stripes",
    category: "Studio",
    image: "/photoshoots/color-stripes.png",
    scene: "A graphic color-stripe set built for bold album artwork and social cover frames.",
    camera: "Clean waist-up portrait · graphic front angle",
    styling: "Chromatic fashion with deliberate color blocking",
    location: "Graphic studio backdrop with saturated rainbow stripes",
    outfit: "Color-blocked editorial styling with a statement jacket",
    prop: "No prop — use the color architecture as the visual hook",
    prompt:
      "Bold color-block fashion campaign in a graphic studio with saturated rainbow stripe architecture. Clean waist-up portrait, centered visual rhythm, glossy editorial lighting, premium album-cover composition. Preserve the artist's identity. No text or watermark.",
  },
  {
    id: "white-cyc-mic",
    title: "White Cyc Session",
    category: "Studio",
    image: "/photoshoots/white-cyc-mic.jpg",
    scene: "A bright studio session where the artist and microphone become the entire composition.",
    camera: "Tight studio portrait · clean 85mm",
    styling: "Minimal white, silver, and monochrome styling",
    location: "Seamless white cyclorama with polished studio lighting",
    outfit: "Crisp monochrome artist styling",
    prop: "Studio microphone",
    prompt:
      "Premium white cyclorama studio portrait of an artist with a polished microphone. Minimal monochrome styling, clean 85mm beauty lighting, soft sculpted shadow, premium press-kit finish. Preserve face and identity. No text or watermark.",
  },
  {
    id: "street-cafe",
    title: "Street Cafe",
    category: "Street",
    image: "/photoshoots/street-cafe.jpeg",
    scene: "A candid street-style setup with an everyday city location and editorial attitude.",
    camera: "Lifestyle medium shot · handheld 35mm",
    styling: "Relaxed streetwear and lived-in color",
    location: "Sidewalk cafe with urban textures and soft daylight",
    outfit: "Layered streetwear with one standout accessory",
    prop: "Coffee cup or small artist bag",
    prompt:
      "Editorial street-style artist portrait outside a textured city cafe. Relaxed layered streetwear, soft daylight, candid 35mm framing, lived-in urban color, premium music lifestyle campaign. Preserve identity. No text or watermark.",
  },
  {
    id: "night-drive",
    title: "Night Drive",
    category: "Street",
    image: "/photoshoots/night-drive.webp",
    scene: "A cinematic car-side night shoot with reflections, movement, and a polished city-after-dark finish.",
    camera: "Three-quarter hero frame · low angle",
    styling: "Night-luxe leather and reflective details",
    location: "Wet city street beside a premium car with reflected lights",
    outfit: "Black leather or metallic night-out styling",
    prop: "Premium car",
    prompt:
      "Cinematic night-drive artist campaign beside a premium car on a wet city street. Reflected neon, low-angle hero composition, high-fashion leather styling, crisp detail, glossy music-video finish. Preserve the artist's identity. No text or watermark.",
  },
  {
    id: "magenta-cyc",
    title: "Magenta Cyc",
    category: "Editorial",
    image: "/photoshoots/magenta-cyc.jpg",
    scene: "A saturated magenta studio that turns one pose into a high-fashion cover image.",
    camera: "Full-length beauty frame · straight-on",
    styling: "Monochrome magenta or black editorial look",
    location: "Seamless magenta cyclorama with soft tonal falloff",
    outfit: "Sculptural fashion styling with clean silhouette",
    prop: "No prop — use pose and color as the statement",
    prompt:
      "High-fashion album-cover portrait in a saturated magenta cyclorama. Full-length clean pose, sculptural monochrome styling, tonal studio falloff, refined beauty lighting, editorial fashion campaign. Preserve the artist's identity. No text or watermark.",
  },
  {
    id: "stage-shades",
    title: "Stage Shades",
    category: "Editorial",
    image: "/photoshoots/stage-shades.jpg",
    scene: "A polished backstage-to-stage visual with dark glasses and a sharp performance silhouette.",
    camera: "Low hero portrait · 35mm",
    styling: "Black sunglasses, sharp tailoring, controlled shadow",
    location: "Dark stage environment with directional concert light",
    outfit: "Tailored black stagewear with signature sunglasses",
    prop: "Sunglasses or microphone",
    prompt:
      "Sharp backstage-to-stage artist campaign portrait. Tailored black performance look, signature sunglasses, directional concert light, sculpted shadow, confident low-angle 35mm framing, premium music editorial. Preserve identity. No text or watermark.",
  },
  {
    id: "cobalt-orange",
    title: "Cobalt Heat",
    category: "Editorial",
    image: "/photoshoots/cobalt-orange.jpg",
    scene: "A blue-and-orange color world designed for dramatic contrast and thumbnail clarity.",
    camera: "Tight editorial crop · three-quarter angle",
    styling: "Cobalt, orange, and metallic detail",
    location: "Graphic blue-and-amber studio environment",
    outfit: "Cobalt statement look with warm accent styling",
    prop: "Optional chrome accessory",
    prompt:
      "High-contrast artist editorial in a cobalt and amber studio world. Tight three-quarter portrait, metallic details, graphic warm-cool contrast, premium color-grade, music campaign polish. Preserve the artist's identity. No text or watermark.",
  },
];

export function getPhotoShootPreset(id: string) {
  return PHOTO_SHOOT_PRESETS.find((preset) => preset.id === id);
}