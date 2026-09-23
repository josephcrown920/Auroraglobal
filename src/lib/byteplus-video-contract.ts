// Pure wire contract: usable in request guards/tests without importing secrets.
export const NATIVE_SEEDANCE_25 = "byteplus/seedance-2.5";
export const SEEDANCE_25_MODEL_ID = "dreamina-seedance-2-5-260628";

/**
 * Canonical BytePlus/ModelArk video IDs used by every Aurora video-agent path.
 * UI labels, legacy slugs, and old agent defaults must never reach the provider
 * unchanged; this boundary normalizes them before request construction.
 */
export const SEEDANCE_MODEL_ALIASES: Readonly<Record<string, string>> = {
  "seedance-2.5": SEEDANCE_25_MODEL_ID,
  "byteplus/seedance-2.5": SEEDANCE_25_MODEL_ID,
  "dreamina-seedance-2-5-260628": SEEDANCE_25_MODEL_ID,
  "seedance-2.0": "dreamina-seedance-2-0-260128",
  "byteplus/seedance-2.0": "dreamina-seedance-2-0-260128",
  "dreamina-seedance-2-0-260128": "dreamina-seedance-2-0-260128",
  "seedance-2.0-fast": "dreamina-seedance-2-0-fast-260128",
  "byteplus/seedance-2.0-fast": "dreamina-seedance-2-0-fast-260128",
  "dreamina-seedance-2-0-fast-260128": "dreamina-seedance-2-0-fast-260128",
  "seedance-2.0-mini": "dreamina-seedance-2-0-mini-260615",
  "byteplus/seedance-2.0-mini": "dreamina-seedance-2-0-mini-260615",
  "dreamina-seedance-2-0-mini-260615": "dreamina-seedance-2-0-mini-260615",
  "seedance-1.5-pro": "seedance-1-5-pro-251215",
  "byteplus/seedance-1.5-pro": "seedance-1-5-pro-251215",
  "seedance-1-5-pro-251215": "seedance-1-5-pro-251215",
  // Retired/incorrect Aurora aliases are redirected to the current production
  // Seedance checkpoint instead of reaching ModelArk as invalid model IDs.
  "seedance-1-0-pro-250528": SEEDANCE_25_MODEL_ID,
  "seedance-3.0": SEEDANCE_25_MODEL_ID,
};

export function normalizeSeedanceModel(model: string | null | undefined): string {
  const trimmed = model?.trim() ?? "";
  return SEEDANCE_MODEL_ALIASES[trimmed] ?? trimmed;
}

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

/**
 * Seedance 2.x native wire contract.
 *
 * Current BytePlus documentation confirms that Seedance 2.0, 2.0 Fast,
 * 2.0 Mini, and 2.5 all support multimodal reference video, including
 * image + video combinations. This is therefore NOT a 2.5-only feature.
 */
export function buildBytePlusVideoBody(opts: BytePlusVideoInput): Record<string, unknown> {
  opts = { ...opts, model: normalizeSeedanceModel(opts.model) };

  for (const value of [opts.generateAudio, opts.watermark]) {
    if (value !== undefined && typeof value !== "boolean") {
      throw new Error("BytePlus audio and watermark controls must be booleans");
    }
  }
  if (opts.imageRoles !== undefined && !Array.isArray(opts.imageRoles)) {
    throw new Error("BytePlus image roles must be an array");
  }

  const isSeedance20 =
    opts.model === "dreamina-seedance-2-0-260128" ||
    opts.model === "dreamina-seedance-2-0-fast-260128" ||
    opts.model === "dreamina-seedance-2-0-mini-260615";
  const isSeedance25 = opts.model === SEEDANCE_25_MODEL_ID;
  const isSeedance2x = isSeedance20 || isSeedance25;

  // Preserve the older generic adapter behavior for non-2.x models, but do not
  // pretend they support Seedance 2.x multimodal controls.
  if (!isSeedance2x) {
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
  const maxImages = isSeedance25 ? 30 : 9;
  if (images.length > maxImages) {
    throw new Error(`Seedance supports at most ${maxImages} reference images for this checkpoint`);
  }

  const maxDuration = isSeedance25 ? 30 : 15;
  if (opts.duration !== undefined &&
      (!Number.isInteger(opts.duration) || opts.duration < 4 || opts.duration > maxDuration)) {
    throw new Error(`Seedance ${isSeedance25 ? "2.5" : "2.x"} duration is outside the supported range`);
  }

  // 1080p/4K are not available for all multimodal reference scenarios.
  // Keep Aurora's native reference-video path conservative and portable.
  if (opts.resolution && !["480p", "720p"].includes(opts.resolution)) {
    throw new Error("Seedance native multimodal motion currently supports 480p or 720p in Aurora");
  }
  if (opts.aspectRatio && !["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "adaptive"].includes(opts.aspectRatio)) {
    throw new Error("Unsupported Seedance aspect ratio");
  }
  if (opts.seed !== undefined && (!Number.isInteger(opts.seed) || opts.seed < -1 || opts.seed > 4294967295)) {
    throw new Error("Invalid Seedance seed");
  }

  // A single image alone is an image-to-video first frame. Once a reference
  // video/audio is present, the image becomes a multimodal reference image.
  // Two images without a video remain first+last-frame conditioning.
  const hasReferenceMedia = !!opts.videoUrl || !!opts.audioUrl;
  const roles = opts.imageRoles ?? images.map((_, i) => {
    if (hasReferenceMedia) return "reference_image" as const;
    if (images.length === 2) return i === 0 ? "first_frame" as const : "last_frame" as const;
    return "first_frame" as const;
  });

  if (roles.length !== images.length ||
      roles.some((role) => !["first_frame", "last_frame", "reference_image"].includes(role))) {
    throw new Error("Every Seedance image must have a valid matching role");
  }
  if (roles.filter((r) => r === "first_frame").length > 1 ||
      roles.filter((r) => r === "last_frame").length > 1 ||
      (roles.includes("last_frame") && !roles.includes("first_frame")) ||
      (hasReferenceMedia && roles.some((r) => r !== "reference_image"))) {
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
/** LAS asset references are the approved path for real-person material. */
export function isLasAssetReference(value: string | undefined | null): boolean {
  return /^asset:\/\//i.test(value?.trim() ?? "");
}

/**
 * BytePlus returns provider-specific wording for real-person review blocks.
 * Normalize it at the shared contract boundary so all Aurora adapters can
 * present the same remediation instead of retrying the same rejected input.
 */
export function isRealPersonReferenceBlock(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("real person") ||
    normalized.includes("real human") ||
    normalized.includes("real-person") ||
    normalized.includes("真人") ||
    normalized.includes("真实人物") ||
    normalized.includes("may contain a real person");
}

export function requiresNativeSeedance(req: RoutingInput): boolean {
  const isNativeAlias = req.model === NATIVE_SEEDANCE_25;
  const model = normalizeSeedanceModel(req.model);
  const hasNativeControls = !!req.videoUrl || !!req.audioUrl || (req.imageUrls?.length ?? 0) > 1 ||
    req.params?.imageRoles !== undefined || req.params?.generate_audio !== undefined ||
    req.params?.watermark !== undefined || req.params?.seed !== undefined;
  return isNativeAlias || (model === SEEDANCE_25_MODEL_ID && hasNativeControls);
}
