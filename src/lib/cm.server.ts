// AI UGC Content Machine — server-side file.
// Pure constants/helpers live in cm.ts (no .server suffix) so the client
// route can import them without hitting the stub guard.
// This file re-exports them for server-side callers that already import here.
export {
  COST_PER_VIDEO,
  MAX_BATCH_VIDEOS,
  TEMPLATE_ICONS,
  batchItemCount,
  batchEstimate,
} from "@/lib/cm";
export type { CMProductCore, CMTemplateCore, BatchEstimate } from "@/lib/cm";

export type ContentMachinePayload = {
  productPrompt: string;
  sceneHint: string;
  sceneName: string;
  aspect: string;
  duration: number;
};

/**
 * Build the faceless `ugc_ad` job payload for one (product × template) video.
 *
 * The existing worker builders have fixed signatures (script generator reads
 * `productPrompt` + `sceneHint`; the motion prompt reads `sceneName`), so the
 * template's script formula + brand voice + audience are folded into `sceneHint`
 * and its motion style into `sceneName`. No `avatarImageUrl` / `avatarName` is
 * set, which is exactly what produces a faceless, product-only clip.
 */
export function buildContentMachinePayload(input: {
  product: CMProductCore;
  template: CMTemplateCore;
}): ContentMachinePayload {
  const { product, template } = input;

  const base = [product.name?.trim(), product.description?.trim()].filter(Boolean).join(" — ");
  const cta = product.cta?.trim();
  const productPrompt = (cta ? `${base}. Call to action: ${cta}` : base) || product.name.trim();

  const sceneHint = [
    template.sceneHint?.trim(),
    template.scriptFormula?.trim() ? `Script approach: ${template.scriptFormula.trim()}` : null,
    product.brandVoice?.trim() ? `Brand voice: ${product.brandVoice.trim()}` : null,
    product.audience?.trim() ? `Audience: ${product.audience.trim()}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  const sceneName = template.motionHint?.trim()
    ? `${template.name}: ${template.motionHint.trim()}`
    : template.name;

  const duration = Math.max(3, Math.min(12, Math.round(template.duration ?? 8) || 8));

  return {
    productPrompt,
    sceneHint,
    sceneName,
    aspect: (template.aspect ?? "9:16") || "9:16",
    duration,
  };
}
