import { describe, expect, test } from "bun:test";
import {
  compressImageBytes,
  compressVideoBytes,
  extFromMime,
} from "./compress.server";

describe("extFromMime", () => {
  test("maps mime to extension with fallback", () => {
    expect(extFromMime("image/png", "png")).toBe("png");
    expect(extFromMime("image/svg+xml", "png")).toBe("svg");
    expect(extFromMime("", "png")).toBe("png");
  });
});

describe("compressImageBytes", () => {
  test("re-encodes a PNG to a smaller webp", async () => {
    const { spawnSync } = await import("node:child_process");
    const { mkdtempSync, readFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "aurora-compress-test-"));
    let png: Buffer;
    try {
      const src = join(dir, "src.png");
      const gen = spawnSync("ffmpeg", [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=256x256",
        "-frames:v",
        "1",
        "-c:v",
        "png",
        src,
      ]);
      expect(gen.status).toBe(0);
      png = Buffer.from(readFileSync(src));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    const out = await compressImageBytes(png, "image/png");
    expect(out.compressed).toBe(true);
    expect(out.mime).toBe("image/webp");
    expect(out.ext).toBe("webp");
    expect(out.bytes.length).toBeLessThan(png.length);
  }, 20000);

  test("falls back to original bytes on invalid input", async () => {
    const garbage = Buffer.from("definitely not an image");
    const out = await compressImageBytes(garbage, "image/png");
    expect(out.compressed).toBe(false);
    expect(out.bytes).toBe(garbage);
    expect(out.mime).toBe("image/png");
    expect(out.ext).toBe("png");
  });
});

describe("compressVideoBytes", () => {
  test("falls back to original bytes on invalid input", async () => {
    const garbage = Buffer.from("definitely not a video");
    const out = await compressVideoBytes(garbage, "video/mp4");
    expect(out.compressed).toBe(false);
    expect(out.bytes).toBe(garbage);
    expect(out.ext).toBe("mp4");
  }, 30000);

  test("re-encodes an inefficient mp4 to a smaller one", async () => {
    const { spawnSync } = await import("node:child_process");
    const { mkdtempSync, readFileSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = mkdtempSync(join(tmpdir(), "aurora-compress-test-"));
    try {
      const src = join(dir, "src.mp4");
      // 1s of noisy test video encoded near-losslessly → large file.
      const gen = spawnSync("ffmpeg", [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=320x240:rate=15:duration=1",
        "-c:v",
        "libx264",
        "-qp",
        "0",
        src,
      ]);
      expect(gen.status).toBe(0);
      const raw = readFileSync(src);
      const out = await compressVideoBytes(Buffer.from(raw), "video/mp4");
      expect(out.compressed).toBe(true);
      expect(out.bytes.length).toBeLessThan(raw.length);
      expect(out.mime).toBe("video/mp4");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);
});
