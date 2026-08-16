import { describe, expect, it } from "bun:test";

import {
  base64ToBytes,
  inferImageMeta,
  randomUploadId,
  referenceUploadPath,
} from "./reference-image";

describe("base64ToBytes", () => {
  it("decodes known vectors", () => {
    expect([...base64ToBytes("")]).toEqual([]);
    expect([...base64ToBytes("AQID")]).toEqual([1, 2, 3]);
    expect(new TextDecoder().decode(base64ToBytes("TWFu"))).toBe("Man");
    expect(new TextDecoder().decode(base64ToBytes("TWE="))).toBe("Ma");
    expect(new TextDecoder().decode(base64ToBytes("TQ=="))).toBe("M");
  });

  it("round-trips random bytes against Buffer", () => {
    for (let n = 0; n < 40; n++) {
      const bytes = new Uint8Array(n);
      for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
      const b64 = Buffer.from(bytes).toString("base64");
      expect([...base64ToBytes(b64)]).toEqual([...bytes]);
    }
  });

  it("accepts URL-safe alphabet and whitespace", () => {
    // 0xfb 0xef 0xbe encodes to "+++" prefix territory; use -_ variants
    const bytes = new Uint8Array([251, 239, 190, 255]);
    const urlSafe = Buffer.from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    expect([...base64ToBytes(urlSafe)]).toEqual([...bytes]);
    expect([...base64ToBytes("AQ\nID\r\n ")]).toEqual([1, 2, 3]);
  });

  it("throws on malformed input instead of silently truncating", () => {
    expect(() => base64ToBytes("AQI!")).toThrow(/malformed/);
    expect(() => base64ToBytes("AAAAA")).toThrow(/malformed/); // len % 4 === 1
    expect(() => base64ToBytes("écafé")).toThrow(/malformed/);
  });
});

describe("inferImageMeta", () => {
  it("prefers the picker's mime type", () => {
    expect(inferImageMeta("image/png", "file:///a/b.jpg")).toEqual({
      contentType: "image/png",
      ext: "png",
    });
    expect(inferImageMeta("IMAGE/JPEG", null)).toEqual({
      contentType: "image/jpeg",
      ext: "jpg",
    });
    expect(inferImageMeta("image/webp;charset=x", null).ext).toBe("webp");
  });

  it("falls back to the uri extension, ignoring query/hash", () => {
    expect(inferImageMeta(null, "file:///x/photo.PNG?w=1#f")).toEqual({
      contentType: "image/png",
      ext: "png",
    });
    expect(inferImageMeta(undefined, "file:///x/pic.jpeg").ext).toBe("jpg");
  });

  it("defaults to jpeg when nothing is known", () => {
    expect(inferImageMeta(null, null)).toEqual({
      contentType: "image/jpeg",
      ext: "jpg",
    });
    expect(inferImageMeta("application/pdf", "file:///x/noext")).toEqual({
      contentType: "image/jpeg",
      ext: "jpg",
    });
  });
});

describe("referenceUploadPath", () => {
  it("writes into the caller's own uploads folder (ownership contract)", () => {
    const p = referenceUploadPath("user-123", "jpg");
    expect(p).toMatch(/^user-123\/uploads\/[a-z0-9-]+\.jpg$/);
  });

  it("uses distinct ids per call", () => {
    const ids = new Set(Array.from({ length: 500 }, () => randomUploadId()));
    expect(ids.size).toBe(500);
  });
});
