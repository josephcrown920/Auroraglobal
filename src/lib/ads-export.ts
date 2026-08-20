import { zipSync, strToU8 } from "fflate";

export type AdAssetKind = "image" | "video";
export type AdPlacement = {
  id: "square" | "portrait" | "stories";
  label: string;
  width: number;
  height: number;
};

export const META_PLACEMENTS: AdPlacement[] = [
  { id: "square", label: "Feed square", width: 1080, height: 1080 },
  { id: "portrait", label: "Feed portrait", width: 1080, height: 1350 },
  { id: "stories", label: "Stories & Reels", width: 1080, height: 1920 },
];

export type AdExportInput = {
  assetUrl: string;
  assetKind: AdAssetKind;
  headline: string;
  primaryText: string;
  cta: string;
  caption?: string;
  platform: "meta" | "tiktok";
};

type DownloadedAsset = { bytes: Uint8Array; ext: string; contentType: string };

function extensionFromContentType(contentType: string, fallback: string) {
  if (contentType.includes("jpeg")) return "jpg";
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("mp4")) return "mp4";
  return fallback;
}

async function downloadAsset(url: string, fallback: string): Promise<DownloadedAsset | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      ext: extensionFromContentType(contentType, fallback),
      contentType,
    };
  } catch {
    return null;
  }
}

async function imagePlacement(
  source: Blob,
  placement: AdPlacement,
): Promise<Uint8Array | null> {
  try {
    const bitmap = await createImageBitmap(source);
    const canvas = document.createElement("canvas");
    canvas.width = placement.width;
    canvas.height = placement.height;
    const context = canvas.getContext("2d");
    if (!context) return null;

    const scale = Math.max(placement.width / bitmap.width, placement.height / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    context.drawImage(bitmap, (placement.width - width) / 2, (placement.height - height) / 2, width, height);
    bitmap.close();

    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) return null;
    return new Uint8Array(await png.arrayBuffer());
  } catch {
    return null;
  }
}

function waitForMediaEvent(target: EventTarget, event: string) {
  return new Promise<void>((resolve, reject) => {
    const done = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(new Error(`Media ${event} failed.`));
    };
    const cleanup = () => {
      target.removeEventListener(event, done);
      target.removeEventListener("error", failed);
    };
    target.addEventListener(event, done, { once: true });
    target.addEventListener("error", failed, { once: true });
  });
}

async function videoPlacement(
  source: Blob,
  placement: AdPlacement,
): Promise<{ bytes: Uint8Array; ext: "mp4" | "webm" } | null> {
  // Re-encode a local Blob only — never send a user-controlled media URL to a
  // server. The duration cap keeps browser work predictable and bounded.
  if (!("MediaRecorder" in window) || !HTMLCanvasElement.prototype.captureStream) return null;
  const sourceUrl = URL.createObjectURL(source);
  try {
    const video = document.createElement("video");
    video.src = sourceUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    await waitForMediaEvent(video, "loadedmetadata");
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 30) return null;

    const canvas = document.createElement("canvas");
    canvas.width = placement.width;
    canvas.height = placement.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const mimeType = [
      "video/mp4;codecs=avc1.42E01E",
      "video/webm;codecs=vp9",
      "video/webm",
    ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) return null;

    const canvasStream = canvas.captureStream(30);
    const videoStream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
    const stream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...(videoStream?.getAudioTracks() ?? []),
    ]);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    const chunks: BlobPart[] = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) chunks.push(event.data);
    });
    const completed = new Promise<void>((resolve, reject) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.addEventListener("error", () => reject(new Error("Video encoding failed.")), { once: true });
    });

    const scale = Math.max(placement.width / video.videoWidth, placement.height / video.videoHeight);
    const width = video.videoWidth * scale;
    const height = video.videoHeight * scale;
    let animation = 0;
    const draw = () => {
      ctx.drawImage(video, (placement.width - width) / 2, (placement.height - height) / 2, width, height);
      if (!video.ended) animation = requestAnimationFrame(draw);
    };

    recorder.start(1_000);
    draw();
    await video.play();
    await waitForMediaEvent(video, "ended");
    cancelAnimationFrame(animation);
    recorder.stop();
    await completed;
    stream.getTracks().forEach((track) => track.stop());
    const encoded = new Blob(chunks, { type: mimeType });
    if (!encoded.size) return null;
    return {
      bytes: new Uint8Array(await encoded.arrayBuffer()),
      ext: mimeType.startsWith("video/mp4") ? "mp4" : "webm",
    };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function safeZoneGuide(placement: AdPlacement, platform: "meta" | "tiktok"): Promise<Uint8Array | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = placement.width;
    canvas.height = placement.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#0c0b16";
    ctx.fillRect(0, 0, placement.width, placement.height);
    ctx.strokeStyle = "#d9c8ff";
    ctx.lineWidth = 6;
    ctx.strokeRect(48, 48, placement.width - 96, placement.height - 96);

    if (placement.id === "stories") {
      const top = Math.round(placement.height * 0.13);
      const bottom = Math.round(placement.height * 0.22);
      ctx.fillStyle = "rgba(235, 73, 185, 0.22)";
      ctx.fillRect(0, 0, placement.width, top);
      ctx.fillRect(0, placement.height - bottom, placement.width, bottom);
      ctx.fillStyle = "rgba(45, 212, 191, 0.18)";
      ctx.fillRect(0, top, placement.width, placement.height - top - bottom);
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 44px sans-serif";
      ctx.fillText("Keep important copy inside this center area", 80, top + 70);
      ctx.font = "500 32px sans-serif";
      ctx.fillText(platform === "tiktok" ? "TikTok In-Feed UI safe-zone guide" : "Meta Stories & Reels safe-zone guide", 80, placement.height - 80);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 42px sans-serif";
      ctx.fillText(`${placement.label} · ${placement.width}×${placement.height}`, 80, 118);
    }

    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return png ? new Uint8Array(await png.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

function triggerZipDownload(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/zip" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 2_000);
}

/**
 * Builds a local creative pack only. It does not call generation, billing, or
 * publishing APIs. Images and supported short-form videos are rendered to exact
 * placement dimensions in the browser; browsers without local media encoding
 * receive the original file plus honest safe-zone instructions instead.
 */
export async function exportAdCreativeZip(input: AdExportInput): Promise<{ missing: string[] }> {
  const source = await downloadAsset(input.assetUrl, input.assetKind === "video" ? "mp4" : "png");
  const files: Record<string, Uint8Array> = {};
  const missing: string[] = [];
  const placements = input.platform === "tiktok" ? [META_PLACEMENTS[2]] : META_PLACEMENTS;
  const root = input.platform === "tiktok" ? "tiktok-in-feed/" : "meta-creative/";

  const copySheet = [
    `${input.platform === "tiktok" ? "TikTok In-Feed" : "Meta"} creative pack`,
    "",
    `Headline (${input.headline.length}/40): ${input.headline || "—"}`,
    `Primary text (${input.primaryText.length}/125): ${input.primaryText || "—"}`,
    `CTA: ${input.cta}`,
    input.caption !== undefined ? `TikTok caption (${input.caption.length}/100): ${input.caption || "—"}` : "",
    "",
    "Placement notes",
    ...placements.map((placement) => `- ${placement.label}: ${placement.width}×${placement.height}`),
    "",
    "No Aura was spent to build this pack.",
  ].filter(Boolean).join("\n");
  files[`${root}copy-sheet.txt`] = strToU8(copySheet);

  if (!source) {
    missing.push("Source media could not be downloaded from this browser.");
    files[`${root}source-media-url.txt`] = strToU8(input.assetUrl);
  } else if (input.assetKind === "image") {
    const sourceBlob = new Blob([source.bytes as unknown as BlobPart]);
    for (const placement of placements) {
      const rendered = await imagePlacement(sourceBlob, placement);
      if (rendered) {
        files[`${root}assets/${placement.width}x${placement.height}.png`] = rendered;
      } else {
        missing.push(`${placement.label} image`);
      }
    }
  } else {
    files[`${root}source-video.${source.ext}`] = source.bytes;
    const sourceBlob = new Blob(
      [source.bytes as unknown as BlobPart],
      { type: source.contentType || "video/mp4" },
    );
    const unavailable: string[] = [];
    for (const placement of placements) {
      const rendered = await videoPlacement(sourceBlob, placement);
      if (rendered) {
        files[`${root}assets/${placement.width}x${placement.height}.${rendered.ext}`] = rendered.bytes;
      } else {
        unavailable.push(`${placement.width}×${placement.height}`);
      }
    }
    if (unavailable.length) {
      missing.push(`Placement video encoding was unavailable for ${unavailable.join(", ")}. The original video and exact safe-zone guides are included instead.`);
      files[`${root}VIDEO-EXPORT-NOTE.txt`] = strToU8(
        "This browser could not locally re-encode one or more placement videos. Upload source-video to Meta or TikTok and use the exact-dimension safe-zone guides to crop/reframe in the platform. Aurora does not generate or charge for a new video when building this ad pack.",
      );
    }
  }

  for (const placement of placements) {
    const guide = await safeZoneGuide(placement, input.platform);
    if (guide) files[`${root}safe-zone-guides/${placement.width}x${placement.height}.png`] = guide;
  }

  files[`${root}manifest.json`] = strToU8(JSON.stringify({
    platform: input.platform,
    assetKind: input.assetKind,
    placements,
    sourceWasEmbedded: !!source,
    videoUsesBrowserEncoding: input.assetKind === "video",
  }, null, 2));

  triggerZipDownload(zipSync(files, { level: 6 }), `${input.platform}-ad-creative-pack.zip`);
  return { missing };
}