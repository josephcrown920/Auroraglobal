import { describe, expect, test } from "bun:test";
import { tiktokHasStatsScopes, TIKTOK_STATS_SCOPES } from "./tiktok-stats.server";

describe("tiktokHasStatsScopes", () => {
  test("requires BOTH display scopes", () => {
    expect(TIKTOK_STATS_SCOPES).toEqual(["user.info.stats", "video.list"]);
    expect(tiktokHasStatsScopes("user.info.basic,video.upload,video.publish")).toBe(false);
    expect(tiktokHasStatsScopes("user.info.basic,user.info.stats,video.upload")).toBe(false);
    expect(tiktokHasStatsScopes("user.info.basic,video.list")).toBe(false);
    expect(tiktokHasStatsScopes("user.info.basic,user.info.stats,video.upload,video.publish,video.list")).toBe(true);
  });
  test("handles space-separated scopes and empty values", () => {
    expect(tiktokHasStatsScopes("user.info.stats video.list")).toBe(true);
    expect(tiktokHasStatsScopes("")).toBe(false);
    expect(tiktokHasStatsScopes(null)).toBe(false);
    expect(tiktokHasStatsScopes(undefined)).toBe(false);
  });
});
