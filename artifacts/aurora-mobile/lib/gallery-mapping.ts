/**
 * Pure mapping from a `generations` DB row to the app's Generation shape.
 * Kept free of supabase/react-native imports so it can be unit-tested with
 * `bun test` directly.
 */

/**
 * Success states actually written by the backend: sync generation paths
 * finish as "complete", async queue jobs finish as "succeeded". There is no
 * "ok" status in the live data — filtering on it returns an empty gallery.
 */
export const GALLERY_SUCCESS_STATUSES = ["succeeded", "complete"] as const;

export interface Generation {
  id: string;
  created_at: string;
  output_url: string | null;
  /** True when the row has a video result (result_video_url or motion_video_url). */
  has_video?: boolean;
  /** Still image for the card thumbnail when the result is a video. */
  poster_url?: string | null;
  prompt: string | null;
  kind: string;
  status: "succeeded" | "complete" | "failed" | "processing" | "cancelled";
  error_message?: string | null;
}

export interface GalleryRow {
  id: string;
  created_at: string;
  result_video_url: string | null;
  motion_video_url: string | null;
  result_image_url: string | null;
  prompt: string | null;
  kind: string;
  status: string;
}

export function mapGalleryRow(row: GalleryRow): Generation {
  const videoUrl = row.result_video_url ?? row.motion_video_url ?? null;
  return {
    id: row.id,
    created_at: row.created_at,
    output_url: videoUrl ?? row.result_image_url ?? null,
    has_video: !!videoUrl,
    poster_url: videoUrl ? row.result_image_url : null,
    prompt: row.prompt,
    kind: row.kind,
    status: row.status as Generation["status"],
  };
}
