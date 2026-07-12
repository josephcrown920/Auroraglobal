import { computeCost } from "@/lib/pricing";

export const SCENE_BUILDER_COST_BASE = computeCost({ features: ["image"] }).total;
export const SCENE_BUILDER_COST_REANGLE = computeCost({ features: ["image"] }).total;

export const SLOT_LABELS = [
  "Selfie",
  "Outfit",
  "Location",
  "Pose",
  "Prop / Car",
] as const;

export const SLOT_HINTS = [
  "Clear front-facing portrait",
  "Full outfit photo",
  "The set or environment",
  "Desired body pose reference",
  "Featured prop, vehicle or object",
] as const;

// ─── Base scene compositor prompt template ────────────────────────────────────
// {outfit}, {location}, {prop} are swap fields edited by the user in the UI.

export const BASE_SCENE_TEMPLATE = `You are an AI scene compositor. Using ALL uploaded reference images as the source of truth, render one photoreal cinematic scene.

IDENTITY LOCK: preserve the exact person from the selfie reference — face, skin tone, hairstyle, facial hair, and body proportions. Never alter their identity.

OUTFIT: The subject wears exactly: {outfit}

LOCATION: The scene takes place at: {location}

PROP: Featured prominently in the scene: {prop}

POSE: Match the body language and position from the pose reference image.

COMPOSITING INSTRUCTIONS: Place the real person into the location environment, wearing the specified outfit, in the specified pose, with the prop visibly featured. Match the lighting from the location reference image. Preserve all faces and identities from the references.

Hyper-realistic photography, ultra-HD 8K resolution, shot on cinema glass — lifelike micro-texture in skin, fabric and every surface, physically accurate light falloff and reflections, true-to-life color, absolutely no CGI or illustration look.`;

export function buildBaseScenePrompt(
  outfit: string,
  location: string,
  prop: string,
): string {
  return BASE_SCENE_TEMPLATE
    .replace("{outfit}", outfit.trim() || "the outfit visible in the outfit reference image")
    .replace("{location}", location.trim() || "the environment shown in the location reference image")
    .replace("{prop}", prop.trim() || "any props or objects from the prop reference image");
}

// ─── Re-angle chips ────────────────────────────────────────────────────────────
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
      "Wide establishing shot — full body with generous negative space around the subject, the environment fills the frame, 35mm equivalent lens.",
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
      "Pure side profile — camera at exactly 90° to the subject, clean silhouette, subject looking straight ahead.",
  },
  {
    id: "closeup",
    label: "Close-Up Face",
    cameraPrompt:
      "Intimate face close-up — framed from upper chest to crown, face fills the frame, background softly bokeh'd, 85mm portrait lens.",
  },
  {
    id: "overshoulder",
    label: "Over Shoulder",
    cameraPrompt:
      "Over-the-shoulder perspective — camera positioned just behind one shoulder, near shoulder softly blurred in foreground.",
  },
  {
    id: "dutch",
    label: "Dutch Angle",
    cameraPrompt:
      "Dutch angle / canted frame — camera tilted 15–25° off horizontal for cinematic disorientation. Subject remains sharp.",
  },
];

export function buildReAnglePrompt(chipOrFreeform: string): string {
  return `Re-angle this exact scene from a new camera position. Keep every element of the subject's appearance, outfit, environment, lighting, and atmosphere IDENTICAL — only the camera position and framing change. Do not add, remove, or alter any element of the scene.

CAMERA & FRAMING: ${chipOrFreeform}

Hyper-realistic photography, ultra-HD 8K resolution, no CGI or illustration look.`;
}
