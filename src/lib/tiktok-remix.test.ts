/**
 * Unit tests for tiktok-remix helpers — run with `bun test src/lib/tiktok-remix.test.ts`
 *
 * Covers:
 *  - extractStudioPath: parses Supabase signed-URL paths correctly (#448 re-sign logic)
 *  - StartInput validation: rejects bad counts / durations before they touch the DB
 */

import { describe, it, expect } from "bun:test";
import { extractStudioPath, StartInput } from "./tiktok-remix.functions";

// ── extractStudioPath ─────────────────────────────────────────────────────────

describe("extractStudioPath", () => {
  const project = "tpzmvbczwahxajujvnrq";
  const base = `https://${project}.supabase.co`;

  it("returns the path from a valid signed URL", () => {
    const url = `${base}/storage/v1/object/sign/studio/user-id-123/wardrobe/outfit.jpg?token=abc`;
    expect(extractStudioPath(url)).toBe("user-id-123/wardrobe/outfit.jpg");
  });

  it("handles URL-encoded characters in the path", () => {
    const url = `${base}/storage/v1/object/sign/studio/user%2Did/outfit%20file.jpg?token=x`;
    expect(extractStudioPath(url)).toBe("user-id/outfit file.jpg");
  });

  it("returns null for a non-signed URL", () => {
    expect(extractStudioPath("https://example.com/some/path")).toBeNull();
  });

  it("returns null for a public object URL (not signed)", () => {
    const url = `${base}/storage/v1/object/public/studio/user-id/file.jpg`;
    expect(extractStudioPath(url)).toBeNull();
  });

  it("returns null for a path from a different bucket", () => {
    const url = `${base}/storage/v1/object/sign/avatars/user-id/face.jpg?token=x`;
    expect(extractStudioPath(url)).toBeNull();
  });

  it("returns null for a garbage string", () => {
    expect(extractStudioPath("not-a-url")).toBeNull();
  });
});

// ── StartInput validation ─────────────────────────────────────────────────────

describe("StartInput", () => {
  const base = {
    sourceVideoUrl: "https://cdn.example.com/source.mp4",
    count: 5,
    duration: 5,
    style: "auto" as const,
  };

  it("accepts a valid payload", () => {
    expect(() => StartInput.parse(base)).not.toThrow();
  });

  it("clamps count default to 10", () => {
    const r = StartInput.parse({ sourceVideoUrl: base.sourceVideoUrl });
    expect(r.count).toBe(10);
  });

  it("rejects count > 10", () => {
    expect(() => StartInput.parse({ ...base, count: 11 })).toThrow();
  });

  it("rejects count < 1", () => {
    expect(() => StartInput.parse({ ...base, count: 0 })).toThrow();
  });

  it("rejects duration > 10", () => {
    expect(() => StartInput.parse({ ...base, duration: 11 })).toThrow();
  });

  it("rejects invalid style", () => {
    expect(() => StartInput.parse({ ...base, style: "disco" })).toThrow();
  });

  it("accepts all valid styles", () => {
    for (const style of ["auto", "urban_cut", "grwm"] as const) {
      expect(() => StartInput.parse({ ...base, style })).not.toThrow();
    }
  });

  it("accepts an outfitImageUrl alongside a sourceVideoUrl", () => {
    expect(() =>
      StartInput.parse({
        ...base,
        outfitImageUrl: "https://cdn.example.com/outfit.jpg",
      })
    ).not.toThrow();
  });
});
