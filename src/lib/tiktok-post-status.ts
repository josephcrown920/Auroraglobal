export const TIKTOK_NON_TERMINAL_POST_STATUSES = [
  "pending",
  "processing_upload",
  "processing_download",
  "processing_transcode",
  "processing_media_edit",
  "processing_stabilize",
] as const;

export const TIKTOK_TERMINAL_POST_STATUSES = [
  "publish_from_creator_fail",
  "publish_complete",
  "failed",
] as const;

export type TiktokPublishStatus =
  | (typeof TIKTOK_NON_TERMINAL_POST_STATUSES)[number]
  | (typeof TIKTOK_TERMINAL_POST_STATUSES)[number];

const TIKTOK_POST_STATUSES = new Set<string>([
  ...TIKTOK_NON_TERMINAL_POST_STATUSES,
  ...TIKTOK_TERMINAL_POST_STATUSES,
]);
const TIKTOK_NON_TERMINAL_POST_STATUS_SET = new Set<string>(TIKTOK_NON_TERMINAL_POST_STATUSES);

export function isTiktokPostProcessing(status: unknown): status is (typeof TIKTOK_NON_TERMINAL_POST_STATUSES)[number] {
  return typeof status === "string" && TIKTOK_NON_TERMINAL_POST_STATUS_SET.has(status);
}

export function parseTiktokPublishStatus(raw: unknown): TiktokPublishStatus {
  if (typeof raw !== "string") throw new Error("TikTok status response missing status.");
  const normalized = raw.toLowerCase();
  if (!TIKTOK_POST_STATUSES.has(normalized)) {
    throw new Error(`TikTok returned an unknown post status: ${normalized.slice(0, 80)}`);
  }
  return normalized as TiktokPublishStatus;
}