// Unified Comfy-Manager capability registry for Aurora Global.
// Aurora remains the canonical app, auth boundary, and orchestration layer.

export const COMFY_MANAGER_CAPABILITIES = [
  "comfyui-workflows", "modelark-seedream", "modelark-seedance",
  "byteplus-video-agent", "cinematic-presets", "viral-presets", "image-to-video",
  "character-video", "lip-sync-video", "perform-anywhere", "gpu-hub",
  "free-colab-workers", "free-kaggle-workers", "durable-generation-jobs",
  "worker-routing", "workflow-registry", "batch-generation", "output-management",
] as const;

export type ComfyManagerCapability = (typeof COMFY_MANAGER_CAPABILITIES)[number];
export type UnifiedProvider = "modelark" | "comfyui" | "gpu-worker" | "colab" | "kaggle";

export type UnifiedWorkflow = {
  id: string;
  name: string;
  category: "standard" | "cinematic" | "viral" | "image-to-video" | "character" | "lip-sync";
  provider: UnifiedProvider;
  description: string;
};

export const UNIFIED_WORKFLOWS: readonly UnifiedWorkflow[] = [
  { id: "standard-video", name: "Standard Video", category: "standard", provider: "modelark", description: "General-purpose ModelArk video generation." },
  { id: "cinematic-video", name: "Cinematic Video", category: "cinematic", provider: "modelark", description: "Cinematic camera and visual-direction workflow." },
  { id: "viral-video", name: "Viral Video", category: "viral", provider: "modelark", description: "Short-form hook and social-video workflow." },
  { id: "image-to-video", name: "Image to Video", category: "image-to-video", provider: "modelark", description: "Animate a supplied image/reference." },
  { id: "character-video", name: "Character Video", category: "character", provider: "modelark", description: "Character/reference-aware generation." },
  { id: "lip-sync-video", name: "Lip Sync Video", category: "lip-sync", provider: "modelark", description: "Reference-aware talking/lip-sync workflow." },
];

export function listUnifiedCapabilities() {
  return { capabilities: [...COMFY_MANAGER_CAPABILITIES], workflows: [...UNIFIED_WORKFLOWS] };
}

export function isUnifiedWorkflow(value: string): value is UnifiedWorkflow["id"] {
  return UNIFIED_WORKFLOWS.some((workflow) => workflow.id === value);
}
