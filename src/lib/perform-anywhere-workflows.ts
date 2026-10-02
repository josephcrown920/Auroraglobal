/**
 * Aurora Perform Anywhere workflow registry.
 *
 * This is intentionally a DATA contract, not a fake generator. Each workflow
 * describes the production contract the UI/Director must satisfy. A workflow is
 * only considered production-ready when its smoke test produces a real artifact.
 */

export type PerformAnywhereWorkflow = {
  id: string;
  title: string;
  category: "studio" | "car" | "surreal" | "lifestyle" | "performance";
  inputs: string[];
  requiredStages: string[];
  guardrails: string[];
  status: "needs-proof";
};

export const PERFORM_ANYWHERE_WORKFLOWS: PerformAnywhereWorkflow[] = [
  {
    id: "studio-white-cyclorama",
    title: "White Cyclorama Studio",
    category: "studio",
    inputs: ["authorized performer identity", "performance reference"],
    requiredStages: ["identity", "scene", "performance", "motion", "composite", "export"],
    guardrails: ["preserve performer identity", "no accidental extra people", "studio background continuity"],
    status: "needs-proof",
  },
  {
    id: "studio-light-wall",
    title: "Light Wall Studio",
    category: "studio",
    inputs: ["authorized performer identity", "performance reference", "lighting direction"],
    requiredStages: ["identity", "scene", "performance", "motion", "lighting", "export"],
    guardrails: ["preserve identity", "practical-light consistency", "no background geometry drift"],
    status: "needs-proof",
  },
  {
    id: "car-performance",
    title: "Car Performance",
    category: "car",
    inputs: ["authorized performer identity", "vehicle reference", "performance reference"],
    requiredStages: ["identity", "vehicle", "scene", "motion", "rotoscope", "composite", "export"],
    guardrails: ["vehicle identity consistency", "performer identity consistency", "correct occlusion"],
    status: "needs-proof",
  },
  {
    id: "car-exterior-lights",
    title: "Car + Exterior Lights",
    category: "car",
    inputs: ["authorized performer identity", "vehicle reference", "lighting reference"],
    requiredStages: ["identity", "scene", "lighting", "motion", "rotoscope", "composite", "export"],
    guardrails: ["headlight/light-source consistency", "ground contact", "no subject duplication"],
    status: "needs-proof",
  },
  {
    id: "lamborghini-semicircle",
    title: "Lamborghini Semi-Circle",
    category: "car",
    inputs: ["authorized performer identity", "vehicle reference", "camera direction"],
    requiredStages: ["identity", "scene-geometry", "camera", "motion", "rotoscope", "composite", "export"],
    guardrails: ["maintain curved vehicle layout", "perspective continuity", "performer remains primary subject"],
    status: "needs-proof",
  },
  {
    id: "grwm",
    title: "Get Ready With Me",
    category: "lifestyle",
    inputs: ["authorized performer identity", "starting look", "outfit/wardrobe reference"],
    requiredStages: ["identity", "wardrobe", "transformation", "performance", "motion", "edit", "export"],
    guardrails: ["same-person continuity", "wardrobe continuity", "no unexplained body/face changes"],
    status: "needs-proof",
  },
  {
    id: "clone-performance",
    title: "Clone Performance",
    category: "surreal",
    inputs: ["authorized performer identity", "performance reference", "clone layout"],
    requiredStages: ["identity", "motion", "segmentation", "rotoscope", "occlusion", "composite", "export"],
    guardrails: ["same authorized identity", "no unintended faces", "clean mattes", "depth-correct occlusion"],
    status: "needs-proof",
  },
  {
    id: "surreal-multi-performer",
    title: "Surreal Multi-Performer",
    category: "surreal",
    inputs: ["authorized performer identity", "performance reference", "scene concept"],
    requiredStages: ["identity", "scene", "motion", "segmentation", "rotoscope", "vfx", "composite", "export"],
    guardrails: ["identity lock", "layer isolation", "temporal mask stability", "no accidental duplicate subjects"],
    status: "needs-proof",
  },
];

export function getPerformAnywhereWorkflow(id: string) {
  return PERFORM_ANYWHERE_WORKFLOWS.find((workflow) => workflow.id === id);
}
