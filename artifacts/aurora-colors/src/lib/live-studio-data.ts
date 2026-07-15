const REALISM = "Hyper-realistic photography, ultra-HD 8K, cinema glass — lifelike micro-texture in skin and every surface, physically accurate light falloff, no CGI or AI look.";
const IDENTITY = "IDENTITY LOCK: composite the REAL person from the uploaded reference photo into this scene. Preserve their EXACT face, skin tone, hairstyle, body proportions. Do NOT alter or replace their likeness.";

// ── Live Session scenes ───────────────────────────────────────────────────────

export type LiveScene = {
  id: string;
  name: string;
  tagline: string;
  thumb: string;
  prompt: string;
};

export const LIVE_SCENES: LiveScene[] = [
  {
    id: "kexp-purple",
    name: "Live on KEXP",
    tagline: "Concrete warehouse · purple wash",
    thumb: "/aurora-colors/studio-refs/kexp-purple-studio.jpg",
    prompt: [
      "You are an AI performance compositor: place the REAL person from the reference photo into this live music session environment.",
      IDENTITY,
      "SCENE: raw brutalist concrete warehouse performance space — high ceilings with exposed industrial trusses, smooth grey concrete walls and floor, large colorful vinyl mural banner panel on the left wall, 'LIVE ON KEXP' lit monitor screen background right, drum kit at rear right, guitar amplifiers left, electric guitar player and trumpet player in background, vintage upright microphone stand front-center, purple/violet gel flood wash bathing the entire room from above.",
      "CAMERA: wide 3/4 angle, anamorphic 35mm, slight low angle, subject at vintage microphone front-center, band visible in background, moody atmospheric.",
      REALISM,
    ].join("\n"),
  },
  {
    id: "kexp-blue",
    name: "Blue Cyclorama Session",
    tagline: "Bright blue sweep · full band",
    thumb: "/aurora-colors/studio-refs/kexp-blue-studio.jpg",
    prompt: [
      "You are an AI performance compositor: place the REAL person from the reference photo into this live session studio.",
      IDENTITY,
      "SCENE: bright cobalt blue seamless cyclorama sweep — wall and floor continuous, large white softboxes camera-left and camera-right at 45°, vintage silver standing microphone front-center on hardwood floor section, drum kit with cymbals at rear right, guitar with amp rear left, trumpet player far left. Clean professional live performance photography aesthetic.",
      "CAMERA: wide full-body shot, eye level, 50mm, subject at vintage mic center frame.",
      REALISM,
    ].join("\n"),
  },
  {
    id: "kexp-on-air",
    name: "ON AIR Lounge",
    tagline: "Glowing halos · cozy session",
    thumb: "/aurora-colors/studio-refs/kexp-on-air-studio.jpg",
    prompt: [
      "You are an AI performance compositor: place the REAL person from the reference photo into this intimate on-air session lounge.",
      IDENTITY,
      "SCENE: concrete industrial session room — smooth grey walls, glowing circular halo lights on stands (cobalt blue, magenta pink, warm orange tones), backlit red ON AIR neon sign upper right, drum kit at rear left, keyboard synthesizer player rear center, Persian rug on concrete floor, round bar stools, handheld vintage mic. Warm intimate session atmosphere.",
      "CAMERA: medium wide, 35mm, subject front-center holding mic, band and glowing lights visible in background.",
      REALISM,
    ].join("\n"),
  },
  {
    id: "acoustic-loft",
    name: "Acoustic Loft",
    tagline: "Exposed brick · intimate candlelight",
    thumb: "/aurora-colors/studio-refs/kexp-purple-studio.jpg",
    prompt: [
      "You are an AI performance compositor: place the REAL person into this intimate acoustic loft recording session.",
      IDENTITY,
      "SCENE: exposed brick loft — warm tungsten Edison bulbs strung overhead, vintage Persian rug, upright piano stage left, acoustic guitar on stand, drum brushes on snare, intimate singer-songwriter energy. Vintage chrome standing mic center, warm amber practicals, moody directional key light from window camera-right. Cozy independent record label vibe.",
      "CAMERA: medium 3/4 angle, 50mm f/1.8, subject at vintage mic, shallow DOF warm bokeh lights behind.",
      REALISM,
    ].join("\n"),
  },
  {
    id: "black-box",
    name: "Black Box Theater",
    tagline: "Raw stage · single spotlight",
    thumb: "/aurora-colors/studio-refs/kexp-purple-studio.jpg",
    prompt: [
      "You are an AI performance compositor: place the REAL person into this dramatic black box theater performance.",
      IDENTITY,
      "SCENE: black box theater — matte black walls and ceiling, single hard theatrical Fresnel spotlight from directly above illuminating subject only, surrounding darkness, tiny dust particles visible in the beam, boom-arm microphone from above, raw exposed rigging visible in shadows, theatrical haze.",
      "CAMERA: locked-off center frame, 35mm, dramatic top-down pool of light, deep noir shadows.",
      REALISM,
    ].join("\n"),
  },
];

// ── Artist Shoot scenes ───────────────────────────────────────────────────────

export type BackdropColor = {
  id: string;
  name: string;
  swatch: string;
  promptName: string;
};

export const BACKDROP_COLORS: BackdropColor[] = [
  { id: "hot-pink", name: "Hot Pink", swatch: "#ff2d8a", promptName: "vivid hot pink" },
  { id: "cobalt", name: "Cobalt Blue", swatch: "#1e40af", promptName: "deep cobalt blue" },
  { id: "lime", name: "Lime Green", swatch: "#a3e635", promptName: "fluorescent lime green" },
  { id: "orange", name: "Orange", swatch: "#f97316", promptName: "bright tangerine orange" },
  { id: "purple", name: "Purple", swatch: "#8b5cf6", promptName: "electric violet purple" },
  { id: "yellow", name: "Yellow", swatch: "#facc15", promptName: "saturated cyber yellow" },
  { id: "crimson", name: "Crimson", swatch: "#dc2626", promptName: "deep crimson red" },
  { id: "grey", name: "Grey", swatch: "#6b7280", promptName: "warm neutral grey" },
  { id: "black", name: "Black", swatch: "#0a0a0a", promptName: "matte obsidian black" },
  { id: "cyan", name: "Cyan", swatch: "#06b6d4", promptName: "luminous aqua cyan" },
  { id: "peach", name: "Peach", swatch: "#f9a8d4", promptName: "soft blush peach" },
  { id: "forest", name: "Forest", swatch: "#166534", promptName: "deep forest green" },
];

export type ArtistScene = {
  id: string;
  name: string;
  tagline: string;
  thumb: string;
  hasColorPicker?: boolean;
  prompt: (colorName?: string) => string;
};

export const ARTIST_SCENES: ArtistScene[] = [
  {
    id: "production-set",
    name: "Music Video Set",
    tagline: "Warehouse · smoke · camera crew",
    thumb: "/aurora-colors/studio-refs/artist-shoot-production-set.png",
    prompt: () => [
      "You are an AI performance compositor: place the REAL person from the reference photo into this high-production music video set.",
      IDENTITY,
      "SCENE: large industrial warehouse studio — exposed brick walls, polished concrete floor, matte orange sports car (AMG style) as centerpiece background prop, red and blue smoke bomb plumes billowing upward behind subject, professional Canon cameras on gimbal rigs operated by camera crew visible at frame edges, tall professional softbox lights both sides, overhead production lighting rig, subject holding vintage silver handheld microphone. Cinematic behind-the-scenes high-production feel.",
      "CAMERA: medium wide, 35mm, subject front-center holding mic, car and production crew slightly out of focus behind.",
      REALISM,
    ].join("\n"),
  },
  {
    id: "colored-backdrop",
    name: "Colored Backdrop",
    tagline: "Seamless sweep · stool + mic",
    thumb: "/aurora-colors/studio-refs/kexp-blue-studio.jpg",
    hasColorPicker: true,
    prompt: (colorName = "royal blue") => [
      "You are an AI performance compositor: place the REAL person into this colored backdrop studio shoot.",
      IDENTITY,
      `SCENE: seamless ${colorName} paper sweep backdrop studio — continuous ${colorName} wall and floor with gentle gradient falloff at the base, vintage chrome microphone on tall floor stand center frame, black velvet-upholstered tall barstool beside it, dual professional softboxes camera-left and right at 45°, clean monochromatic editorial staging.`,
      `COLOR CONTROL: the entire set — background, floor, ambient light bounce — is saturated ${colorName}. Single complementary rim accent from behind.`,
      "CAMERA: 3/4 body, 50mm, clean and editorial.",
      REALISM,
    ].join("\n"),
  },
  {
    id: "arena-stage",
    name: "Arena Stage",
    tagline: "Massive lights · crowd · haze",
    thumb: "/aurora-colors/studio-refs/artist-shoot-production-set.png",
    prompt: () => [
      "You are an AI performance compositor: place the REAL person onto this sold-out arena concert stage.",
      IDENTITY,
      "SCENE: massive arena concert stage — enormous red and blue moving-head spotlights beaming from above in multiple directions, thick atmospheric haze filling the air, sold-out crowd of thousands blurred behind in the darkness, subject standing on center stage holding a handheld dynamic microphone, confetti fragments in the air, massive LED screen wall behind, stage monitors at feet.",
      "CAMERA: wide dramatic hero shot, anamorphic 35mm, low angle looking slightly up at subject, crowd energy palpable.",
      REALISM,
    ].join("\n"),
  },
  {
    id: "blue-cyc-portrait",
    name: "Blue Cyclorama Portrait",
    tagline: "Royal blue sweep · close-up",
    thumb: "/aurora-colors/studio-refs/kexp-blue-studio.jpg",
    prompt: () => [
      "You are an AI performance compositor: place the REAL person into this close-up blue cyclorama portrait session.",
      IDENTITY,
      "SCENE: seamless royal blue cyclorama — close-up 3/4 portrait crop, chest and above, vintage ribbon microphone on stand at subject's chin level, heavy silver chain jewelry on subject, dramatic single key light from camera-left at 45° with hard shadows, royal blue fill from behind, rich blue floor reflection, editorial fashion energy.",
      "CAMERA: tight 3/4 portrait, 85mm, f/1.8, dramatic shallow DOF, cinematic.",
      REALISM,
    ].join("\n"),
  },
];
