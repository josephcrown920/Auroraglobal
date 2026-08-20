import { describe, expect, it } from "bun:test";
import { parseTiktokPostId } from "./tiktok-spark.server";

describe("parseTiktokPostId", () => {
  it("extracts an item id only from a full TikTok post URL", () => {
    expect(parseTiktokPostId("https://www.tiktok.com/@aurora/video/7421234567890123456")).toBe("7421234567890123456");
  });

  it("rejects short links and non-TikTok URLs before any outbound request", () => {
    expect(() => parseTiktokPostId("https://vm.tiktok.com/ZMexample/")).toThrow("full TikTok post URL");
    expect(() => parseTiktokPostId("https://example.com/@aurora/video/7421234567890123456")).toThrow("public TikTok post URL");
  });
});