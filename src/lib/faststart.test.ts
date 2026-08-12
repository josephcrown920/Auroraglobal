import { describe, expect, it } from "bun:test";

import { moovBeforeMdat } from "../routes/api/public/faststart-video";

/** Build a minimal ISO-BMFF box: 4-byte size + 4-char type + payload. */
function box(type: string, payloadLen = 0): Buffer {
  const b = Buffer.alloc(8 + payloadLen);
  b.writeUInt32BE(8 + payloadLen, 0);
  b.write(type, 4, "latin1");
  return b;
}

describe("moovBeforeMdat", () => {
  it("returns true when moov precedes mdat (faststart layout)", () => {
    const buf = Buffer.concat([box("ftyp", 8), box("moov", 32), box("mdat", 64)]);
    expect(moovBeforeMdat(buf)).toBe(true);
  });

  it("returns false when mdat precedes moov (needs remux)", () => {
    const buf = Buffer.concat([box("ftyp", 8), box("mdat", 64), box("moov", 32)]);
    expect(moovBeforeMdat(buf)).toBe(false);
  });

  it("skips free/other boxes while scanning", () => {
    const buf = Buffer.concat([box("ftyp", 8), box("free", 16), box("moov", 32), box("mdat", 4)]);
    expect(moovBeforeMdat(buf)).toBe(true);
  });

  it("handles 64-bit largesize mdat boxes", () => {
    const payload = Buffer.alloc(24);
    const header = Buffer.alloc(16);
    header.writeUInt32BE(1, 0); // size=1 → largesize follows
    header.write("mdat", 4, "latin1");
    header.writeBigUInt64BE(BigInt(16 + payload.length), 8);
    const buf = Buffer.concat([box("ftyp", 8), header, payload, box("moov", 32)]);
    expect(moovBeforeMdat(buf)).toBe(false);
  });

  it("returns null for non-MP4 payloads (e.g. webm/EBML)", () => {
    const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01, 0x00, 0x00, 0x00]);
    expect(moovBeforeMdat(webm)).toBeNull();
  });

  it("returns null for truncated/empty buffers", () => {
    expect(moovBeforeMdat(Buffer.alloc(0))).toBeNull();
    expect(moovBeforeMdat(Buffer.from("mdat"))).toBeNull();
  });

  it("returns null when mdat appears without a leading ftyp (ambiguous container)", () => {
    const buf = Buffer.concat([box("mdat", 16), box("moov", 8)]);
    expect(moovBeforeMdat(buf)).toBeNull();
  });
});
