// Client-safe Content Machine constants and helpers.
// Extracted from cm.server.ts so the lazy route can import without
// hitting the .server.ts stub guard. cm.server.ts re-exports from here.

/** Flat credits reserved per generated video. */
export const COST_PER_VIDEO = 16;

/** Hard cap on videos per batch. */
export const MAX_BATCH_VIDEOS = 12;

/** Lucide icon names used by seeded system templates. */
export const TEMPLATE_ICONS = [
  "Smartphone", "Package", "Coffee", "Dumbbell", "Sparkles",
  "Camera", "Sun", "Film", "Megaphone", "ShoppingBag",
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

export function batchEstimate(templateCount: number, countPerTemplate: number): BatchEstimate {
  const totalItems = batchItemCount(templateCount, countPerTemplate);
  return {
    totalItems,
    creditsPerVideo: COST_PER_VIDEO,
    totalCredits: totalItems * COST_PER_VIDEO,
    overCap: totalItems > MAX_BATCH_VIDEOS,
  };
}
