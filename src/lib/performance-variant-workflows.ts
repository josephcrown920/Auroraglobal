export type PerformanceVariantKind = "build_scene" | "luxury_interior";

export type ReferenceSlot = {
  id: string;
  label: string;
  guidance: string;
};

export type AnglePreset = {
  id: string;
  label: string;
  direction: string;
};

export const REANGLE_PRESETS: AnglePreset[] = [
  { id: "side_superclose", label: "Side-profile super close", direction: "Super-close side profile, shallow depth of field, preserve facial geometry and skin texture." },
  { id: "wide_behind", label: "Wide from behind", direction: "Wide shot from behind, preserve wardrobe, silhouette, set geography and prop placement." },
  { id: "low_angle", label: "Low angle", direction: "Low hero angle looking upward, same subject, outfit, scene and practical lighting." },
  { id: "extreme_face", label: "Extreme face close-up", direction: "Extreme facial close-up with ARRI cinema skin rendering and shallow depth of field." },
  { id: "over_shoulder", label: "Over shoulder", direction: "Over-the-shoulder composition revealing the same environment and action." },
  { id: "dutch", label: "Dutch angle", direction: "Controlled Dutch angle with the same scene geometry and subject continuity." },
];

export const VEHICLES = ["Maybach", "Rolls-Royce", "Lamborghini", "Bentley", "Private jet", "Custom"] as const;
export const LUXURY_INTERIOR_PRESETS: AnglePreset[] = VEHICLES.map((vehicle) => ({
  id: `interior_${vehicle.toLowerCase().replace(/[^a-z]+/g, "_")}`,
  label: `${vehicle} interior`,
  direction: `Place the same seated performer in a ${vehicle} interior. Preserve identity, outfit, seated framing, action and through-window camera position.`,
}));

export const PERFORMANCE_VARIANT_CATALOG = {
  build_scene: {
    label: "Build a Scene",
    description: "Five-role reference composition, one approved base, then continuity-locked re-angles.",
    references: [
      { id: "identity", label: "Identity selfie", guidance: "Clear face and identity source." },
      { id: "outfit", label: "Outfit", guidance: "Full look, fabric and accessories." },
      { id: "location", label: "Location", guidance: "The environment and practical lighting." },
      { id: "composition", label: "Pose / composition", guidance: "Body pose and camera framing." },
      { id: "prop", label: "Car / prop", guidance: "The exact hero prop to preserve." },
    ] satisfies ReferenceSlot[],
  },
  luxury_interior: {
    label: "Luxury Interior",
    description: "Through-window seated performance with identity and interior continuity.",
    references: [
      { id: "composition", label: "Window composition", guidance: "Required through-window seated framing." },
      { id: "interior", label: "Interior", guidance: "Required cabin materials and layout." },
      { id: "identity", label: "Identity", guidance: "Required subject identity and default outfit." },
    ] satisfies ReferenceSlot[],
  },
} as const;

export function requiredReferenceIds(kind: PerformanceVariantKind): string[] {
  return PERFORMANCE_VARIANT_CATALOG[kind].references.map((reference) => reference.id);
}