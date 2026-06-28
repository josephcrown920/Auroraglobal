import { describe, expect, it } from "bun:test";
import { StartInput } from "./tiktok-remix.functions";

// The TikTok Remix Factory caps cuts at 10. The UI slider enforces this, but
// the server-side zod validator (StartInput) is the real safeguard: each cut
// reserves 5 Aura, so a direct call asking for more than 10 must be rejected
// before any credits are reserved. These tests pin that cap so it can't quietly
// regress.

const VALID_URL = "https://example.com/source.mp4";

describe("StartInput.count — cut cap enforcement", () => {
  it("defaults to 10 when count is omitted", () => {
    const parsed = StartInput.parse({ sourceVideoUrl: VALID_URL });
    expect(parsed.count).toBe(10);
  });

  it("accepts every valid count from 1 through 10", () => {
    for (let n = 1; n <= 10; n++) {
      const parsed = StartInput.parse({ sourceVideoUrl: VALID_URL, count: n });
      expect(parsed.count).toBe(n);
    }
  });

  it("rejects counts above the cap (11 and 30)", () => {
    expect(() => StartInput.parse({ sourceVideoUrl: VALID_URL, count: 11 })).toThrow();
    expect(() => StartInput.parse({ sourceVideoUrl: VALID_URL, count: 30 })).toThrow();
  });

  it("rejects counts below 1", () => {
    expect(() => StartInput.parse({ sourceVideoUrl: VALID_URL, count: 0 })).toThrow();
    expect(() => StartInput.parse({ sourceVideoUrl: VALID_URL, count: -5 })).toThrow();
  });

  it("rejects non-integer counts", () => {
    expect(() => StartInput.parse({ sourceVideoUrl: VALID_URL, count: 5.5 })).toThrow();
  });

  it("safeParse reports success false for an over-cap count", () => {
    const result = StartInput.safeParse({ sourceVideoUrl: VALID_URL, count: 30 });
    expect(result.success).toBe(false);
  });
});

describe("StartInput — source video url validation", () => {
  it("requires a valid sourceVideoUrl", () => {
    expect(() => StartInput.parse({ sourceVideoUrl: "not-a-url", count: 5 })).toThrow();
    expect(() => StartInput.parse({ count: 5 })).toThrow();
  });
});
