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