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
  /**
   * Fixed studio template — a locked set description embedded verbatim into
   * the performance prompt. This is NOT a suggestion; the model must reproduce
   * this exact environment and place the person into it.
   */
  studioTemplate: string;
};

export const COLOR_PRESETS: ColorPreset[] = [
  {
    id: "hot-pink",
    name: "Hot Pink",
    swatch: "#ff2d8a",
    promptName: "vivid hot pink",
    glow: "from-pink-500/40 to-fuchsia-500/20",
    performance: { mic: "standing", pose: "three-quarter body facing camera-left, one hand resting on a tall chrome mic stand, head tilted up", energy: "confident, slow ballad delivery" },
    studioTemplate: "Hot Pink Cyclorama Studio: seamless curved cyc wall and floor in matte vivid hot pink with no visible seams, single tall chrome floor-standing microphone centered in frame, warm pink-tinted softbox key from camera-right, soft pink rim light separating subject from background, faint floor reflection of subject's silhouette, minimal hard shadows, clean editorial staging.",
  },
  {
    id: "royal-blue",
    name: "Royal Blue",
    swatch: "#1e40af",
    promptName: "deep royal blue",
    glow: "from-blue-600/40 to-indigo-500/20",
    performance: { mic: "hanging", pose: "full-body side profile, leaning into a vintage silver microphone hanging at chest level from above", energy: "calm composed power" },
    studioTemplate: "Royal Blue Cyclorama Studio: seamless curved cyc backdrop and floor in matte deep royal blue, single vintage silver studio microphone hanging on a thin cable descending from above to center frame, plain black wooden stool positioned directly under the mic, single soft spotlight from directly above casting a clean pool of light, subtle cool floor reflection beneath subject's feet, minimal shadows, absolutely no extra props or decoration.",
  },
  {
    id: "neon-green",
    name: "Neon Green",
    swatch: "#39ff14",
    promptName: "electric neon green",
    glow: "from-emerald-400/40 to-lime-400/20",
    performance: { mic: "boom", pose: "head tilted back, eyes closed, screaming into an overhead boom mic, arms loose at sides", energy: "raw cathartic shout" },
    studioTemplate: "Neon Green Cyclorama Studio: seamless curved cyc wall and floor in electric neon green, long overhead boom-arm mic with blimp windscreen descending from top-right corner into frame, hard single-source fresnel spotlight from directly above, strong neon green ambient bounce filling the cyc evenly, electric green floor glow beneath subject, edgy raw-energy staging with no furniture.",
  },
  {
    id: "sunset-orange",
    name: "Sunset Orange",
    swatch: "#ff6a00",
    promptName: "warm sunset orange",
    glow: "from-orange-500/40 to-amber-400/20",
    performance: { mic: "handheld", pose: "mid-stride across the frame, handheld dynamic SM58 close to mouth, free hand pointing at the lens", energy: "hyped, mid-verse" },
    studioTemplate: "Sunset Orange Cyclorama Studio: seamless curved cyc in warm sunset orange, floor tinted amber-orange, no furniture — open floor space for movement, warm dual-softbox setup mimicking late-afternoon sun from camera-right, orange-tinted haze subtly diffusing the air near the cyc, golden floor reflection under feet, high-energy stadium-feel framing.",
  },
  {
    id: "electric-purple",
    name: "Electric Purple",
    swatch: "#8b5cf6",
    promptName: "electric violet purple",
    glow: "from-violet-500/40 to-purple-500/20",
    performance: { mic: "standing", pose: "eyes closed, both hands wrapped around the mic on a vintage stand, body slightly swaying", energy: "lost in the song, reverb-soaked" },
    studioTemplate: "Electric Purple Cyclorama Studio: seamless curved cyc in deep electric violet-purple, vintage chrome microphone on a tall floor stand centered in frame, moody low-key purple ambient wash from above with a subtle violet haze near the cyc, single hair light from directly above separating subject from background, delicate floor reflection of purple light, intimate atmospheric staging.",
  },
  {
    id: "cyber-yellow",
    name: "Cyber Yellow",
    swatch: "#facc15",
    promptName: "saturated cyber yellow",
    glow: "from-yellow-400/40 to-amber-300/20",
    performance: { mic: "handheld", pose: "frozen mid-jump with both feet off the ground, handheld mic in one hand", energy: "explosive hype moment" },
    studioTemplate: "Cyber Yellow Cyclorama Studio: seamless curved cyc in saturated cyber yellow, empty open floor space with no furniture to allow full-body action framing, bright high-key dual softbox setup flooding the cyc evenly in yellow, sharp punchy shadows under subject, yellow floor reflection, bold high-contrast editorial staging.",
  },
  {
    id: "crimson-red",
    name: "Crimson Red",
    swatch: "#dc2626",
    promptName: "deep crimson red",
    glow: "from-red-600/40 to-rose-500/20",
    performance: { mic: "hanging", pose: "back three-quarters to camera, turning over the shoulder toward a hanging vintage mic", energy: "slow brooding turn" },
    studioTemplate: "Crimson Red Cyclorama Studio: seamless curved cyc in deep crimson red, single vintage silver microphone hanging on a cable from center-top of frame, low dramatic rim light from behind in deep red, single hard key light from camera-left creating strong directional shadows, rich red floor reflection, brooding theatrical staging with no furniture.",
  },
  {
    id: "ice-white",
    name: "Ice White",
    swatch: "#f8fafc",
    promptName: "pure monochrome white",
    glow: "from-slate-200/40 to-white/10",
    performance: { mic: "boom", pose: "standing centered with hands clasped near the chest, overhead boom mic just visible at top of frame", energy: "still, gospel-prayer stillness" },
    studioTemplate: "Ice White Cyclorama Studio: seamless curved cyc in pure clean white with no texture, long overhead boom arm with professional shock-mount mic descending from top center just into top of frame, soft even studio fill from two large diffused octaboxes, very slight floor shadow beneath subject, clean minimal white-on-white staging, no props, sacred still energy.",
  },
  {
    id: "obsidian",
    name: "Obsidian Black",
    swatch: "#0a0a0a",
    promptName: "matte obsidian black",
    glow: "from-zinc-800/40 to-black/20",
    performance: { mic: "standing", pose: "lone figure under a single hard spotlight, standing mic with windscreen, silhouette edge-lit", energy: "noir, smoky club mood" },
    studioTemplate: "Obsidian Black Cyclorama Studio: seamless curved cyc in matte obsidian black with near-zero ambient light, vintage floor-standing microphone with windscreen exactly center frame, single hard narrow spotlight from directly above forming a tight circle of light on subject, subtle silver-white edge rim from behind, very faint floor reflection, dramatic noir club atmosphere, thin wisps of atmospheric haze near the cyc.",
  },
  {
    id: "aqua",
    name: "Aqua Teal",
    swatch: "#06b6d4",
    promptName: "luminous aqua teal",
    glow: "from-cyan-400/40 to-teal-400/20",
    performance: { mic: "hanging", pose: "low-angle hero shot looking up, chin slightly raised, hanging mic descending into frame", energy: "anthemic hero pose" },
    studioTemplate: "Aqua Teal Cyclorama Studio: seamless curved cyc in luminous aqua teal, vintage hanging microphone on a thin cable from above descending to chest height center frame, low camera angle looking up at subject for anthemic hero framing, bold aqua-teal softbox key from below-front, cyan rim light from behind, glossy floor with strong aqua reflection, powerful anthem-stage energy.",
  },
  {
    id: "rose-gold",
    name: "Rose Gold",
    swatch: "#e8b4a0",
    promptName: "soft rose gold",
    glow: "from-rose-300/40 to-amber-200/20",
    performance: { mic: "standing", pose: "seated on a tall barstool, vintage standing mic at mouth height, legs crossed", energy: "intimate acoustic ballad" },
    studioTemplate: "Rose Gold Cyclorama Studio: seamless curved cyc in soft rose gold with a warm blush undertone, tall vintage chrome standing microphone with capsule at mouth height, plain velvet-upholstered tall barstool positioned at the mic, warm rose-tinted softbox key from camera-right at 45°, gentle golden-peach fill from camera-left, warm rose floor reflection beneath stool, intimate cozy staging.",
  },
  {
    id: "lime-pop",
    name: "Lime Pop",
    swatch: "#a3e635",
    promptName: "fluorescent lime",
    glow: "from-lime-400/40 to-green-400/20",
    performance: { mic: "handheld", pose: "leaning back away from camera with handheld mic raised overhead, free hand on hip", energy: "swagger, lean-back flex" },
    studioTemplate: "Lime Pop Cyclorama Studio: seamless curved cyc in fluorescent lime green, open floor with no furniture for full-body swagger framing, high-energy dual fill lights bathing the cyc in bright lime, punchy on-camera hard fill from front, vivid lime floor bounce reflection under feet, bold graphic editorial staging.",
  },
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
      `Editorial performance shot on a seamless ${color} cyclorama. Preserve facial likeness. 8K ultra-HD cinematic.`,
  },

  // STUDIO
  {
    id: "wide",
    name: "Studio · Wide",
    description: "Seamless cyclorama, full body, the color floods the frame.",
    kind: "studio",
    preview: (c) => `radial-gradient(ellipse at 50% 70%, ${c}cc 0%, ${c}80 35%, ${c}30 100%)`,
    prompt: (color) =>
      `Wide full-body editorial photograph of the subject on a seamless ${color} cyclorama studio backdrop that floods the frame. Outfit identical to reference, tinted by the ambient ${color} light. Bold monochromatic styling, soft studio softboxes from camera-left, subtle ${color} rim light. Preserve exact facial likeness and skin tone. ARRI Alexa look, 50mm lens, 8K ultra-HD, no text or logos.`,
  },
  {
    id: "closeup",
    name: "Studio · Close-Up",
    description: "Beauty crop with the color as a glowing gel wash.",
    kind: "studio",
    preview: (c) => `radial-gradient(circle at 35% 40%, ${c}ff 0%, ${c}60 40%, #0a0a0a 90%)`,
    prompt: (color) =>
      `Intimate cinematic close-up of the subject, shoulders up. Saturated ${color} gel light washes one side of the face, deep shadow on the other. Preserve facial likeness, beard, skin texture, eye detail. Crisp catch-lights. f/1.8 anamorphic 85mm, fine grain, hyper-real skin pores and micro-texture, 8K ultra-HD editorial beauty shot.`,
  },
  {
    id: "split-color",
    name: "Studio · Split Color",
    description: "Two-tone gels split the face down the middle.",
    kind: "studio",
    preview: (c) => `linear-gradient(90deg, ${c} 0%, ${c} 50%, #f5f5f5 50%, #e5e5e5 100%)`,
    prompt: (color) =>
      `Bold dual-tone studio portrait — one side lit by a saturated ${color} gel, the other by neutral white, hard vertical split down center of face. Preserve facial likeness. High-contrast fashion editorial, sharp shadows, 8K ultra-HD.`,
  },
  {
    id: "neon-bath",
    name: "Studio · Neon Bath",
    description: "Subject surrounded by glowing neon strips of the color.",
    kind: "studio",
    preview: (c) =>
      `repeating-linear-gradient(180deg, #0a0a0a 0px, #0a0a0a 14px, ${c} 14px, ${c} 18px)`,
    prompt: (color) =>
      `Cinematic portrait inside a dark room lined with glowing ${color} neon strips wrapping the walls, neon light bouncing on subject's face and outfit. Atmospheric haze, anamorphic flares, shallow depth of field, Blade Runner palette dominated by ${color}. Preserve facial likeness. 8K ultra-HD.`,
  },
  {
    id: "color-smoke",
    name: "Studio · Color Smoke",
    description: "Plumes of colored smoke swirl mid-action.",
    kind: "studio",
    preview: (c) =>
      `radial-gradient(ellipse at 30% 60%, ${c}cc 0%, transparent 50%), radial-gradient(ellipse at 75% 35%, ${c}99 0%, transparent 55%), #0a0a0a`,
    prompt: (color) =>
      `Editorial action portrait mid-motion with thick swirling ${color} smoke billowing around, lit dramatically from behind so smoke glows. Outfit catches rim light. Preserve facial likeness. Medium format, sharp subject, soft smoke, 8K ultra-HD cinematic still.`,
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
      `Cinematic editorial portrait inside a luxe hotel bedroom suite — warm tungsten bedside lamps + ${color} colored gel spilling through the window like a neon sign outside. Subject seated on the edge of a made bed, soft linens, mid-century furniture. Preserve facial likeness and outfit. 35mm anamorphic, shallow DOF, ARRI grade, 8K ultra-HD.`,
  },
  {
    id: "indoor-kitchen",
    name: "Indoor · Kitchen",
    description: "Modern kitchen, practicals + colored fill from a hallway.",
    kind: "indoor",
    preview: (c) =>
      `linear-gradient(180deg, #f5f0e8 0%, #d8cfc1 40%, ${c}66 70%, ${c}aa 100%)`,
    prompt: (color) =>
      `Cinematic editorial portrait inside a modern kitchen — marble counters, brass fixtures, warm overhead practicals and a colored ${color} wash spilling in from an adjoining hallway. Subject leaning against the counter. Preserve facial likeness and outfit. 35mm, shallow DOF, filmic grade, 8K ultra-HD.`,
  },
  {
    id: "indoor-lounge",
    name: "Indoor · Lounge",
    description: "Velvet lounge with colored uplighters.",
    kind: "indoor",
    preview: (c) =>
      `linear-gradient(180deg, #1a0a14 0%, ${c}55 50%, ${c}cc 100%)`,
    prompt: (color) =>
      `Cinematic editorial portrait inside a moody lounge — velvet booth, low brass table, ${color} uplighters washing the walls, single warm pendant key. Subject lounging, half in shadow. Preserve facial likeness and outfit. 50mm, anamorphic flares, 8K ultra-HD.`,
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
      `Cinematic editorial photograph of the subject on a downtown rooftop at golden hour, skyline of glass towers behind, low sun rim-lighting from the side, ${color} colored gel as accent rim from camera-right. Warm cinematic grade, anamorphic 50mm, sharp subject, shallow DOF, 8K ultra-HD. Preserve facial likeness and outfit.`,
  },
  {
    id: "rooftop-night",
    name: "Rooftop · Night",
    description: "Skyline at night, color neon haze.",
    kind: "outdoor",
    preview: (c) =>
      `linear-gradient(180deg, #07060d 0%, #1a1424 40%, ${c}66 80%, ${c}aa 100%)`,
    prompt: (color) =>
      `Cinematic night rooftop portrait — city skyline glittering behind, atmospheric haze tinted ${color}, single hard key from camera-left, ${color} rim from behind. Preserve facial likeness and outfit. ARRI cinema look, 35mm anamorphic, 8K ultra-HD.`,
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
      `Cinematic night street portrait — wet pavement reflecting ${color} neon signage, motion-blurred passers-by, single hard key from above, anamorphic flares. Preserve facial likeness and outfit. 35mm cinema look, 8K ultra-HD.`,
  },
  {
    id: "alley",
    name: "Street · Alley",
    description: "Gritty alley, single overhead lamp + colored fill.",
    kind: "street",
    preview: (c) =>
      `radial-gradient(ellipse at 50% 20%, #f5e9c8 0%, transparent 35%), linear-gradient(180deg, #07060c 0%, ${c}55 70%, ${c}99 100%)`,
    prompt: (color) =>
      `Gritty urban alleyway portrait at night, wet pavement reflecting a single hard overhead lamp, ${color} colored fill from a doorway, brick walls softly out of focus, deep shadows. Preserve facial likeness and outfit. ARRI cinema look, anamorphic 35mm, 8K ultra-HD.`,
  },
];

/**
 * Shared hyper-realism grade appended to every Colors Studio prompt so all
 * output is graded ultra-HD photoreal regardless of setup.
 */
export const REALISM_SUFFIX =
  "Hyper-realistic photography, ultra-HD 8K resolution, shot on cinema glass — lifelike micro-texture in skin, fabric and every surface, physically accurate light falloff and reflections, true-to-life color, absolutely no CGI, illustration or plastic AI look.";

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

export type CompositorOpts = {
  /** Reference photo 2 is an outfit shot. */
  hasOutfitRef?: boolean;
  /** The LAST reference image is the exact studio scene to composite into. */
  hasSceneRef?: boolean;
  /**
   * Whether the subject's likeness comes from a still photo or a source
   * performance video. Video inputs need extraction + reprojection rules
   * instead of a static pose. Defaults to "image". The actual video
   * extraction/reprojection compositing is performed by the model/backend
   * (see the separate `performance_reskin` pipeline for driving-video jobs) —
   * this only controls which instructions are written into the prompt.
   */
  inputKind?: "image" | "video";
};

/** Structured compositor output — see task #198 "Wire the structured output schema". */
export type CompositorSpec = {
  type: "ai_performance_compositor";
  /** The locked scene/backdrop description used for this render. */
  scene: string;
  /** The color theme name (e.g. "deep royal blue"). */
  color: string;
  /** Camera framing/lens instructions. */
  camera: string;
  /** Lighting tone/reflection/shadow instructions driven by the color theme. */
  lighting: string;
  /** Human-readable description of the motion/pose behavior for this render. */
  motion_description: string;
  /** The full prompt string actually sent to the generation model. */
  final_render_prompt: string;
};

const COMPOSITOR_REALISM =
  "Hyper-realistic, ultra-HD 8K, lifelike skin micro-texture, physically accurate light and reflections, no CGI or illustration look, no text or logos.";

const CAMERA_BLOCK =
  "CAMERA: locked-off tripod performance framing, full-body 9:16 vertical, cinematic quality, 50mm at eye level, gentle depth of field.";

/**
 * Strict AI Performance Compositor pipeline: identity lock + scene lock +
 * color control + performance/motion rules + camera logic + consistency
 * embed. Returns the full structured spec (task #198 output contract);
 * `final_render_prompt` is what's actually dispatched to the model. Used when
 * the request also carries the actual studio scene image as the final
 * reference, so the model composites the real person into THAT exact set
 * instead of inventing one.
 * Must stay ≤ 2000 chars (server schema cap) for every color × setup combo.
 */
export function buildCompositorSpec(
  colorId: string,
  setupId: string,
  opts: CompositorOpts = {},
): CompositorSpec {
  const c = COLOR_PRESETS.find((x) => x.id === colorId) ?? COLOR_PRESETS[0];
  const s = SETUPS.find((x) => x.id === setupId) ?? SETUPS[0];
  const isPerformance = s.id === "performance";
  const inputKind = opts.inputKind ?? "image";

  const scene = isPerformance ? c.studioTemplate : s.prompt(c.promptName);
  const lighting = `${c.promptName} lighting tone — background, reflections and shadows graded to match.`;

  let motionBlock: string;
  let motion_description: string;
  if (isPerformance && inputKind === "video") {
    motionBlock =
      "PERFORMANCE MODE (video input): extract the subject from the source performance video. Preserve their motion and timing exactly. Reproject the subject into the studio scene above — ensure feet grounding and shadow realism, and match lighting direction to the studio.";
    motion_description =
      "Motion extracted and preserved from the source video, reprojected onto the subject with grounded feet, cast shadows and lighting matched to the studio.";
  } else if (isPerformance) {
    const { mic, pose, energy } = c.performance;
    motionBlock = `PERFORMANCE MODE (image input): ${pose}. Energy: ${energy}. Microphone: ${MIC_DETAIL[mic]}. Natural mic-interaction stance, subtle implied motion, lighting matching the color theme.`;
    motion_description = `${pose} — energy: ${energy}. Subtle implied motion, natural mic-interaction stance (no source motion to preserve).`;
  } else {
    motionBlock = `SCENE & STAGING: ${s.prompt(c.promptName)}`;
    motion_description = "Static portrait — no implied motion.";
  }

  const parts: string[] = [
    "You are an AI performance compositor: place the REAL person from the reference photos into the predefined studio scene and render one photoreal performance still.",
    `IDENTITY LOCK: use the uploaded face as identity reference — keep it EXACTLY the same (face, skin tone, hairstyle, facial hair, body proportions) and maintain facial consistency across all frames. Never change identity. ${
      opts.hasOutfitRef
        ? "Dress them in the exact outfit from reference photo 2."
        : "Keep the outfit they wear in photo 1."
    }`,
  ];
  if (isPerformance) {
    parts.push(
      `SCENE LOCK: use this studio scene EXACTLY, do not invent new backgrounds — ${c.studioTemplate}`,
    );
  }
  if (opts.hasSceneRef) {
    parts.push(
      "SCENE LOCK (reference image): the LAST reference image is the exact studio set. Reproduce it precisely — backdrop, floor, mic/furniture/light placement, reflections. Do not invent a new background or add props.",
    );
  }
  parts.push(
    `COLOR CONTROL: the entire set follows the ${c.promptName} theme — background, lighting tone, reflections and shadows are all graded ${c.promptName}.`,
  );
  parts.push(motionBlock);
  parts.push(CAMERA_BLOCK, COMPOSITOR_REALISM);
  const final_render_prompt = parts.join("\n");

  return {
    type: "ai_performance_compositor",
    scene,
    color: c.promptName,
    camera: CAMERA_BLOCK,
    lighting,
    motion_description,
    final_render_prompt,
  };
}

/**
 * Convenience wrapper returning just the prompt string — see
 * `buildCompositorSpec` for the full structured output.
 */
export function buildCompositorPrompt(
  colorId: string,
  setupId: string,
  opts: CompositorOpts = {},
): string {
  return buildCompositorSpec(colorId, setupId, opts).final_render_prompt;
}

// ─── Scene Builder — user-composed custom scenes ────────────────────────────

export type CustomMic = ColorPreset["performance"]["mic"] | "none";

export const CUSTOM_MIC_OPTIONS: { id: CustomMic; label: string }[] = [
  { id: "none", label: "No mic" },
  { id: "hanging", label: "Hanging vintage" },
  { id: "standing", label: "Standing chrome" },
  { id: "handheld", label: "Handheld SM58" },
  { id: "boom", label: "Overhead boom" },
];

export type CustomScene = {
  /** The environment / set description — the core of the scene. Required. */
  environment: string;
  mic: CustomMic;
  /** Optional pose / body direction. */
  pose: string;
  /** Optional performance energy / mood. */
  energy: string;
  /** Optional lighting direction (otherwise graded from the color theme). */
  lighting: string;
  /** Optional props / set dressing. */
  props: string;
};

export const EMPTY_CUSTOM_SCENE: CustomScene = {
  environment: "",
  mic: "none",
  pose: "",
  energy: "",
  lighting: "",
  props: "",
};

// GenerateSchema caps prompts at 4000 chars server-side; the fixed compositor
// blocks total ~1200, so cap each free-text field well under the remainder.
export const CUSTOM_SCENE_FIELD_MAX = 400;

/**
 * Same strict AI Performance Compositor contract as `buildCompositorSpec`,
 * but the scene comes from the user's Scene Builder inputs instead of a
 * preset setup. The selected color still drives the grade so custom scenes
 * stay on-brand for the Colors look. No bundled scene asset exists for a
 * custom scene, so the scene lock is prompt-only (opts.hasSceneRef ignored).
 */
export function buildCustomCompositorSpec(
  colorId: string,
  custom: CustomScene,
  opts: Pick<CompositorOpts, "hasOutfitRef"> = {},
): CompositorSpec {
  const c = COLOR_PRESETS.find((x) => x.id === colorId) ?? COLOR_PRESETS[0];
  const clip = (s: string) => s.trim().slice(0, CUSTOM_SCENE_FIELD_MAX);

  const sceneBits = [clip(custom.environment)];
  if (custom.props.trim()) sceneBits.push(`Set dressing: ${clip(custom.props)}.`);
  const scene = sceneBits.join(" ");

  const lighting = custom.lighting.trim()
    ? `${clip(custom.lighting)} — graded to the ${c.promptName} theme.`
    : `${c.promptName} lighting tone — background, reflections and shadows graded to match.`;

  const poseBits: string[] = [];
  if (custom.pose.trim()) poseBits.push(clip(custom.pose));
  if (custom.energy.trim()) poseBits.push(`Energy: ${clip(custom.energy)}.`);
  if (custom.mic !== "none") poseBits.push(`Microphone: ${MIC_DETAIL[custom.mic]}.`);
  const motion_description = poseBits.length
    ? `${poseBits.join(" ")} Subtle implied motion, natural stance.`
    : "Natural relaxed stance — no specific pose directed.";

  const parts: string[] = [
    "You are an AI performance compositor: place the REAL person from the reference photos into the custom scene below and render one photoreal performance still.",
    `IDENTITY LOCK: use the uploaded face as identity reference — keep it EXACTLY the same (face, skin tone, hairstyle, facial hair, body proportions) and maintain facial consistency across all frames. Never change identity. ${
      opts.hasOutfitRef
        ? "Dress them in the exact outfit from reference photo 2."
        : "Keep the outfit they wear in photo 1."
    }`,
    `SCENE LOCK: build this exact scene, do not invent a different setting — ${scene}`,
    `COLOR CONTROL: the entire set follows the ${c.promptName} theme — background, lighting tone, reflections and shadows are all graded ${c.promptName}.`,
    `LIGHTING: ${lighting}`,
    `STAGING: ${motion_description}`,
    CAMERA_BLOCK,
    COMPOSITOR_REALISM,
  ];

  return {
    type: "ai_performance_compositor",
    scene,
    color: c.promptName,
    camera: CAMERA_BLOCK,
    lighting,
    motion_description,
    final_render_prompt: parts.join("\n"),
  };
}

/**
 * Motion directive for animating a finished COLORS still into a short
 * loopable performance clip (image → video). Must stay ≤ 1000 chars.
 */
export const ANIMATE_LOOP_PROMPT =
  "Animate the subject subtly: natural breathing, gentle head movement and sway, soft microphone interaction with the hands. Preserve the face, outfit, studio set, lighting and color grade EXACTLY as the source frame — do not add new elements or change the scene. Locked-off tripod camera. Seamless loopable 5-second performance clip.";

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
