import { describe, expect, it } from "bun:test";
import {
  isTiktokPostProcessing,
  parseTiktokPublishStatus,
  TIKTOK_NON_TERMINAL_POST_STATUSES,
  TIKTOK_TERMINAL_POST_STATUSES,
} from "./tiktok-post-status";

describe("TikTok post status classification", () => {
  it.each(TIKTOK_NON_TERMINAL_POST_STATUSES)("keeps %s eligible for automatic status checks", (status) => {
    expect(parseTiktokPublishStatus(status.toUpperCase())).toBe(status);
    expect(isTiktokPostProcessing(status)).toBe(true);
  });

  it.each(TIKTOK_TERMINAL_POST_STATUSES)("recognizes %s as terminal", (status) => {
    expect(parseTiktokPublishStatus(status.toUpperCase())).toBe(status);
    expect(isTiktokPostProcessing(status)).toBe(false);
  });

  it("rejects undocumented statuses instead of persisting an unchecked value", () => {
    expect(() => parseTiktokPublishStatus("mystery_state")).toThrow("unknown post status");
  });
});