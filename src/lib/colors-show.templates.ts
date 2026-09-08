import { COLOR_PRESETS, REALISM_SUFFIX } from "@/lib/colors.presets";
import { computeCost } from "@/lib/pricing";

export const COLORS_SHOW_COST_PER_SHOT = computeCost({ features: ["image"] }).total;

// ─── Shot template strings with {color} and {outfit} replacement tokens ───────
// These are the two canonical Colors Show framing presets. At render time,
// {color} → the color name (e.g. "deep royal blue") and
// {outfit} → the user's outfit description.

export const WIDE_SHOT_TEMPLATE = `You are an AI performance compositor. Place the REAL person from the selfie reference photo into this exact studio scene and render one photoreal performance still.

IDENTITY LOCK: preserve the subject's exact face, skin tone, hairstyle, facial hair, and body proportions from the selfie. Never alter their identity.

OUTFIT: {outfit}

SCENE LOCK — reproduce this studio exactly: {color} Cyclorama Studio — monochrome seamless curved cyc wall and floor in {color} with no visible seams, staged on a wide open performance platform. Single vintage silver studio microphone hanging on a thin cable from center-top descending to chest height. Warm {color}-tinted softbox key from camera-right, soft {color} rim light from behind. Faint floor reflection of the subject's silhouette. No furniture.

CAMERA & FRAMING: Full-body performance shot, head to toe, subject centered, vertical 9:16 portrait, 50mm at eye level, gentle depth of field.

PERFORMANCE: Natural mic-interaction stance — one hand lightly near the hanging mic, body turned slightly toward camera, eyes meeting the lens, subtle implied motion.

${REALISM_SUFFIX}`;

export const CLOSEUP_SHOT_TEMPLATE = `You are an AI performance compositor. Place the REAL person from the selfie reference photo into this exact studio scene and render one photoreal beauty close-up.

IDENTITY LOCK: preserve the subject's exact face, skin tone, hairstyle, facial hair, and eye detail from the selfie. Never alter their identity.

OUTFIT: {outfit} — only the neckline and collar are visible at the bottom of frame.

SCENE LOCK — reproduce this studio exactly: the same wide open performance platform in the {color} Cyclorama Studio — monochrome {color} seamless backdrop and floor filling the frame behind the subject. Warm {color}-tinted softbox key from camera-right, soft fill from camera-left. The exact same hanging vintage silver microphone is softly blurred in the upper background.

CAMERA & FRAMING: Intimate beauty close-up, framed from upper chest to crown, face fills the frame, background softly bokeh'd, 85mm portrait lens at f/1.8. Crisp catch-lights in the eyes.

${REALISM_SUFFIX}`;

export function buildWidePrompt(color: string, outfit: string, location?: string): string {
  const base = WIDE_SHOT_TEMPLATE.replace(/{color}/g, color).replace(/{outfit}/g, outfit);
  return location?.trim()
    ? base.replace(
        /SCENE LOCK[\s\S]*?No furniture\./,
        `SCENE LOCK — reproduce this custom performance location consistently in every angle: ${location.trim()}. Keep one vintage silver microphone hanging from a thin cable at chest height.`,
      )
    : base;
}

export function buildCloseupPrompt(color: string, outfit: string, location?: string): string {
  const base = CLOSEUP_SHOT_TEMPLATE.replace(/{color}/g, color).replace(/{outfit}/g, outfit);
  return location?.trim()
    ? base.replace(
        /SCENE LOCK[\s\S]*?background\./,
        `SCENE LOCK — use the exact same custom location as the wide plate: ${location.trim()}. The same hanging vintage silver microphone is softly blurred in the upper background.`,
      )
    : base;
}

export const COLORS_SHOW_STEPS = [
  {
    id: "upload",
    title: "Your References",
    subtitle: "Upload your selfie and any Colors reference shots",
  },
  {
    id: "color",
    title: "Color Theme",
    subtitle: "Choose your signature studio color",
  },
  {
    id: "outfit",
    title: "Your Look",
    subtitle: "Describe exactly what you are wearing",
  },
  {
    id: "wide",
    title: "Wide Shot",
    subtitle: "Generate your full-body performance still",
  },
  {
    id: "closeup",
    title: "Close-Up Shot",
    subtitle: "Generate your beauty close-up",
  },
  {
    id: "record",
    title: "Now Record",
    subtitle: "Shoot your real video matching these angles",
  },
  {
    id: "animate",
    title: "Animate",
    subtitle: "Bring your stills to life in Motion Control",
  },
] as const;

export type ColorsShowStep = (typeof COLORS_SHOW_STEPS)[number]["id"];

export const RECORD_CHECKLIST = [
  {
    icon: "📐",
    label: "Wide angle first",
    detail: "Stand the same distance from camera as the generated wide shot — full body in frame",
  },
  {
    icon: "🎤",
    label: "Mime the hanging mic pose",
    detail: "Hold one hand near an imaginary mic at chest height; interact with it naturally",
  },
  {
    icon: "👗",
    label: "Wear exactly what you described",
    detail: "The outfit must match step 3 for the compositor to lock identity correctly",
  },
  {
    icon: "📷",
    label: "Steady camera",
    detail: "Tripod or phone holder — a still camera gives crisper frames for Motion Control",
  },
  {
    icon: "💡",
    label: "Light from your right side",
    detail: "Face a window or softbox on your right to mimic the studio key light direction",
  },
  {
    icon: "🔍",
    label: "Then shoot the close-up",
    detail: "Move the camera closer — frame from upper chest to crown, matching the 85mm crop",
  },
];
