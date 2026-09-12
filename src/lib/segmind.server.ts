// Segmind Seedance 2.0 Mini server-only client.
// Uses the official Segmind REST API. Keep the API key server-side.

export const SEGMIND_SEEDANCE_MINI_ENDPOINT = "https://api.segmind.com/v1/seedance-2.0-mini";

export type SegmindSeedanceMiniRequest = {
  prompt: string;
  duration?: 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
  resolution?: "480p" | "720p";
  aspect_ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "21:9" | "adaptive";
  generate_audio?: boolean;
  seed?: number;
  bitrate_mode?: "standard" | "high";
  first_frame_url?: string;
  last_frame_url?: string;
  reference_images?: string[];
  reference_videos?: string[];
  reference_audios?: string[];
};

export type SegmindSeedanceMiniResult = {
  video: Blob;
  cost: number | null;
  costHeader: string | null;
  requestId: string | null;
};

function requireKey(): string {
  const key = process.env.SEGMIND_API_KEY;
  if (!key) throw new Error("SEGMIND_API_KEY is not configured");
  return key;
}

function parseCost(headers: Headers): { cost: number | null; source: string | null } {
  for (const name of ["x-cost", "x-credit-cost"]) {
    const raw = headers.get(name);
    if (!raw) continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return { cost: value, source: name };
  }
  return { cost: null, source: null };
}

/** Generate a Seedance 2.0 Mini clip through Segmind's synchronous v1 API. */
export async function segmindSeedanceMini(
  input: SegmindSeedanceMiniRequest,
  opts: { timeoutMs?: number } = {},
): Promise<SegmindSeedanceMiniResult> {
  const key = requireKey();
  if (!input.prompt?.trim()) throw new Error("Segmind Seedance Mini requires a prompt");

  const timeoutMs = Math.max(30_000, Math.min(opts.timeoutMs ?? 180_000, 600_000));
  const response = await fetch(SEGMIND_SEEDANCE_MINI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({
      duration: 5,
      resolution: "480p",
      aspect_ratio: "16:9",
      generate_audio: true,
      seed: 42,
      ...input,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Segmind Seedance 2 Mini ${response.status}: ${(await response.text()).slice(0, 1000)}`);
  }

  const cost = parseCost(response.headers);
  const requestId = response.headers.get("x-request-id") ?? response.headers.get("x-requestid");
  console.info("[segmind] Seedance 2 Mini generation", {
    requestId,
    cost: cost.cost,
    costHeader: cost.source,
    duration: input.duration ?? 5,
    resolution: input.resolution ?? "480p",
    aspectRatio: input.aspect_ratio ?? "16:9",
  });

  return {
    video: await response.blob(),
    cost: cost.cost,
    costHeader: cost.source,
    requestId,
  };
}

export const SEGMIND_SEEDANCE_MINI_USE_CASES = {
  verticalProductAds: {
    label: "Vertical product ads",
    resolution: "720p" as const,
    aspectRatio: "9:16" as const,
    duration: 5 as const,
    generateAudio: true,
    prompt:
      "A pair of white running shoes rotating slowly on a matte grey pedestal against a seamless deep blue background, hard studio key light from the upper left throwing a crisp shadow. The camera orbits smoothly to the right at a constant speed. Fine dust particles drift through the light. Ultra clean product lighting. Ambient sound of quiet studio room tone only. No music.",
  },
  filmPreviz: {
    label: "Film previz",
    resolution: "720p" as const,
    aspectRatio: "16:9" as const,
    duration: 5 as const,
    generateAudio: true,
    prompt:
      "A lone figure in a long charcoal coat walks away from camera down a wet cobblestone alley at night, signage glow reflecting in the puddles in cyan and magenta. Rain falls steadily. The camera tracks behind at walking pace, handheld with a slight sway. Volumetric light from a single overhead lamp catches the falling rain. Ambient sound of steady rain on stone, a distant traffic hum, and footsteps in shallow water. No music.",
  },
  volumeDraft: {
    label: "Volume drafting",
    resolution: "480p" as const,
    aspectRatio: "16:9" as const,
    duration: 4 as const,
    generateAudio: true,
    prompt:
      "A single ceramic coffee cup on a pale concrete countertop, steam curling upward through a shaft of hard morning light from a window to the left. The camera pushes in slowly and steadily. Dust motes drift across the light beam. Shallow depth of field, warm highlights against cool shadow. Ambient sound of a quiet room: a faint steam hiss and muffled street noise through glass. No music.",
  },
  verticalVolumeDraft: {
    label: "15-second vertical draft",
    resolution: "480p" as const,
    aspectRatio: "9:16" as const,
    duration: 15 as const,
    generateAudio: true,
    prompt:
      "A ceramic teapot pours steaming amber tea into a clear glass cup on a wooden table, morning light raking across from the right. Steam rises and curls through the light. The camera holds a slow steady push in, then settles. Loose tea leaves swirl and settle in the glass. Warm natural colour, soft shadows. Ambient sound of pouring liquid, a faint ceramic clink, and quiet room tone. No music.",
  },
} as const;
