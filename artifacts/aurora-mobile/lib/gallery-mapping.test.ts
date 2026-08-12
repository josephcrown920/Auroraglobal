import { describe, expect, it } from "bun:test";

import { GALLERY_SUCCESS_STATUSES, mapGalleryRow, type GalleryRow } from "./gallery-mapping";

const base: GalleryRow = {
  id: "g1",
  created_at: "2026-08-12T00:00:00Z",
  result_video_url: null,
  motion_video_url: null,
  result_image_url: null,
  prompt: "p",
  kind: "image",
  status: "complete",
};

describe("GALLERY_SUCCESS_STATUSES", () => {
  it("matches the statuses the backend actually writes (no 'ok')", () => {
    expect([...GALLERY_SUCCESS_STATUSES].sort()).toEqual(["complete", "succeeded"]);
    expect(GALLERY_SUCCESS_STATUSES as readonly string[]).not.toContain("ok");
  });
});

describe("mapGalleryRow", () => {
  it("maps an image-only row (sync path, status complete)", () => {
    const g = mapGalleryRow({ ...base, result_image_url: "https://x/img.webp" });
    expect(g.output_url).toBe("https://x/img.webp");
    expect(g.has_video).toBe(false);
    expect(g.poster_url).toBeNull();
    expect(g.status).toBe("complete");
  });

  it("prefers result_video_url and keeps the image as poster (status succeeded)", () => {
    const g = mapGalleryRow({
      ...base,
      status: "succeeded",
      kind: "video",
      result_video_url: "https://x/v.mp4",
      result_image_url: "https://x/frame.webp",
    });
    expect(g.output_url).toBe("https://x/v.mp4");
    expect(g.has_video).toBe(true);
    expect(g.poster_url).toBe("https://x/frame.webp");
    expect(g.status).toBe("succeeded");
  });

  it("falls back to motion_video_url for motion-only generations", () => {
    const g = mapGalleryRow({
      ...base,
      status: "succeeded",
      motion_video_url: "https://x/motion.mp4",
      result_image_url: "https://x/still.webp",
    });
    expect(g.output_url).toBe("https://x/motion.mp4");
    expect(g.has_video).toBe(true);
    expect(g.poster_url).toBe("https://x/still.webp");
  });

  it("video without a still yields a null poster (card shows placeholder)", () => {
    const g = mapGalleryRow({ ...base, result_video_url: "https://x/v.mp4" });
    expect(g.has_video).toBe(true);
    expect(g.poster_url).toBeNull();
  });
});
