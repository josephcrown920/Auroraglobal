// ─── Stacked, resolution/length-based pricing — single source of truth ───────
//
// Every charge point (public /api/public/generate, the AI Router server fn, and
// the AI Router UI preview) prices a generation through THIS module so a preview
// can never disagree with what is actually reserved/charged.
//
// Model (Kling/Runway-inspired, all values in Aura credits):
//   • Each active feature has a base cost. A request that stacks features is
//     charged the SUM of every active feature (not one flat fee).
//   • Resolution scales the resolution-bearing visual output.
//   • Length scales time-based features (video / lip-sync / motion).
//   • Per-feature subtotal = base × resolutionFactor × lengthFactor (kept exact);
//     the subtotals are summed and the TOTAL is rounded UP to a whole Aura.
//     A real generation is never free (minimum 1).
//
// This file is intentionally dependency-free (no server imports) so the client
// UI can import `computeCost`/`detectFeatures` directly for an instant preview.

export type Feature = "image" | "upscale" | "text" | "audio" | "lipsync" | "motion" | "video";
export type Resolution = "480p" | "720p" | "1080p";

/** Every billable feature, in canonical display order. */
export const FEATURES: readonly Feature[] = [
  "image",
  "upscale",
  "text",
  "audio",
  "video",
  "lipsync",
  "motion",
];

// ─── Editable default price table ────────────────────────────────────────────
// The owner can tweak these numbers without touching any pricing logic.
export const PRICING = {
  /** Per-feature base cost (summed when features are stacked). */
  base: {
    image: 1,
    upscale: 1,
    text: 1,
    audio: 2,
    lipsync: 3,
    motion: 3,
    video: 5,
  } as Record<Feature, number>,
  /** Multiplier applied to the resolution-bearing visual output. */
  resolutionMultiplier: {
    "480p": 0.5,
    "720p": 1,
    "1080p": 2,
  } as Record<Resolution, number>,
  /** Length multiplier is linear against this reference: seconds / referenceSeconds. */
  referenceSeconds: 5,
  /** Used when a request omits resolution. */
  defaultResolution: "720p" as Resolution,
} as const;

// Time-based features whose price scales with length.
const LENGTH_FEATURES: ReadonlySet<Feature> = new Set<Feature>(["video", "lipsync", "motion"]);
// Temporal visual outputs — when one of these is present in a stack, a stacked
// source `image` is billed at base (it is a reference input, not a re-render).
const TEMPORAL_OUTPUTS: ReadonlySet<Feature> = new Set<Feature>(["video", "motion"]);

export type CostLineItem = {
  feature: Feature;
  base: number;
  resolutionFactor: number;
  lengthFactor: number;
  /** base × resolutionFactor × lengthFactor (exact, before the total is rounded). */
  subtotal: number;
};

export type CostQuote = {
  /** Whole-Aura amount actually reserved/charged. */
  total: number;
  breakdown: CostLineItem[];
  resolution: Resolution;
  durationSeconds: number;
};

/**
 * Whether the resolution multiplier scales a given feature within a stack.
 * - `video` / `motion`: always (they are the resolution-bearing output).
 * - `image`: only when it IS the final visual output — i.e. there is no temporal
 *   output (video/motion) in the stack. A source image under a video is base-only.
 *   This is what keeps the canonical stacked example at exactly 39 Aura.
 * - everything else (text/audio/lipsync/upscale): never.
 */
function resolutionApplies(feature: Feature, hasTemporalOutput: boolean): boolean {
  if (feature === "video" || feature === "motion") return true;
  if (feature === "image") return !hasTemporalOutput;
  return false;
}

export function computeCost(input: {
  features: Feature[];
  resolution?: Resolution | null;
  durationSeconds?: number | null;
}): CostQuote {
  const resolution = input.resolution ?? PRICING.defaultResolution;
  const durationSeconds =
    typeof input.durationSeconds === "number" && input.durationSeconds > 0
      ? input.durationSeconds
      : PRICING.referenceSeconds;

  const resMult = PRICING.resolutionMultiplier[resolution];
  const lenMult = durationSeconds / PRICING.referenceSeconds;

  // De-duplicate and apply a stable, canonical ordering for the breakdown.
  const active = FEATURES.filter((f) => input.features.includes(f));
  const hasTemporalOutput = active.some((f) => TEMPORAL_OUTPUTS.has(f));

  const breakdown: CostLineItem[] = active.map((feature) => {
    const base = PRICING.base[feature];
    const resolutionFactor = resolutionApplies(feature, hasTemporalOutput) ? resMult : 1;
    const lengthFactor = LENGTH_FEATURES.has(feature) ? lenMult : 1;
    return {
      feature,
      base,
      resolutionFactor,
      lengthFactor,
      subtotal: base * resolutionFactor * lengthFactor,
    };
  });

  const raw = breakdown.reduce((sum, b) => sum + b.subtotal, 0);
  // Round the TOTAL up; never charge 0 for a real (non-empty) generation.
  const total = breakdown.length === 0 ? 0 : Math.max(1, Math.ceil(raw));

  return { total, breakdown, resolution, durationSeconds };
}

export type DetectInput = {
  /** The chosen primary modality. Manual selection IS the override for the primary. */
  kind: Feature;
  /** Driving audio (for an unambiguous lip-sync pairing). */
  audioUrl?: string | null;
  /** Source/driving video (for lip-sync / motion transfer). */
  videoUrl?: string | null;
  /** Explicit motion-transfer / camera-control preset (a requested operation). */
  cameraMovement?: string | null;
  /** Explicit override: force the exact active feature set. */
  features?: Feature[] | null;
};

/**
 * Deterministically derive the active feature set from a request.
 *
 * Detection is conservative and driven by explicit operations/inputs — never by
 * prompt text and never by incidental reference artifacts (a start image for a
 * video, or a stray audio URL alone). This guarantees charges are predictable
 * and that single-feature requests keep their historical price.
 *
 * Add-ons:
 *  - `motion` — added to a video request when an explicit camera-control preset
 *    is supplied (a requested motion-control operation).
 *  - `lipsync` — added only for an unambiguous "drive this audio onto this video"
 *    pair (both `audioUrl` and `videoUrl` present) on a non-lipsync primary.
 */
export function detectFeatures(input: DetectInput): {
  features: Feature[];
  primaryKind: Feature;
} {
  const primaryKind = input.kind;

  // An override can only ADD billable features on top of the primary kind — it can
  // never drop the kind to undercharge. (A caller submitting `kind:"video",
  // features:["image"]` is still charged for the video they actually run.) This
  // keeps caller-supplied `features` a safe, additive override, not a credit bypass.
  if (input.features && input.features.length > 0) {
    const forced = new Set<Feature>(input.features);
    forced.add(primaryKind);
    return { features: FEATURES.filter((f) => forced.has(f)), primaryKind };
  }

  const set = new Set<Feature>([primaryKind]);

  if (input.cameraMovement && primaryKind === "video") {
    set.add("motion");
  }
  if (input.audioUrl && input.videoUrl && primaryKind !== "lipsync") {
    set.add("lipsync");
  }

  return { features: FEATURES.filter((f) => set.has(f)), primaryKind };
}
