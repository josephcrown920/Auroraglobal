export type ColorPreset = {
  id: string;
  name: string;
  swatch: string;
  promptName: string;
  glow: string;
  performance: { mic: "hanging" | "standing" | "handheld" | "boom"; pose: string; energy: string };
  studioTemplate: string;
};

export const COLOR_PRESETS: ColorPreset[] = [
  { id: "hot-pink", name: "Hot Pink", swatch: "#ff2d8a", promptName: "vivid hot pink", glow: "rgba(255,45,138,0.35)", performance: { mic: "standing", pose: "three-quarter body facing camera-left, one hand resting on a tall chrome mic stand, head tilted up", energy: "confident, slow ballad delivery" }, studioTemplate: "Hot Pink Cyclorama Studio: seamless curved cyc wall and floor in matte vivid hot pink, single tall chrome floor-standing microphone centered in frame, warm pink-tinted softbox key from camera-right, soft pink rim light, minimal hard shadows, clean editorial staging." },
  { id: "royal-blue", name: "Royal Blue", swatch: "#1e40af", promptName: "deep royal blue", glow: "rgba(30,64,175,0.35)", performance: { mic: "hanging", pose: "full-body side profile, leaning into a vintage silver microphone hanging at chest level from above", energy: "calm composed power" }, studioTemplate: "Royal Blue Cyclorama Studio: seamless curved cyc backdrop and floor in matte deep royal blue, single vintage silver studio microphone hanging on a thin cable from above, plain black wooden stool positioned directly under the mic, single soft spotlight from directly above, subtle cool floor reflection, minimal shadows." },
  { id: "neon-green", name: "Neon Green", swatch: "#39ff14", promptName: "electric neon green", glow: "rgba(57,255,20,0.3)", performance: { mic: "boom", pose: "head tilted back, eyes closed, screaming into an overhead boom mic, arms loose at sides", energy: "raw cathartic shout" }, studioTemplate: "Neon Green Cyclorama Studio: seamless curved cyc wall and floor in electric neon green, long overhead boom-arm mic with blimp windscreen from top-right, hard single-source fresnel spotlight from directly above, strong neon green ambient bounce, electric green floor glow beneath subject." },
  { id: "sunset-orange", name: "Sunset Orange", swatch: "#ff6a00", promptName: "warm sunset orange", glow: "rgba(255,106,0,0.35)", performance: { mic: "handheld", pose: "mid-stride across the frame, handheld dynamic SM58 close to mouth, free hand pointing at the lens", energy: "hyped, mid-verse" }, studioTemplate: "Sunset Orange Cyclorama Studio: seamless curved cyc in warm sunset orange, floor tinted amber-orange, no furniture — open floor space for movement, warm dual-softbox setup, orange-tinted haze, golden floor reflection under feet." },
  { id: "electric-purple", name: "Electric Purple", swatch: "#8b5cf6", promptName: "electric violet purple", glow: "rgba(139,92,246,0.35)", performance: { mic: "standing", pose: "eyes closed, both hands wrapped around the mic on a vintage stand, body slightly swaying", energy: "lost in the song, reverb-soaked" }, studioTemplate: "Electric Purple Cyclorama Studio: seamless curved cyc in deep electric violet-purple, vintage chrome microphone on a tall floor stand, moody low-key purple ambient wash from above, single hair light from directly above, delicate floor reflection." },
  { id: "cyber-yellow", name: "Cyber Yellow", swatch: "#facc15", promptName: "saturated cyber yellow", glow: "rgba(250,204,21,0.35)", performance: { mic: "handheld", pose: "frozen mid-jump with both feet off the ground, handheld mic in one hand", energy: "explosive hype moment" }, studioTemplate: "Cyber Yellow Cyclorama Studio: seamless curved cyc in saturated cyber yellow, empty open floor space, bright high-key dual softbox setup, sharp punchy shadows under subject, yellow floor reflection, bold high-contrast editorial staging." },
  { id: "crimson-red", name: "Crimson Red", swatch: "#dc2626", promptName: "deep crimson red", glow: "rgba(220,38,38,0.35)", performance: { mic: "hanging", pose: "back three-quarters to camera, turning over the shoulder toward a hanging vintage mic", energy: "slow brooding turn" }, studioTemplate: "Crimson Red Cyclorama Studio: seamless curved cyc in deep crimson red, single vintage silver microphone hanging from center-top, low dramatic rim light from behind in deep red, single hard key light from camera-left, rich red floor reflection, brooding theatrical staging." },
  { id: "ice-white", name: "Ice White", swatch: "#f8fafc", promptName: "pure monochrome white", glow: "rgba(248,250,252,0.2)", performance: { mic: "boom", pose: "standing centered with hands clasped near the chest, overhead boom mic just visible at top of frame", energy: "still, gospel-prayer stillness" }, studioTemplate: "Ice White Cyclorama Studio: seamless curved cyc in pure clean white, long overhead boom arm with professional shock-mount mic from top center, soft even studio fill from two large diffused octaboxes, very slight floor shadow beneath subject, clean minimal staging." },
  { id: "obsidian", name: "Obsidian Black", swatch: "#0a0a0a", promptName: "matte obsidian black", glow: "rgba(100,100,100,0.2)", performance: { mic: "standing", pose: "lone figure under a single hard spotlight, standing mic with windscreen, silhouette edge-lit", energy: "noir, smoky club mood" }, studioTemplate: "Obsidian Black Cyclorama Studio: seamless curved cyc in matte obsidian black, vintage floor-standing microphone with windscreen center frame, single hard narrow spotlight from directly above, subtle silver-white edge rim from behind, dramatic noir club atmosphere." },
  { id: "aqua", name: "Aqua Teal", swatch: "#06b6d4", promptName: "luminous aqua teal", glow: "rgba(6,182,212,0.35)", performance: { mic: "hanging", pose: "low-angle hero shot looking up, chin slightly raised, hanging mic descending into frame", energy: "anthemic hero pose" }, studioTemplate: "Aqua Teal Cyclorama Studio: seamless curved cyc in luminous aqua teal, vintage hanging microphone from above, low camera angle for anthemic hero framing, bold aqua-teal softbox key from below-front, cyan rim light from behind, glossy floor with strong aqua reflection." },
  { id: "rose-gold", name: "Rose Gold", swatch: "#e8b4a0", promptName: "soft rose gold", glow: "rgba(232,180,160,0.3)", performance: { mic: "standing", pose: "seated on a tall barstool, vintage standing mic at mouth height, legs crossed", energy: "intimate acoustic ballad" }, studioTemplate: "Rose Gold Cyclorama Studio: seamless curved cyc in soft rose gold with warm blush undertone, tall vintage chrome standing microphone, plain velvet-upholstered tall barstool, warm rose-tinted softbox key from camera-right at 45°, gentle golden-peach fill, warm rose floor reflection." },
  { id: "lime-pop", name: "Lime Pop", swatch: "#a3e635", promptName: "fluorescent lime", glow: "rgba(163,230,53,0.35)", performance: { mic: "handheld", pose: "leaning back away from camera with handheld mic raised overhead, free hand on hip", energy: "swagger, lean-back flex" }, studioTemplate: "Lime Pop Cyclorama Studio: seamless curved cyc in fluorescent lime green, open floor with no furniture, high-energy dual fill lights, punchy on-camera hard fill from front, vivid lime floor bounce reflection under feet, bold graphic editorial staging." },
];

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
  preview: (hex: string) => string;
  prompt: (color: string) => string;
};

export const SETUPS: Setup[] = [
  { id: "performance", name: "Performance · Per-color staging", description: "Each color has its own mic style, pose, and energy.", kind: "performance", preview: (c) => `radial-gradient(ellipse at 50% 65%, ${c}ee 0%, ${c}88 40%, ${c}22 100%)`, prompt: (color) => `Editorial performance shot on a seamless ${color} cyclorama. Preserve facial likeness. 8K ultra-HD cinematic.` },
  { id: "wide", name: "Studio · Wide", description: "Seamless cyclorama, full body, the color floods the frame.", kind: "studio", preview: (c) => `radial-gradient(ellipse at 50% 70%, ${c}cc 0%, ${c}80 35%, ${c}30 100%)`, prompt: (color) => `Wide full-body editorial photograph on a seamless ${color} cyclorama studio backdrop. Bold monochromatic styling, soft studio softboxes from camera-left, ${color} rim light. Preserve exact facial likeness. ARRI Alexa look, 50mm lens, 8K ultra-HD.` },
  { id: "closeup", name: "Studio · Close-Up", description: "Beauty crop with the color as a glowing gel wash.", kind: "studio", preview: (c) => `radial-gradient(circle at 35% 40%, ${c}ff 0%, ${c}60 40%, #0a0a0a 90%)`, prompt: (color) => `Intimate cinematic close-up, shoulders up. Saturated ${color} gel light washes one side of the face, deep shadow on the other. Preserve facial likeness. f/1.8 anamorphic 85mm, hyper-real skin pores, 8K ultra-HD editorial beauty shot.` },
  { id: "split-color", name: "Studio · Split Color", description: "Two-tone gels split the face down the middle.", kind: "studio", preview: (c) => `linear-gradient(90deg, ${c} 0%, ${c} 50%, #f5f5f5 50%, #e5e5e5 100%)`, prompt: (color) => `Bold dual-tone studio portrait — one side lit by saturated ${color} gel, the other by neutral white, hard vertical split down center of face. Preserve facial likeness. High-contrast fashion editorial, 8K ultra-HD.` },
  { id: "neon-bath", name: "Studio · Neon Bath", description: "Subject surrounded by glowing neon strips of the color.", kind: "studio", preview: (c) => `repeating-linear-gradient(180deg, #0a0a0a 0px, #0a0a0a 14px, ${c} 14px, ${c} 18px)`, prompt: (color) => `Cinematic portrait inside a dark room lined with glowing ${color} neon strips wrapping the walls. Atmospheric haze, anamorphic flares, Blade Runner palette dominated by ${color}. Preserve facial likeness. 8K ultra-HD.` },
  { id: "color-smoke", name: "Studio · Color Smoke", description: "Plumes of colored smoke swirl mid-action.", kind: "studio", preview: (c) => `radial-gradient(ellipse at 30% 60%, ${c}cc 0%, transparent 50%), radial-gradient(ellipse at 75% 35%, ${c}99 0%, transparent 55%), #0a0a0a`, prompt: (color) => `Editorial action portrait mid-motion with thick swirling ${color} smoke billowing around, lit dramatically from behind so smoke glows. Preserve facial likeness. Medium format, sharp subject, soft smoke, 8K ultra-HD.` },
  { id: "indoor-bedroom", name: "Indoor · Bedroom Suite", description: "Luxe hotel bedroom, lamp warmth + colored window light.", kind: "indoor", preview: (c) => `linear-gradient(160deg, #2a1a14 0%, #5a3320 35%, ${c}88 70%, ${c}cc 100%)`, prompt: (color) => `Cinematic editorial portrait inside a luxe hotel bedroom suite — warm tungsten bedside lamps + ${color} colored gel spilling through the window. Subject seated on the edge of a made bed. Preserve facial likeness. 35mm anamorphic, shallow DOF, ARRI grade, 8K ultra-HD.` },
  { id: "indoor-kitchen", name: "Indoor · Kitchen", description: "Modern kitchen, practicals + colored fill from a hallway.", kind: "indoor", preview: (c) => `linear-gradient(180deg, #f5f0e8 0%, #d8cfc1 40%, ${c}66 70%, ${c}aa 100%)`, prompt: (color) => `Cinematic editorial portrait inside a modern kitchen — marble counters, brass fixtures, warm overhead practicals and a colored ${color} wash spilling from an adjoining hallway. Subject leaning against the counter. Preserve facial likeness. 35mm, shallow DOF, filmic grade, 8K ultra-HD.` },
  { id: "indoor-lounge", name: "Indoor · Lounge", description: "Velvet lounge with colored uplighters.", kind: "indoor", preview: (c) => `linear-gradient(180deg, #1a0a14 0%, ${c}55 50%, ${c}cc 100%)`, prompt: (color) => `Cinematic editorial portrait inside a moody lounge — velvet booth, low brass table, ${color} uplighters washing the walls, single warm pendant key. Subject lounging, half in shadow. Preserve facial likeness. 50mm, anamorphic flares, 8K ultra-HD.` },
  { id: "rooftop", name: "Rooftop · Golden Hour", description: "Downtown rooftop, skyline backdrop, color rim light.", kind: "outdoor", preview: (c) => `linear-gradient(180deg, ${c}aa 0%, ${c}55 45%, #1a1a2a 65%, #0a0a14 100%)`, prompt: (color) => `Cinematic editorial photograph on a downtown rooftop at golden hour, skyline of glass towers behind, low sun rim-lighting from the side, ${color} colored gel as accent rim from camera-right. Preserve facial likeness. Anamorphic 50mm, shallow DOF, 8K ultra-HD.` },
  { id: "rooftop-night", name: "Rooftop · Night", description: "Skyline at night, color neon haze.", kind: "outdoor", preview: (c) => `linear-gradient(180deg, #07060d 0%, #1a1424 40%, ${c}66 80%, ${c}aa 100%)`, prompt: (color) => `Cinematic night rooftop portrait — city skyline glittering behind, atmospheric haze tinted ${color}, single hard key from camera-left, ${color} rim from behind. Preserve facial likeness. ARRI cinema look, 35mm anamorphic, 8K ultra-HD.` },
  { id: "neon-street", name: "Street · Neon Night", description: "Wet street, signage reflections in the chosen color.", kind: "street", preview: (c) => `linear-gradient(180deg, #06050b 0%, #0c0a16 45%, ${c}88 75%, ${c}cc 100%)`, prompt: (color) => `Cinematic night street portrait — wet pavement reflecting ${color} neon signage, motion-blurred passers-by, single hard key from above, anamorphic flares. Preserve facial likeness. 35mm cinema look, 8K ultra-HD.` },
  { id: "alley", name: "Street · Alley", description: "Gritty alley, single overhead lamp + colored fill.", kind: "street", preview: (c) => `radial-gradient(ellipse at 50% 20%, #f5e9c8 0%, transparent 35%), linear-gradient(180deg, #07060c 0%, ${c}55 70%, ${c}99 100%)`, prompt: (color) => `Gritty urban alleyway portrait at night, wet pavement reflecting a single hard overhead lamp, ${color} colored fill from a doorway, brick walls softly out of focus. Preserve facial likeness. ARRI cinema look, anamorphic 35mm, 8K ultra-HD.` },
];

const MIC_DETAIL: Record<ColorPreset["performance"]["mic"], string> = {
  hanging: "an exact suspended vintage silver studio microphone hanging from a thin cable from above the frame",
  standing: "a vintage chrome microphone on a tall floor stand, photoreal Shure-style capsule with windscreen",
  handheld: "a handheld dynamic stage microphone (Shure SM58 type) gripped tightly",
  boom: "a long overhead boom-arm microphone descending into the top of frame, professional shock-mount, blimp windscreen",
};

const REALISM = "Hyper-realistic photography, ultra-HD 8K resolution, shot on cinema glass — lifelike micro-texture in skin, fabric and every surface, physically accurate light falloff and reflections, true-to-life color, no CGI, illustration or plastic AI look.";

export type CameraMode = "tripod" | "push-in" | "handheld" | "closeup";
export type OutputMode = "image" | "video";

const CAMERA_INSTRUCTIONS: Record<CameraMode, string> = {
  "tripod":   "CAMERA: locked-off tripod performance framing, full-body 9:16 vertical, 50mm at eye level, gentle depth of field.",
  "push-in":  "CAMERA: slow cinematic push-in starting wide full-body, drifting toward a medium close-up, smooth and deliberate, 50mm, 9:16 vertical.",
  "handheld": "CAMERA: slight handheld realism — subtle micro-sway, organic energy, full-body 9:16, 35mm at eye level.",
  "closeup":  "CAMERA: tight close-up cut — face and shoulders only, 85mm f/1.8, shallow DOF, cinematic 9:16.",
};

const MOTION_INSTRUCTIONS =
  "MOTION (animated clip): animate the subject with subtle lifelike movement — slow natural breathing (gentle chest rise-and-fall), micro head movement and weight shift, natural mic interaction matching the pose. Loopable 3–5 second performance clip. Do NOT teleport or jump-cut. Movement must feel organic and continuous.";

export function buildPrompt(
  colorId: string,
  setupId: string,
  hasOutfitRef = false,
  outputMode: OutputMode = "image",
  cameraMode: CameraMode = "tripod",
): string {
  const c = COLOR_PRESETS.find((x) => x.id === colorId) ?? COLOR_PRESETS[0];
  const s = SETUPS.find((x) => x.id === setupId) ?? SETUPS[0];
  const isPerf = s.id === "performance";
  const isVideo = outputMode === "video";

  if (isPerf) {
    const { mic, pose, energy } = c.performance;
    return [
      `You are an AI performance compositor: place the REAL person from the reference photos into the predefined studio scene and render one photoreal performance ${isVideo ? "animated clip" : "still"}.`,
      `IDENTITY LOCK: use the uploaded face as identity reference — keep it EXACTLY the same (face, skin tone, hairstyle, facial hair, body proportions). ${hasOutfitRef ? "Dress them in the exact outfit from reference photo 2." : "Keep the outfit they wear in photo 1."}`,
      `SCENE LOCK: use this studio scene EXACTLY — ${c.studioTemplate}`,
      `COLOR CONTROL: the entire set follows the ${c.promptName} theme — background, lighting tone, reflections and shadows are all graded ${c.promptName}.`,
      `PERFORMANCE MODE: ${pose}. Energy: ${energy}. Microphone: ${MIC_DETAIL[mic]}.`,
      CAMERA_INSTRUCTIONS[cameraMode],
      isVideo ? MOTION_INSTRUCTIONS : "",
      REALISM,
    ].filter(Boolean).join("\n");
  }

  return [
    `You are an AI performance compositor: place the REAL person from the reference photos into the predefined studio scene${isVideo ? " and animate it" : ""}.`,
    `IDENTITY LOCK: use the uploaded face as identity reference. ${hasOutfitRef ? "Dress them in the exact outfit from reference photo 2." : "Keep the outfit they wear in photo 1."}`,
    `COLOR CONTROL: ${c.promptName} theme throughout.`,
    s.prompt(c.promptName),
    CAMERA_INSTRUCTIONS[cameraMode],
    isVideo ? MOTION_INSTRUCTIONS : "",
    REALISM,
  ].filter(Boolean).join("\n");
}
