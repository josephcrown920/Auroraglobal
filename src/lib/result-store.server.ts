// Shared post-orchestrate compression + storage pipeline — cost-control guardrail.
//
// Every final media result URL that reaches a `generations` row must pass
// through `persistResultUrl`: fetch the provider bytes → compress them
// (image → lossy WebP, video → H.264 CRF re-encode, both in compress.server)
// → upload into our public `studio` bucket → record OUR durable URL. This is
// the single choke point that guarantees "no raw provider output stored
// unprocessed" for both the synchronous orchestrated path
// (generate-core.server) and the queue runners (jobs.server).
//
// Audio results (TTS mp3/aac) are already codec-compressed by the provider, so
// they are persisted as-is — the goal there is durability (provider delivery
// URLs expire), not re-compression.
//
// Skip rule: a URL already inside our own Supabase storage
// (`/storage/v1/object/`) was persisted at generation time by an adapter that
// uploads directly (HF / Gemini); re-fetching and re-storing it would double
// storage for no gain, so it is returned unchanged.
//
// Failure policy mirrors compress.server: a delivered render the user was
// charged for must NEVER be lost. If the fetch or upload fails we log loudly
// and fall back to the raw provider URL — an explicit, observable fallback,
// not a silent one.
import { extFromMime, type CompressedOutput } from "./compress.server";

export type ResultMediaType = "image" | "video" | "audio";

export type PersistResultArgs = {
  userId: string;
  /** Storage key — generation id, job id, or reservation ref. */
  refId: string;
  mediaType: ResultMediaType;
  url: string;
};

export type PersistResultOutcome = {
  url: string;
  /** True when the bytes now live in our storage (false = skipped or fell back to the raw URL). */
  persisted: boolean;
  /** True when the stored bytes are the re-encoded (smaller) version. */
  compressed: boolean;
};

export type PersistDeps = {
  fetch: (url: string) => Promise<{ bytes: Buffer; mime: string }>;
  upload: (path: string, bytes: Uint8Array | Buffer, contentType: string) => Promise<string>;
  compressImage: (bytes: Buffer, mime: string) => Promise<CompressedOutput>;
  compressVideo: (bytes: Buffer, mime: string) => Promise<CompressedOutput>;
};

/** True for URLs already hosted in our own Supabase storage (public or signed). */
export function isOwnStorageUrl(url: string): boolean {
  return url.includes("/storage/v1/object/");
}

export function resultStoragePath(userId: string, refId: string, ext: string): string {
  return `${userId}/results/${refId}.${ext}`;
}

/**
 * Media type of a GenerateKind's final result URL, mirroring exactly which
 * `generations` column reserveOrchestrateRecord routes `result.url` into.
 * `null` = the kind has no URL output to persist (e.g. `text`).
 */
export function resultMediaTypeForKind(kind: string): ResultMediaType | null {
  if (kind === "image") return "image";
  if (kind === "video" || kind === "lipsync" || kind === "caption_burn") return "video";
  if (kind === "audio") return "audio";
  return null;
}

// All default deps are lazily imported so that unit tests importing this
// module (or modules that re-export it) never pull in the Supabase client or
// provider SDKs at module-load time.
function defaultDeps(): PersistDeps {
  return {
    fetch: async (url) => (await import("./replicate.server")).fetchToBytes(url),
    upload: async (path, bytes, contentType) => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.storage
        .from("studio")
        .upload(path, bytes, { contentType, upsert: true });
      if (error) throw new Error(`studio upload failed: ${error.message}`);
      return supabaseAdmin.storage.from("studio").getPublicUrl(path).data.publicUrl;
    },
    compressImage: async (bytes, mime) =>
      (await import("./compress.server")).compressImageBytes(bytes, mime),
    compressVideo: async (bytes, mime) =>
      (await import("./compress.server")).compressVideoBytes(bytes, mime),
  };
}

export async function persistResultUrl(
  args: PersistResultArgs,
  deps: PersistDeps = defaultDeps(),
): Promise<PersistResultOutcome> {
  if (!args.url || isOwnStorageUrl(args.url)) {
    return { url: args.url, persisted: false, compressed: false };
  }
  try {
    const { bytes, mime } = await deps.fetch(args.url);
    let out: CompressedOutput;
    if (args.mediaType === "image") {
      out = await deps.compressImage(bytes, mime || "image/png");
    } else if (args.mediaType === "video") {
      out = await deps.compressVideo(bytes, mime || "video/mp4");
    } else {
      const audioMime = mime || "audio/mpeg";
      out = { bytes, mime: audioMime, ext: extFromMime(audioMime, "mp3"), compressed: false };
    }
    const url = await deps.upload(
      resultStoragePath(args.userId, args.refId, out.ext),
      out.bytes,
      out.mime,
    );
    return { url, persisted: true, compressed: out.compressed };
  } catch (e) {
    console.error(
      "[result-store] persist failed — falling back to the raw provider URL",
      args.refId,
      e,
    );
    return { url: args.url, persisted: false, compressed: false };
  }
}
