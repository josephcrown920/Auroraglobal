import { computeCost } from "@/lib/pricing";

export const SCENE_BUILDER_COST_PER_ANGLE = computeCost({ features: ["image"] }).total;

export const SCENE_BUILDER_SLOT_COUNT = 5;

export type ReAngleChip = {
  id: string;
  label: string;
  cameraPrompt: string;
};

export const RE_ANGLE_CHIPS: ReAngleChip[] = [
  {
    id: "wide",
    label: "Wide Shot",
    cameraPrompt:
      "Wide establishing shot — full body with generous negative space around the subject, environment fills the frame. 35mm equivalent.",
  },
  {
    id: "low",
    label: "Low Angle",
    cameraPrompt:
      "Low angle hero shot — camera positioned below waist level looking up at the subject, dramatic upward perspective, sky or ceiling visible above.",
  },
  {
    id: "side",
    label: "Side Profile",
    cameraPrompt:
      "Pure side profile — camera at 90° to the subject, clean silhouette, subject looking straight ahead.",
  },
  {
    id: "closeup",
    label: "Close-Up Face",
    cameraPrompt:
      "Intimate face close-up — framed from upper chest to crown, face fills the frame, background softly bokeh'd. 85mm portrait lens.",
  },
  {
    id: "overshoulder",
    label: "Over Shoulder",
    cameraPrompt:
      "Over-the-shoulder perspective — camera positioned just behind one shoulder looking forward, near shoulder slightly blurred in foreground.",
  },
  {
    id: "dutch",
    label: "Dutch Angle",
    cameraPrompt:
      "Dutch angle / canted frame — camera tilted 15–25° off horizontal for cinematic disorientation and tension. Subject remains sharp.",
  },
];

export function buildSceneBuilderPrompt(
  compositorPrompt: string,
  angle: ReAngleChip,
): string {
  const parts: string[] = [
    "You are an AI scene compositor. Using ALL uploaded reference images as the source of truth, render one photoreal composite still that matches the scene description below.",
    "IDENTITY LOCK: preserve every subject's exact appearance — face, outfit, hair, skin tone — from the reference images. If multiple people appear in the references, include them all.",
    "SCENE LOCK: reproduce the environment, props, lighting, and atmosphere described below exactly. Do not invent new backgrounds or add props not described.",
    `SCENE DESCRIPTION:\n${compositorPrompt.trim()}`,
    `CAMERA & FRAMING: ${angle.cameraPrompt}`,
    "Hyper-realistic photography, ultra-HD 8K resolution, shot on cinema glass — lifelike micro-texture in skin, fabric and every surface, physically accurate light falloff and reflections, true-to-life color, absolutely no CGI, illustration or plastic AI look.",
  ];
  return parts.join("\n\n");
}

export const DEFAULT_COMPOSITOR_PROMPT =
  "A professional music video set. The subject stands center-frame under a single spotlight on a clean studio stage. Cinematic lighting with a strong key from camera-right, deep background shadows, and a subtle violet rim light separating the subject from the background. Atmospheric haze near the floor. Minimal, high-fashion editorial staging.";
