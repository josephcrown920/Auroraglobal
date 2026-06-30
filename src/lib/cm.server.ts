// AI UGC Content Machine (Task #102) — shared, dependency-light helpers.
//
// The Content Machine reuses Aurora's existing UGC ad pipeline: a "batch" fans out
// into N independent `ugc_ad` jobs (see runUGCAd in jobs.server.ts), each reserved
// for a flat COST_UGC_AD via create_generation_and_reserve. Videos are FACELESS —
// no avatar is attached, so the worker animates a product-only still.
//
// These functions are pure (no DB / no server imports) so the client route can
// import the estimate for an instant, accurate preview and the unit tests can
// exercise the payload builder directly. It deliberately does NOT import
// ugc.server (which pulls server-only LLM code) — keeping it client-safe.

/** Flat credits reserved per generated video — the SAME amount the batch reserves,
 *  so an up-front estimate can never disagree with what is actually charged. Kept
 *  in lockstep with COST_UGC_AD (the /ugc ad price); cm.server.test.ts asserts the
 *  two stay equal so this client-safe copy can never silently drift. */
export const COST_PER_VIDEO = 8;

/** Hard cap on videos per batch — limits runaway reservations, queue pressure and
 *  the page's polling load. Enforced server-side in startBatch. */
export const MAX_BATCH_VIDEOS = 12;

/** Lucide icon names used by the seeded system templates (UI falls back to a
 *  default for anything outside this set). */
export const TEMPLATE_ICONS = [
  "Smartphone",
  "Package",
  "Coffee",
  "Dumbbell",
  "Sparkles",
  "Camera",
  "Sun",
  "Film",
  "Megaphone",
  "ShoppingBag",
] as const;

export type CMProductCore = {
  name: string;
  description?: string | null;
  brandVoice?: string | null;
  audience?: string | null;
  cta?: string | null;
};

export type CMTemplateCore = {
  name: string;
  sceneHint: string;
  motionHint?: string | null;
  scriptFormula?: string | null;
  aspect?: string | null;
  duration?: number | null;
};

/** Total videos a batch will produce (templates × videos-per-template). */
export function batchItemCount(templateCount: number, countPerTemplate: number): number {
  const t = Math.max(0, Math.floor(templateCount));
  const c = Math.max(0, Math.floor(countPerTemplate));
  return t * c;
}

export type BatchEstimate = {
  totalItems: number;
  creditsPerVideo: number;
  totalCredits: number;
  overCap: boolean;
};

/** Up-front credit estimate for a batch, using the flat per-video reservation. */
export function batchEstimate(templateCount: number, countPerTemplate: number): BatchEstimate {
  const totalItems = batchItemCount(templateCount, countPerTemplate);
  return {
    totalItems,
    creditsPerVideo: COST_PER_VIDEO,
    totalCredits: totalItems * COST_PER_VIDEO,
    overCap: totalItems > MAX_BATCH_VIDEOS,
  };
}

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
