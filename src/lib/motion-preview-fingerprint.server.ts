// Cryptographic preview-binding fingerprints. This module must stay server-only:
// a preview ticket is a billing/security boundary, so its fingerprint must not
// use a collision-prone client-side hash.

import { createHash } from "node:crypto";

type MotionParams = {
  motionType?: string;
  cameraMovement?: string;
  fps?: number;
  frames?: number;
  steps?: number;
  cfg?: number;
  seed?: number;
  preserveFace?: boolean;
};

type MotionFingerprintInput = {
  sourceGenerationId?: string | null;
  workflowMode?: string | null;
  workflowAngle?: string | null;
  variantWorkflowKind?: string | null;
  variantMode?: string | null;
  variantPresetId?: string | null;
  imageUrl: string;
  drivingVideoUrl: string;
  prompt?: string | null;
  params?: MotionParams | null;
};

type PerformanceReskinFingerprintInput = {
  performanceVideoUrl: string;
  avatarImageUrl: string;
  audioUrl?: string | null;
  outfit?: string | null;
  location?: string | null;
  prompt?: string | null;
  params?: MotionParams | null;
};

type PerformanceVariantFingerprintInput = {
  kind: string;
  references: Record<string, string | null>;
  settings: Record<string, string>;
};

/**
 * The user-facing video request is preview-capped at dispatch time, but the
 * confirmation ticket must bind to the request the user actually made.  In
 * particular, `duration` and `resolution` here are the requested full-quality
 * values, not the effective 5s/480p preview values.
 */
export type VideoPreviewFingerprintInput = {
  imageUrl: string;
  endFrameUrl?: string | null;
  prompt: string;
  duration: number;
  resolution: string;
  modelKey: string;
  cameraMovement?: string | null;
  templateId?: string | null;
};

function canonicalMotionMedia(raw: string): string {
  const url = new URL(raw);
  const storage = url.pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/studio\/(.+)$/);
  return storage ? `studio:${decodeURIComponent(storage[1])}` : `${url.origin}${url.pathname}`;
}

function canonicalParams(params: MotionParams | null | undefined) {
  return {
    motionType: params?.motionType ?? "faithful",
    cameraMovement: params?.cameraMovement ?? "static",
    fps: params?.fps ?? 16,
    frames: params?.frames ?? 72,
    steps: params?.steps ?? 25,
    cfg: params?.cfg ?? 2,
    seed: params?.seed ?? null,
    preserveFace: params?.preserveFace ?? true,
  };
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function motionInputFingerprint(input: MotionFingerprintInput): string {
  return sha256({
    sourceGenerationId: input.sourceGenerationId ?? null,
    workflowMode: input.workflowMode ?? null,
    workflowAngle: input.workflowAngle ?? null,
    variantWorkflowKind: input.variantWorkflowKind ?? null,
    variantMode: input.variantMode ?? null,
    variantPresetId: input.variantPresetId ?? null,
    imageUrl: canonicalMotionMedia(input.imageUrl),
    drivingVideoUrl: canonicalMotionMedia(input.drivingVideoUrl),
    prompt: input.prompt ?? "",
    params: canonicalParams(input.params),
  });
}

export function performanceReskinFingerprint(input: PerformanceReskinFingerprintInput): string {
  return sha256({
    performanceVideoUrl: canonicalMotionMedia(input.performanceVideoUrl),
    avatarImageUrl: canonicalMotionMedia(input.avatarImageUrl),
    audioUrl: input.audioUrl ? canonicalMotionMedia(input.audioUrl) : null,
    outfit: input.outfit ?? "",
    location: input.location ?? "",
    prompt: input.prompt ?? "",
    params: canonicalParams(input.params),
  });
}

/**
 * Cryptographically bind a video preview to every input that can change the
 * resulting clip.  The effective preview quality is intentionally not used:
 * the requested full-quality duration/resolution are part of the ticket so a
 * caller cannot reuse a preview to escalate the confirmed render.
 *
 * Storage signatures/tokens are excluded by canonicalMotionMedia, allowing a
 * normal re-sign of the same owned asset without invalidating its ticket.
 */
export function videoPreviewFingerprint(input: VideoPreviewFingerprintInput): string {
  return sha256({
    kind: "video",
    imageUrl: canonicalMotionMedia(input.imageUrl),
    endFrameUrl: input.endFrameUrl ? canonicalMotionMedia(input.endFrameUrl) : null,
    prompt: input.prompt,
    duration: input.duration,
    resolution: input.resolution,
    modelKey: input.modelKey,
    cameraMovement: input.cameraMovement ?? null,
    templateId: input.templateId ?? null,
  });
}

// Descriptive alias for callers that use the same naming as the motion
// fingerprint helpers.
export const videoInputFingerprint = videoPreviewFingerprint;

export function performanceVariantInputFingerprint(input: PerformanceVariantFingerprintInput): string {
  const studioPath = (url: string): string => {
    const match = new URL(url).pathname.match(/\/storage\/v1\/object\/(?:sign|public)\/studio\/(.+)$/);
    if (!match) throw new Error("Reference must be stored in Aurora");
    return decodeURIComponent(match[1]);
  };
  return sha256({
    kind: input.kind,
    references: Object.keys(input.references)
      .sort()
      .map((key) => [key, input.references[key] ? studioPath(input.references[key]!) : null]),
    settings: Object.keys(input.settings).sort().map((key) => [key, input.settings[key]]),
  });
}