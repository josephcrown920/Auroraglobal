/**
 * Pure pipeline helpers for the Aurora canvas graph executor.
 *
 * Extracted from canvas.lazy.tsx so the upstream-classification and
 * start-frame resolution logic can be unit-tested independently of React /
 * React Flow / server-function plumbing.
 */

export type ResolvedKind =
  | "input"
  | "image"
  | "video"
  | "lipsync"
  | "audio"
  | "split"
  | "comfy"
  | "batchVideo"
  | "heygenTemplate";

export type ResolvedNode = {
  url: string;
  kind: ResolvedKind;
};

export type UpstreamClassification = {
  images: string[];
  videos: string[];
  audios: string[];
};

/**
 * Split a list of resolved upstream nodes into images, videos, and audios.
 *
 * "input" nodes (raw uploads) are treated as images because they are static
 * files that can act as a start frame for a video node.
 * "lipsync" nodes are treated as videos because their output is a video file.
 */
export function classifyUpstream(upstream: ResolvedNode[]): UpstreamClassification {
  return {
    images: upstream
      .filter((u) => u.kind === "input" || u.kind === "image")
      .map((u) => u.url),
    videos: upstream
      .filter((u) => u.kind === "video" || u.kind === "lipsync")
      .map((u) => u.url),
    audios: upstream
      .filter((u) => u.kind === "audio")
      .map((u) => u.url),
  };
}

/**
 * Resolve the start frame URL for a video node.
 *
 * Prefers an upstream IMAGE (still) as the start frame.  When there is no
 * upstream image — e.g. a video→video re-animate chain or a ComfyUI video
 * output feeding into a video node — falls back to the first upstream VIDEO.
 *
 * Throws when neither is available (the caller should surface this as a
 * graph validation error before dispatching the job).
 */
export function resolveVideoStartFrame(images: string[], videos: string[]): string {
  if (images.length === 0 && videos.length === 0) {
    throw new Error("Video node needs an image or video upstream");
  }
  return images[0] ?? videos[0];
}

/**
 * Resolve the optional end-frame URL for a video node.
 *
 * Only set when the caller has supplied two or more upstream images (e.g. the
 * output of a Split node), enabling motion-controlled interpolation between
 * the first and second image.
 */
export function resolveVideoEndFrame(images: string[]): string | null {
  return images.length > 1 ? images[1] : null;
}
