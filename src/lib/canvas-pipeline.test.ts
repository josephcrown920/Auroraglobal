import { describe, test, expect } from "bun:test";
import {
  classifyUpstream,
  resolveVideoStartFrame,
  resolveVideoEndFrame,
  type ResolvedNode,
} from "./canvas-pipeline";

// ─── classifyUpstream ──────────────────────────────────────────────────────────

describe("classifyUpstream", () => {
  test("splits image, video, and audio nodes into separate buckets", () => {
    const upstream: ResolvedNode[] = [
      { url: "https://example.com/img.jpg", kind: "image" },
      { url: "https://example.com/vid.mp4", kind: "video" },
      { url: "https://example.com/aud.mp3", kind: "audio" },
    ];
    const { images, videos, audios } = classifyUpstream(upstream);
    expect(images).toEqual(["https://example.com/img.jpg"]);
    expect(videos).toEqual(["https://example.com/vid.mp4"]);
    expect(audios).toEqual(["https://example.com/aud.mp3"]);
  });

  test("treats 'input' nodes (raw uploads) as images", () => {
    const upstream: ResolvedNode[] = [
      { url: "https://example.com/upload.jpg", kind: "input" },
    ];
    const { images, videos } = classifyUpstream(upstream);
    expect(images).toEqual(["https://example.com/upload.jpg"]);
    expect(videos).toHaveLength(0);
  });

  test("treats 'lipsync' nodes as videos", () => {
    const upstream: ResolvedNode[] = [
      { url: "https://example.com/lipsync.mp4", kind: "lipsync" },
    ];
    const { images, videos } = classifyUpstream(upstream);
    expect(videos).toEqual(["https://example.com/lipsync.mp4"]);
    expect(images).toHaveLength(0);
  });

  test("returns empty buckets for an empty upstream list", () => {
    const { images, videos, audios } = classifyUpstream([]);
    expect(images).toHaveLength(0);
    expect(videos).toHaveLength(0);
    expect(audios).toHaveLength(0);
  });

  test("preserves order within each bucket", () => {
    const upstream: ResolvedNode[] = [
      { url: "https://cdn/v1.mp4", kind: "video" },
      { url: "https://cdn/i1.jpg", kind: "image" },
      { url: "https://cdn/v2.mp4", kind: "lipsync" },
      { url: "https://cdn/i2.jpg", kind: "input" },
    ];
    const { images, videos } = classifyUpstream(upstream);
    expect(images).toEqual(["https://cdn/i1.jpg", "https://cdn/i2.jpg"]);
    expect(videos).toEqual(["https://cdn/v1.mp4", "https://cdn/v2.mp4"]);
  });
});

// ─── resolveVideoStartFrame ────────────────────────────────────────────────────

describe("resolveVideoStartFrame", () => {
  test("uses the first image when an image is available (normal i2v path)", () => {
    const startFrame = resolveVideoStartFrame(
      ["https://cdn/photo.jpg"],
      [],
    );
    expect(startFrame).toBe("https://cdn/photo.jpg");
  });

  test("falls back to the first video when there are no upstream images (v2v chain)", () => {
    // This is the fix from Task #296: video→video re-animate or ComfyUI
    // video output feeding a downstream video node.
    const startFrame = resolveVideoStartFrame(
      [],
      ["https://cdn/upstream.mp4"],
    );
    expect(startFrame).toBe("https://cdn/upstream.mp4");
  });

  test("prefers image over video when both are present", () => {
    const startFrame = resolveVideoStartFrame(
      ["https://cdn/still.jpg"],
      ["https://cdn/clip.mp4"],
    );
    expect(startFrame).toBe("https://cdn/still.jpg");
  });

  test("uses the FIRST image when multiple images are present (second is end-frame)", () => {
    const startFrame = resolveVideoStartFrame(
      ["https://cdn/frame-a.jpg", "https://cdn/frame-b.jpg"],
      [],
    );
    expect(startFrame).toBe("https://cdn/frame-a.jpg");
  });

  test("throws when both images and videos are empty", () => {
    expect(() => resolveVideoStartFrame([], [])).toThrow(
      "Video node needs an image or video upstream",
    );
  });

  // ── Two-node DAG simulation: video node downstream of another video node ──
  test("two-node v2v DAG: downstream video node receives the upstream result url", () => {
    // Simulate what the canvas executor does when it resolves a two-node DAG:
    //   nodeA (video) → nodeB (video)
    // After nodeA completes, resolved.set(nodeA.id, { url: "https://cdn/a.mp4", kind: "video" })
    // nodeB's upstream list is then [{ url: "https://cdn/a.mp4", kind: "video" }].

    const upstreamNodeAResult: ResolvedNode = {
      url: "https://cdn/a.mp4",
      kind: "video",
    };

    // classifyUpstream is what the executor calls on nodeB's upstream list
    const { images, videos } = classifyUpstream([upstreamNodeAResult]);

    // No images — the upstream was a video, not a still
    expect(images).toHaveLength(0);
    expect(videos).toEqual(["https://cdn/a.mp4"]);

    // resolveVideoStartFrame must fall back to videos[0] (the v2v fix)
    const startFrame = resolveVideoStartFrame(images, videos);
    expect(startFrame).toBe("https://cdn/a.mp4");
  });
});

// ─── resolveVideoEndFrame ──────────────────────────────────────────────────────

describe("resolveVideoEndFrame", () => {
  test("returns null when only one image is upstream", () => {
    expect(resolveVideoEndFrame(["https://cdn/start.jpg"])).toBeNull();
  });

  test("returns null when no images are upstream", () => {
    expect(resolveVideoEndFrame([])).toBeNull();
  });

  test("returns the second image when two images are upstream (motion interpolation)", () => {
    const endFrame = resolveVideoEndFrame([
      "https://cdn/start.jpg",
      "https://cdn/end.jpg",
    ]);
    expect(endFrame).toBe("https://cdn/end.jpg");
  });

  test("returns the second image even when three images are upstream", () => {
    const endFrame = resolveVideoEndFrame([
      "https://cdn/a.jpg",
      "https://cdn/b.jpg",
      "https://cdn/c.jpg",
    ]);
    expect(endFrame).toBe("https://cdn/b.jpg");
  });
});
