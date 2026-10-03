/**
 * Aurora Perform Anywhere workflow registry.
 * A workflow is production-ready only after a real provider smoke test
 * produces and records an artifact.
 */

export type PerformAnywhereWorkflow = {
  id: string;
  title: string;
  category: "studio" | "car" | "surreal" | "lifestyle" | "performance" | "street";
  inputs: string[];
  requiredStages: string[];
  depthModes: string[];
  vfx: string[];
  guardrails: string[];
  status: "needs-proof";
};

const COMMON_DEPTH = ["depth_map", "depth_occlusion", "depth_parallax"];
const COMMON_VFX = ["light_wrap", "volumetric_light", "depth_bokeh", "film_grain"];

export const PERFORM_ANYWHERE_WORKFLOWS: PerformAnywhereWorkflow[] = [
  {
    id: "studio-white-cyclorama",
    title: "White Cyclorama Studio",
    category: "studio",
    inputs: ["authorized performer identity", "performance reference"],
    requiredStages: ["identity", "scene", "performance", "motion", "rotoscope", "depth", "occlusion", "vfx", "composite", "color", "export"],
    depthModes: COMMON_DEPTH,
    vfx: COMMON_VFX,
    guardrails: ["preserve performer identity", "no accidental extra people", "studio background continuity", "protect face and hair"],
    status: "needs-proof",
  },
  {
    id: "studio-black-shadow",
    title: "Black Shadow Studio",
    category: "studio",
    inputs: ["authorized performer identity", "performance reference", "shadow-light direction"],
    requiredStages: ["identity", "scene", "performance", "motion", "rotoscope", "depth", "lighting", "vfx", "composite", "export"],
    depthModes: ["depth_map", "depth_occlusion", "depth_relight"],
    vfx: ["light_wrap", "volumetric_light", "film_grain", "lens_flare"],
    guardrails: ["deep-black background continuity", "controlled rim light", "preserve silhouette and identity"],
    status: "needs-proof",
  },
  {
    id: "studio-luxury",
    title: "Luxury Studio",
    category: "studio",
    inputs: ["authorized performer identity", "performance reference", "luxury environment reference"],
    requiredStages: ["identity", "scene", "performance", "motion", "rotoscope", "depth", "lighting", "vfx", "composite", "color", "export"],
    depthModes: COMMON_DEPTH,
    vfx: ["light_wrap", "depth_bokeh", "lens_flare", "film_grain"],
    guardrails: ["preserve luxury geometry", "identity lock", "wardrobe continuity"],
    status: "needs-proof",
  },
  {
    id: "car-interior",
    title: "Car Interior",
    category: "car",
    inputs: ["authorized performer identity", "vehicle interior reference", "performance reference"],
    requiredStages: ["identity", "vehicle", "scene", "performance", "motion", "rotoscope", "depth", "occlusion", "lighting", "vfx", "composite", "export"],
    depthModes: ["depth_map", "depth_occlusion", "depth_relight"],
    vfx: ["light_wrap", "lens_flare", "motion_trails", "film_grain"],
    guardrails: ["vehicle interior consistency", "correct body/seat occlusion", "preserve face and wardrobe"],
    status: "needs-proof",
  },
  {
    id: "car-performance",
    title: "Car Performance",
    category: "car",
    inputs: ["authorized performer identity", "vehicle reference", "performance reference"],
    requiredStages: ["identity", "vehicle", "scene", "motion", "rotoscope", "depth", "occlusion", "composite", "vfx", "export"],
    depthModes: COMMON_DEPTH,
    vfx: ["light_wrap", "motion_trails", "lens_flare", "film_grain"],
    guardrails: ["vehicle identity consistency", "performer identity consistency", "correct occlusion"],
    status: "needs-proof",
  },
  {
    id: "car-exterior-lights",
    title: "Car + Exterior Lights",
    category: "car",
    inputs: ["authorized performer identity", "vehicle reference", "lighting reference"],
    requiredStages: ["identity", "scene", "lighting", "motion", "rotoscope", "depth", "occlusion", "vfx", "composite", "color", "export"],
    depthModes: ["depth_map", "depth_occlusion", "depth_relight", "depth_parallax"],
    vfx: ["volumetric_light", "light_wrap", "lens_flare", "motion_trails"],
    guardrails: ["headlight/light-source consistency", "ground contact", "no subject duplication"],
    status: "needs-proof",
  },
  {
    id: "lamborghini-semicircle",
    title: "Lamborghini Semi-Circle",
    category: "car",
    inputs: ["authorized performer identity", "vehicle reference", "camera direction"],
    requiredStages: ["identity", "scene-geometry", "camera", "motion", "rotoscope", "depth", "occlusion", "lighting", "vfx", "composite", "export"],
    depthModes: ["depth_map", "depth_parallax", "depth_occlusion"],
    vfx: ["light_wrap", "lens_flare", "volumetric_light", "film_grain"],
    guardrails: ["maintain curved vehicle layout", "perspective continuity", "performer remains primary subject"],
    status: "needs-proof",
  },
  {
    id: "rolling-night-car",
    title: "Rolling Night Car",
    category: "car",
    inputs: ["authorized performer identity", "vehicle reference", "night-road reference", "performance reference"],
    requiredStages: ["identity", "vehicle", "scene", "camera", "motion", "rotoscope", "depth", "occlusion", "lighting", "vfx", "composite", "color", "export"],
    depthModes: ["depth_map", "depth_parallax", "depth_push", "depth_occlusion"],
    vfx: ["motion_trails", "volumetric_light", "lens_flare", "film_grain"],
    guardrails: ["road perspective continuity", "wheel/ground contact", "night-light consistency"],
    status: "needs-proof",
  },
  {
    id: "rooftop",
    title: "Rooftop Performance",
    category: "performance",
    inputs: ["authorized performer identity", "performance reference", "city/rooftop reference"],
    requiredStages: ["identity", "scene", "performance", "motion", "rotoscope", "depth", "occlusion", "vfx", "composite", "export"],
    depthModes: COMMON_DEPTH,
    vfx: ["volumetric_light", "light_wrap", "depth_bokeh", "film_grain"],
    guardrails: ["horizon continuity", "identity lock", "correct subject/environment depth"],
    status: "needs-proof",
  },
  {
    id: "grwm",
    title: "Get Ready With Me",
    category: "lifestyle",
    inputs: ["authorized performer identity", "starting look", "outfit/wardrobe reference", "optional performance reference"],
    requiredStages: ["identity", "wardrobe", "transformation", "performance", "motion", "rotoscope", "depth", "vfx", "edit", "export"],
    depthModes: ["depth_map", "depth_occlusion"],
    vfx: ["depth_bokeh", "light_wrap", "film_grain"],
    guardrails: ["same-person continuity", "wardrobe continuity", "no unexplained body/face changes"],
    status: "needs-proof",
  },
  {
    id: "clone-studio",
    title: "Clone Studio",
    category: "surreal",
    inputs: ["authorized performer identity", "performance reference", "clone layout"],
    requiredStages: ["identity", "motion", "clone-instances", "segmentation", "rotoscope", "depth", "occlusion", "lighting", "vfx", "composite", "export"],
    depthModes: ["depth_map", "depth_occlusion", "depth_parallax"],
    vfx: ["light_wrap", "volumetric_light", "motion_trails", "film_grain"],
    guardrails: ["same authorized identity", "no unintended faces", "clean editable mattes", "depth-correct occlusion"],
    status: "needs-proof",
  },
  {
    id: "surreal-multi-performer",
    title: "Surreal Multi-Performer",
    category: "surreal",
    inputs: ["authorized performer identity", "performance reference", "scene concept"],
    requiredStages: ["identity", "scene", "motion", "segmentation", "rotoscope", "depth", "occlusion", "vfx", "composite", "color", "export"],
    depthModes: ["depth_map", "depth_occlusion", "depth_parallax", "depth_push"],
    vfx: ["hologram", "energy_arcs", "motion_trails", "volumetric_light", "film_grain"],
    guardrails: ["identity lock", "layer isolation", "temporal mask stability", "no accidental duplicate subjects"],
    status: "needs-proof",
  },
  {
    id: "street-performance",
    title: "Street Performance",
    category: "street",
    inputs: ["authorized performer identity", "performance reference", "street/location reference"],
    requiredStages: ["identity", "scene", "performance", "motion", "rotoscope", "depth", "occlusion", "vfx", "composite", "color", "export"],
    depthModes: COMMON_DEPTH,
    vfx: ["light_wrap", "motion_trails", "depth_bokeh", "film_grain"],
    guardrails: ["background continuity", "identity lock", "correct pedestrian/prop occlusion"],
    status: "needs-proof",
  },
];

export function getPerformAnywhereWorkflow(id: string) {
  return PERFORM_ANYWHERE_WORKFLOWS.find((workflow) => workflow.id === id);
}
