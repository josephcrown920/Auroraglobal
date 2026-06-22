// Colors Studio — palette × setup × workflow recipes
// Single source of truth for the dedicated /colors route.

export type ColorPreset = {
  id: string;
  name: string;
  swatch: string;
  promptName: string;
  glow: string;
  /** Per-color performance staging so every swatch produces a different shot. */
  performance: {
    mic: "hanging" | "standing" | "handheld" | "boom";
    pose: string;
    energy: string;
  };
};

export const COLOR_PRESETS: ColorPreset[] = [
  { id: "hot-pink", name: "Hot Pink", swatch: "#ff2d8a", promptName: "vivid hot pink", glow: "from-pink-500/40 to-fuchsia-500/20",
    performance: { mic: "standing", pose: "three-quarter body facing camera-left, one hand resting on a tall chrome mic stand, head tilted up", energy: "confident, slow ballad delivery" } },
  { id: "royal-blue", name: "Royal Blue", swatch: "#1e40af", promptName: "deep royal blue", glow: "from-blue-600/40 to-indigo-500/20",
    performance: { mic: "hanging", pose: "full-body side profile, leaning into a vintage silver microphone hanging at chest level from above", energy: "calm composed power" } },
  { id: "neon-green", name: "Neon Green", swatch: "#39ff14", promptName: "electric neon green", glow: "from-emerald-400/40 to-lime-400/20",
    performance: { mic: "boom", pose: "head tilted back, eyes closed, screaming into an overhead boom mic, arms loose at sides", energy: "raw cathartic shout" } },
  { id: "sunset-orange", name: "Sunset Orange", swatch: "#ff6a00", promptName: "warm sunset orange", glow: "from-orange-500/40 to-amber-400/20",
    performance: { mic: "handheld", pose: "mid-stride across the frame, handheld dynamic SM58 close to mouth, free hand pointing at the lens", energy: "hyped, mid-verse" } },
  { id: "electric-purple", name: "Electric Purple", swatch: "#8b5cf6", promptName: "electric violet purple", glow: "from-violet-500/40 to-purple-500/20",
    performance: { mic: "standing", pose: "eyes closed, both hands wrapped around the mic on a vintage stand, body slightly swaying", energy: "lost in the song, reverb-soaked" } },
  { id: "cyber-yellow", name: "Cyber Yellow", swatch: "#facc15", promptName: "saturated cyber yellow", glow: "from-yellow-400/40 to-amber-300/20",
    performance: { mic: "handheld", pose: "frozen mid-jump with both feet off the ground, handheld mic in one hand", energy: "explosive hype moment" } },
  { id: "crimson-red", name: "Crimson Red", swatch: "#dc2626", promptName: "deep crimson red", glow: "from-red-600/40 to-rose-500/20",
    performance: { mic: "hanging", pose: "back three-quarters to camera, turning over the shoulder toward a hanging vintage mic", energy: "slow brooding turn" } },
  { id: "ice-white", name: "Ice White", swatch: "#f8fafc", promptName: "pure monochrome white", glow: "from-slate-200/40 to-white/10",
    performance: { mic: "boom", pose: "standing centered with hands clasped near the chest, overhead boom mic just visible at top of frame", energy: "still, gospel-prayer stillness" } },
  { id: "obsidian", name: "Obsidian Black", swatch: "#0a0a0a", promptName: "matte obsidian black", glow: "from-zinc-800/40 to-black/20",
    performance: { mic: "standing", pose: "lone figure under a single hard spotlight, standing mic with windscreen, silhouette edge-lit", energy: "noir, smoky club mood" } },
  { id: "aqua", name: "Aqua Teal", swatch: "#06b6d4", promptName: "luminous aqua teal", glow: "from-cyan-400/40 to-teal-400/20",
    performance: { mic: "hanging", pose: "low-angle hero shot looking up, chin slightly raised, hanging mic descending into frame", energy: "anthemic hero pose" } },
  { id: "rose-gold", name: "Rose Gold", swatch: "#e8b4a0", promptName: "soft rose gold", glow: "from-rose-300/40 to-amber-200/20",
    performance: { mic: "standing", pose: "seated on a tall barstool, vintage standing mic at mouth height, legs crossed", energy: "intimate acoustic ballad" } },
  { id: "lime-pop", name: "Lime Pop", swatch: "#a3e635", promptName: "fluorescent lime", glow: "from-lime-400/40 to-green-400/20",
    performance: { mic: "handheld", pose: "leaning back away from camera with handheld mic raised overhead, free hand on hip", energy: "swagger, lean-back flex" } },
];

const MIC_DETAIL: Record<ColorPreset["performance"]["mic"], string> = {
  hanging: "an exact suspended vintage silver studio microphone hanging from a thin cable from above the frame, photoreal shape, size, material, cable",
  standing: "a vintage chrome microphone on a tall floor stand, photoreal Shure-style capsule with windscreen, sturdy weighted base",
  handheld: "a handheld dynamic stage microphone (Shure SM58 type) gripped tightly with the XLR cable trailing out of frame",
  boom: "a long overhead boom-arm microphone descending into the top of frame, professional shock-mount, blimp windscreen",
};

export type SetupKind = "performance" | "studio" | "indoor" | "outdoor" | "street";

export const SETUP_KINDS: { id: SetupKind; label: string }[] = [
  { id: "performance", label: "Performance" },
  { id: "studio", label: "Studio" },
  { id: "indoor", label: "Indoor" },
  { id: "outdoor", label: "Outdoor" },
  { id: "street", label: "Street" },
];

export type Setup = {
  id: string;
  name: string;
  description: string;
  kind: SetupKind;
  /** CSS gradient mockup that previews the scene tinted by the color (fallback when no image). */
  preview: (hex: string) => string;
  prompt: (color: string) => string;
};

export const SETUPS: Setup[] = [
  // PERFORMANCE — per-color staging (mic + pose change per swatch).
  {
    id: "performance",
    name: "Performance · Per-color staging",
    description: "Each color has its own mic style, pose, and energy. Hanging mic, standing mic, handheld or boom.",
    kind: "performance",
    preview: (c) => `radial-gradient(ellipse at 50% 65%, ${c}ee 0%, ${c}88 40%, ${c}22 100%)`,
    // Placeholder — the real prompt is composed in buildPerformancePrompt(colorId)
    // because it depends on the per-color mic/pose config, not just the color name.
    prompt: (color) =>
      `Editorial performance shot on a seamless ${color} cyclorama. Preserve facial likeness. 4K cinematic.`,
  },

  // STUDIO
  {
    id: "wide",
    name: "Studio · Wide",
    description: "Seamless cyclorama, full body, the color floods the frame.",
    kind: "studio",
    preview: (c) => `radial-gradient(ellipse at 50% 70%, ${c}cc 0%, ${c}80 35%, ${c}30 100%)`,
    prompt: (color) =>
      `Wide full-body editorial photograph of the subject on a seamless ${color} cyclorama studio backdrop that floods the frame. Outfit identical to reference, tinted by the ambient ${color} light. Bold monochromatic styling, soft studio softboxes from camera-left, subtle ${color} rim light. Preserve exact facial likeness and skin tone. ARRI Alexa look, 50mm lens, 4K, no text or logos.`,
  },
  {
    id: "closeup",
    name: "Studio · Close-Up",
    description: "Beauty crop with the color as a glowing gel wash.",
    kind: "studio",
    preview: (c) => `radial-gradient(circle at 35% 40%, ${c}ff 0%, ${c}60 40%, #0a0a0a 90%)`,
    prompt: (color) =>
      `Intimate cinematic close-up of the subject, shoulders up. Saturated ${color} gel light washes one side of the face, deep shadow on the other. Preserve facial likeness, beard, skin texture, eye detail. Crisp catch-lights. f/1.8 anamorphic 85mm, fine grain, hyper-real skin pores, 4K editorial beauty shot.`,
  },
  {
    id: "split-color",
    name: "Studio · Split Color",
    description: "Two-tone gels split the face down the middle.",
    kind: "studio",
    preview: (c) => `linear-gradient(90deg, ${c} 0%, ${c} 50%, #f5f5f5 50%, #e5e5e5 100%)`,
    prompt: (color) =>
      `Bold dual-tone studio portrait — one side lit by a saturated ${color} gel, the other by neutral white, hard vertical split down center of face. Preserve facial likeness. High-contrast fashion editorial, sharp shadows, 4K.`,
  },
  {
    id: "neon-bath",
    name: "Studio · Neon Bath",
    description: "Subject surrounded by glowing neon strips of the color.",
    kind: "studio",
    preview: (c) =>
      `repeating-linear-gradient(180deg, #0a0a0a 0px, #0a0a0a 14px, ${c} 14px, ${c} 18px)`,
    prompt: (color) =>
      `Cinematic portrait inside a dark room lined with glowing ${color} neon strips wrapping the walls, neon light bouncing on subject's face and outfit. Atmospheric haze, anamorphic flares, shallow depth of field, Blade Runner palette dominated by ${color}. Preserve facial likeness. 4K.`,
  },
  {
    id: "color-smoke",
    name: "Studio · Color Smoke",
    description: "Plumes of colored smoke swirl mid-action.",
    kind: "studio",
    preview: (c) =>
      `radial-gradient(ellipse at 30% 60%, ${c}cc 0%, transparent 50%), radial-gradient(ellipse at 75% 35%, ${c}99 0%, transparent 55%), #0a0a0a`,
    prompt: (color) =>
      `Editorial action portrait mid-motion with thick swirling ${color} smoke billowing around, lit dramatically from behind so smoke glows. Outfit catches rim light. Preserve facial likeness. Medium format, sharp subject, soft smoke, 4K cinematic still.`,
  },

  // INDOOR
  {
    id: "indoor-bedroom",
    name: "Indoor · Bedroom Suite",
    description: "Luxe hotel bedroom, lamp warmth + colored window light.",
    kind: "indoor",
    preview: (c) =>
      `linear-gradient(160deg, #2a1a14 0%, #5a3320 35%, ${c}88 70%, ${c}cc 100%)`,
    prompt: (color) =>
      `Cinematic editorial portrait inside a luxe hotel bedroom suite — warm tungsten bedside lamps + ${color} colored gel spilling through the window like a neon sign outside. Subject seated on the edge of a made bed, soft linens, mid-century furniture. Preserve facial likeness and outfit. 35mm anamorphic, shallow DOF, ARRI grade, 4K.`,
  },
  {
    id: "indoor-kitchen",
    name: "Indoor · Kitchen",
    description: "Modern kitchen, practicals + colored fill from a hallway.",
    kind: "indoor",
    preview: (c) =>
      `linear-gradient(180deg, #f5f0e8 0%, #d8cfc1 40%, ${c}66 70%, ${c}aa 100%)`,
    prompt: (color) =>
      `Cinematic editorial portrait inside a modern kitchen — marble counters, brass fixtures, warm overhead practicals and a colored ${color} wash spilling in from an adjoining hallway. Subject leaning against the counter. Preserve facial likeness and outfit. 35mm, shallow DOF, filmic grade, 4K.`,
  },
  {
    id: "indoor-lounge",
    name: "Indoor · Lounge",
    description: "Velvet lounge with colored uplighters.",
    kind: "indoor",
    preview: (c) =>
      `linear-gradient(180deg, #1a0a14 0%, ${c}55 50%, ${c}cc 100%)`,
    prompt: (color) =>
      `Cinematic editorial portrait inside a moody lounge — velvet booth, low brass table, ${color} uplighters washing the walls, single warm pendant key. Subject lounging, half in shadow. Preserve facial likeness and outfit. 50mm, anamorphic flares, 4K.`,
  },

  // OUTDOOR
  {
    id: "rooftop",
    name: "Rooftop · Golden Hour",
    description: "Downtown rooftop, skyline backdrop, color rim light.",
    kind: "outdoor",
    preview: (c) =>
      `linear-gradient(180deg, ${c}aa 0%, ${c}55 45%, #1a1a2a 65%, #0a0a14 100%)`,
    prompt: (color) =>
      `Cinematic editorial photograph of the subject on a downtown rooftop at golden hour, skyline of glass towers behind, low sun rim-lighting from the side, ${color} colored gel as accent rim from camera-right. Warm cinematic grade, anamorphic 50mm, sharp subject, shallow DOF, 4K. Preserve facial likeness and outfit.`,
  },
  {
    id: "rooftop-night",
    name: "Rooftop · Night",
    description: "Skyline at night, color neon haze.",
    kind: "outdoor",
    preview: (c) =>
      `linear-gradient(180deg, #07060d 0%, #1a1424 40%, ${c}66 80%, ${c}aa 100%)`,
    prompt: (color) =>
      `Cinematic night rooftop portrait — city skyline glittering behind, atmospheric haze tinted ${color}, single hard key from camera-left, ${color} rim from behind. Preserve facial likeness and outfit. ARRI cinema look, 35mm anamorphic, 4K.`,
  },

  // STREET
  {
    id: "neon-street",
    name: "Street · Neon Night",
    description: "Wet street, signage reflections in the chosen color.",
    kind: "street",
    preview: (c) =>
      `linear-gradient(180deg, #06050b 0%, #0c0a16 45%, ${c}88 75%, ${c}cc 100%)`,
    prompt: (color) =>
      `Cinematic night street portrait — wet pavement reflecting ${color} neon signage, motion-blurred passers-by, single hard key from above, anamorphic flares. Preserve facial likeness and outfit. 35mm cinema look, 4K.`,
  },
  {
    id: "alley",
    name: "Street · Alley",
    description: "Gritty alley, single overhead lamp + colored fill.",
    kind: "street",
    preview: (c) =>
      `radial-gradient(ellipse at 50% 20%, #f5e9c8 0%, transparent 35%), linear-gradient(180deg, #07060c 0%, ${c}55 70%, ${c}99 100%)`,
    prompt: (color) =>
      `Gritty urban alleyway portrait at night, wet pavement reflecting a single hard overhead lamp, ${color} colored fill from a doorway, brick walls softly out of focus, deep shadows. Preserve facial likeness and outfit. ARRI cinema look, anamorphic 35mm, 4K.`,
  },
];

export type Workflow = {
  id: string;
  name: string;
  steps: string[];
};

export const WORKFLOWS: Workflow[] = [
  { id: "single",     name: "Single Color Shot",     steps: ["Pick 1 color", "Pick 1 setup", "Generate"] },
  { id: "triptych",   name: "Color Triptych",        steps: ["Pick 3 colors", "Same setup", "Generate 3 in parallel"] },
  { id: "all-setups", name: "One Color · All Setups", steps: ["Pick 1 color", "Run every setup", "Compare looks"] },
];

/** Per-color performance prompt — every swatch produces a different mic + pose + energy. */
export function buildPerformancePrompt(colorId: string): string {
  const c = COLOR_PRESETS.find((x) => x.id === colorId) ?? COLOR_PRESETS[0];
  const { mic, pose, energy } = c.performance;
  return `Editorial music-video performance shot of the subject on a seamless ${c.promptName} cyclorama — background and floor are one continuous ${c.promptName} surface, no visible seams. Subject standing on a circular performance platform matching the ${c.promptName} tone, slightly elevated with a subtle reflective sheen and soft shadow. Pose: ${pose}. Energy: ${energy}. Microphone: ${MIC_DETAIL[mic]}. Lighting: bold monochromatic ${c.promptName} ambient wash with a soft key from camera-right and a clean rim light separating the subject from the background. Preserve exact facial likeness, beard, skin tone, hairstyle, body proportions, and outfit from the reference photos. Ultra-realistic skin texture with natural pores, sharp clothing detail, gentle floor shadow, high-end music-video aesthetic, ARRI Alexa look, 50mm, 4K photoreal, no text or logos.`;
}

export function buildColorPrompt(colorId: string, setupId: string): string {
  if (setupId === "performance") return buildPerformancePrompt(colorId);
  const c = COLOR_PRESETS.find((x) => x.id === colorId) ?? COLOR_PRESETS[0];
  const s = SETUPS.find((x) => x.id === setupId) ?? SETUPS[0];
  return s.prompt(c.promptName);
}

/** Short human label describing the current performance staging for the UI. */
export function describePerformance(colorId: string): string {
  const c = COLOR_PRESETS.find((x) => x.id === colorId) ?? COLOR_PRESETS[0];
  const micLabel: Record<ColorPreset["performance"]["mic"], string> = {
    hanging: "hanging vintage mic",
    standing: "standing chrome mic",
    handheld: "handheld dynamic mic",
    boom: "overhead boom mic",
  };
  return `${c.name} · ${micLabel[c.performance.mic]} · ${c.performance.energy}`;
}
