// Pure wire contract: usable in request guards/tests without importing secrets.
export const NATIVE_SEEDANCE_25 = "byteplus/seedance-2.5";
export const SEEDANCE_25_MODEL_ID = "dreamina-seedance-2-5-260628";

export type BytePlusImageRole = "first_frame" | "last_frame" | "reference_image";
export type BytePlusVideoInput = {
  model: string;
  prompt?: string;
  imageUrls?: string[];
  videoUrl?: string;
  audioUrl?: string;
  duration?: number;
  resolution?: "480p" | "720p" | "1080p" | "2160p";
  aspectRatio?: string;
  generateAudio?: boolean;
  watermark?: boolean;
  seed?: number;
  imageRoles?: BytePlusImageRole[];
};

/** Only the documented 2.5 checkpoint supports this expanded wire contract. */
export function buildBytePlusVideoBody(opts: BytePlusVideoInput): Record<string, unknown> {
  for (const value of [opts.generateAudio, opts.watermark]) {
    if (value !== undefined && typeof value !== "boolean") {
      throw new Error("BytePlus audio and watermark controls must be booleans");
    }
  }
  if (opts.imageRoles !== undefined && !Array.isArray(opts.imageRoles)) {
    throw new Error("BytePlus image roles must be an array");
  }
  if (opts.model !== SEEDANCE_25_MODEL_ID) {
    if (opts.videoUrl || opts.audioUrl || (opts.imageUrls?.length ?? 0) > 1 ||
        opts.imageRoles || opts.generateAudio !== undefined || opts.seed !== undefined ||
        opts.watermark !== undefined) {
      throw new Error("This BytePlus checkpoint does not support the requested multimodal controls");
    }
    const flags: string[] = [];
    if (opts.resolution) flags.push(`--resolution ${opts.resolution}`);
    if (opts.duration) flags.push(`--duration ${Math.max(3, Math.min(12, Math.round(opts.duration)))}`);
    if (opts.aspectRatio) flags.push(`--aspect_ratio ${opts.aspectRatio}`);
    const text = `${opts.prompt ?? ""} ${flags.join(" ")}`.trim();
    const content: Array<Record<string, unknown>> = [];
    if (text) content.push({ type: "text", text });
    if (opts.imageUrls?.[0]) content.push({ type: "image_url", image_url: { url: opts.imageUrls[0] } });
    return { model: opts.model, content };
  }

  const images = opts.imageUrls ?? [];
  if (images.length > 9) throw new Error("Seedance supports at most 9 reference images");
  if (opts.duration !== undefined &&
      (!Number.isInteger(opts.duration) || opts.duration < 4 || opts.duration > 15)) {
    throw new Error("Seedance 2.5 duration must be an integer between 4 and 15 seconds");
  }
  if (opts.resolution && !["480p", "720p"].includes(opts.resolution)) {
    throw new Error("Seedance 2.5 currently supports 480p or 720p in Aurora");
  }
  if (opts.aspectRatio && !["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"].includes(opts.aspectRatio)) {
    throw new Error("Unsupported Seedance 2.5 aspect ratio");
  }
  if (opts.seed !== undefined && (!Number.isInteger(opts.seed) || opts.seed < -1 || opts.seed > 4294967295)) {
    throw new Error("Invalid Seedance seed");
  }
  if (opts.imageRoles && (opts.imageRoles.length !== images.length ||
      opts.imageRoles.some((role) => !["first_frame", "last_frame", "reference_image"].includes(role)))) {
    throw new Error("Every Seedance image must have a valid matching role");
  }
  const roles = opts.imageRoles ?? images.map(() =>
    images.length === 1 && !opts.videoUrl && !opts.audioUrl ? "first_frame" : "reference_image");
  if (roles.filter((r) => r === "first_frame").length > 1 ||
      roles.filter((r) => r === "last_frame").length > 1 ||
      (roles.includes("last_frame") && !roles.includes("first_frame")) ||
      (roles.includes("reference_image") && roles.some((r) => r !== "reference_image")) ||
      ((opts.videoUrl || opts.audioUrl) && roles.some((r) => r !== "reference_image"))) {
    throw new Error("Seedance frame conditioning and multimodal references cannot be mixed");
  }
  const content: Array<Record<string, unknown>> = [];
  if (opts.prompt?.trim()) content.push({ type: "text", text: opts.prompt.trim() });
  images.forEach((url, i) => content.push({ type: "image_url", image_url: { url }, role: roles[i] }));
  if (opts.videoUrl) content.push({ type: "video_url", video_url: { url: opts.videoUrl }, role: "reference_video" });
  if (opts.audioUrl) content.push({ type: "audio_url", audio_url: { url: opts.audioUrl }, role: "reference_audio" });
  if (!content.length) throw new Error("Seedance requires a prompt or reference");
  return {
    model: opts.model,
    content,
    ...(opts.duration !== undefined ? { duration: opts.duration } : {}),
    ...(opts.aspectRatio ? { ratio: opts.aspectRatio } : {}),
    ...(opts.resolution ? { resolution: opts.resolution } : {}),
    ...(opts.generateAudio !== undefined ? { generate_audio: opts.generateAudio } : {}),
    ...(opts.watermark !== undefined ? { watermark: opts.watermark } : {}),
    ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
  };
}

type RoutingInput = {
  model?: string;
  imageUrls?: string[];
  videoUrl?: string;
  audioUrl?: string;
  params?: Record<string, unknown>;
};

/** Prevent fallback adapters from dropping a rich Seedance reference/control. */
export function requiresNativeSeedance(req: RoutingInput): boolean {
  return req.model === NATIVE_SEEDANCE_25 ||
    (req.model === "seedance-2.5" && (
      !!req.videoUrl || !!req.audioUrl || (req.imageUrls?.length ?? 0) > 1 ||
      req.params?.imageRoles !== undefined || req.params?.generate_audio !== undefined ||
      req.params?.watermark !== undefined || req.params?.seed !== undefined
    ));
}