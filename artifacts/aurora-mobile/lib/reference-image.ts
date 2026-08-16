/**
 * Pure helpers for the reference-image upload flow.
 *
 * No React Native imports here so the module runs under `bun test`
 * (see reference-image.test.ts), mirroring the gallery-mapping pattern.
 *
 * The mobile app mirrors the web Studio uploader exactly: raw image bytes go
 * into the private `studio` bucket at `<userId>/uploads/<id>.<ext>`, then the
 * generation request receives a signed URL via `imageUrls` — the only
 * reference field `/api/public/generate` accepts.
 */

// ─── Base64 decoding ──────────────────────────────────────────────────────────

const B64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

let lookupTable: Int16Array | null = null;
function getLookup(): Int16Array {
  if (!lookupTable) {
    lookupTable = new Int16Array(128).fill(-1);
    for (let i = 0; i < B64_CHARS.length; i++) {
      lookupTable[B64_CHARS.charCodeAt(i)] = i;
    }
  }
  return lookupTable;
}

/**
 * Decode base64 (standard or URL-safe) into bytes. Hermes has no Buffer and
 * `atob` availability varies by engine, so decode manually. Throws on
 * malformed input instead of silently truncating the image.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const normalized = base64
    .replace(/\s/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/=+$/, "");
  if (normalized.length % 4 === 1) {
    throw new Error("Picked image returned malformed base64 data");
  }
  const lookup = getLookup();
  const out = new Uint8Array(Math.floor((normalized.length * 3) / 4));
  let acc = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    const v = code < 128 ? lookup[code] : -1;
    if (v === -1) {
      throw new Error("Picked image returned malformed base64 data");
    }
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  if (o !== out.length) {
    throw new Error("Picked image returned truncated base64 data");
  }
  return out;
}

// ─── Image meta ───────────────────────────────────────────────────────────────

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
};

export interface ImageMeta {
  contentType: string;
  ext: string;
}

/** Resolve upload content type + file extension from what the picker returned. */
export function inferImageMeta(
  mimeType?: string | null,
  uri?: string | null,
): ImageMeta {
  const mime = mimeType?.toLowerCase().split(";")[0]?.trim();
  if (mime && MIME_TO_EXT[mime]) {
    return { contentType: mime, ext: MIME_TO_EXT[mime] };
  }
  const uriExt = uri?.split(/[#?]/)[0]?.split(".").pop()?.toLowerCase();
  if (uriExt && EXT_TO_MIME[uriExt]) {
    return {
      contentType: EXT_TO_MIME[uriExt],
      ext: uriExt === "jpeg" ? "jpg" : uriExt,
    };
  }
  // expo-image-picker re-encodes edited/cropped picks as JPEG.
  return { contentType: "image/jpeg", ext: "jpg" };
}

// ─── Storage key ──────────────────────────────────────────────────────────────

/** Random id without crypto.randomUUID (not guaranteed on Hermes). */
export function randomUploadId(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand()}${rand()}`;
}

/**
 * Storage key inside the `studio` bucket. MUST stay `<userId>/uploads/...`:
 * the backend's reference-image ownership rules recognize exactly this folder
 * layout (it is the same key pattern the web Studio uploader writes).
 */
export function referenceUploadPath(
  userId: string,
  ext: string,
  id: string = randomUploadId(),
): string {
  return `${userId}/uploads/${id}.${ext}`;
}
