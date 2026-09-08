import { GoogleGenAI, Modality } from "@google/genai";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwnedReferenceImage, assertOwnStudioUpload } from "./url-guard";

export const MULTISHOT_PLANNING_MODEL = "gemini-3-flash-preview";
export const MULTISHOT_LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";
export const MULTISHOT_LIVE_SESSION_MINUTES = 10;

const AspectSchema = z.enum(["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]);
export const GeminiShotBriefSchema = z.object({
  brief: z.string().trim().min(1).max(3000),
  continuity: z.string().trim().max(2000),
  shots: z.array(z.object({
    title: z.string().trim().min(1).max(120),
    prompt: z.string().trim().min(10).max(4000),
  })).min(2).max(8),
});
export type GeminiShotBrief = z.infer<typeof GeminiShotBriefSchema>;

const PlanInputSchema = z.object({
  direction: z.string().trim().max(4000).default(""),
  style: z.string().trim().max(1000).default(""),
  identityAnchor: z.string().trim().max(1000).default(""),
  aspectRatio: AspectSchema,
  shotCount: z.number().int().min(2).max(8),
  referenceUrls: z.array(z.string().url()).max(8).default([]),
  audioReferenceUrl: z.string().url().nullable().default(null),
});

type PlanInput = z.infer<typeof PlanInputSchema>;
type MediaPart = { text: string } | { inlineData: { mimeType: string; data: string } };
const MAX_INLINE_BYTES = 8 * 1024 * 1024;
const MAX_SINGLE_MEDIA_BYTES = 5 * 1024 * 1024;

function directClient(apiVersion = "v1beta") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey, httpOptions: { apiVersion, timeout: 60_000 } });
}

function planningClient(): { ai: GoogleGenAI; transport: "Google Gemini API" | "Replit AI Integrations · Google Gemini" } | null {
  const direct = directClient();
  if (direct) return { ai: direct, transport: "Google Gemini API" };
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return {
    ai: new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: "", baseUrl, timeout: 60_000 },
    }),
    transport: "Replit AI Integrations · Google Gemini",
  };
}

async function readOwnedMedia(url: string, kind: "image" | "audio", userId: string) {
  if (kind === "image") await assertOwnedReferenceImage(url, userId);
  else assertOwnStudioUpload(url, userId);
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Could not read owned ${kind} reference (${response.status})`);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_SINGLE_MEDIA_BYTES) {
    throw new Error(`${kind === "image" ? "Image" : "Audio"} reference exceeds the 5MB planning limit`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_SINGLE_MEDIA_BYTES) {
    throw new Error(`${kind === "image" ? "Image" : "Audio"} reference exceeds the 5MB planning limit`);
  }
  const fallbackMime = kind === "image" ? "image/jpeg" : "audio/mpeg";
  const mimeType = response.headers.get("content-type")?.split(";")[0] || fallbackMime;
  if (!mimeType.startsWith(`${kind}/`)) throw new Error(`Owned ${kind} reference has an invalid media type`);
  return { bytes, mimeType };
}

async function buildMultimodalParts(input: PlanInput, userId: string): Promise<MediaPart[]> {
  const media: MediaPart[] = [];
  let total = 0;
  for (const url of input.referenceUrls) {
    const item = await readOwnedMedia(url, "image", userId);
    total += item.bytes.byteLength;
    if (total > MAX_INLINE_BYTES) throw new Error("Combined planning references exceed Gemini's 8MB inline limit");
    media.push({ inlineData: { mimeType: item.mimeType, data: item.bytes.toString("base64") } });
  }
  if (input.audioReferenceUrl) {
    const item = await readOwnedMedia(input.audioReferenceUrl, "audio", userId);
    total += item.bytes.byteLength;
    if (total > MAX_INLINE_BYTES) throw new Error("Combined planning references exceed Gemini's 8MB inline limit");
    media.push({ inlineData: { mimeType: item.mimeType, data: item.bytes.toString("base64") } });
  }
  return media;
}

const responseJsonSchema = {
  type: "object",
  required: ["brief", "continuity", "shots"],
  properties: {
    brief: { type: "string" },
    continuity: { type: "string" },
    shots: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        required: ["title", "prompt"],
        properties: { title: { type: "string" }, prompt: { type: "string" } },
      },
    },
  },
} as const;

const planningHits = new Map<string, number[]>();
function assertPlanningRate(userId: string) {
  const now = Date.now();
  const hits = (planningHits.get(userId) ?? []).filter((time) => now - time < 60_000);
  if (hits.length >= 6) throw new Error("Gemini shot planning is limited to 6 requests per minute");
  hits.push(now);
  planningHits.set(userId, hits);
  if (planningHits.size > 5000) {
    for (const [id, values] of planningHits) {
      if (values.every((time) => now - time >= 60_000)) planningHits.delete(id);
    }
  }
}

async function generatePlan(input: PlanInput, userId: string) {
  assertPlanningRate(userId);
  const configured = planningClient();
  if (!configured) {
    throw new Error("Google multimodal planning is not configured. No Google request was made.");
  }
  const media = await buildMultimodalParts(input, userId);
  const prompt = [
    `Create exactly ${input.shotCount} production-ready, independently editable shot briefs in ${input.aspectRatio}.`,
    input.direction && `Director direction: ${input.direction}`,
    input.style && `Shared style: ${input.style}`,
    input.identityAnchor && `Identity anchor: ${input.identityAnchor}`,
    "Actually inspect every supplied image and audio reference. Use audio pacing, mood, beats, dialogue, or sound cues only when present.",
    "Each prompt must specify subject action, framing, camera/lens/movement, lighting, environment, temporal action, and continuity.",
    "Do not claim details that are not perceptible in the references. Return JSON only.",
  ].filter(Boolean).join("\n");
  const response = await configured.ai.models.generateContent({
    model: MULTISHOT_PLANNING_MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }, ...media] }],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema,
      maxOutputTokens: 8192,
    },
  });
  if (!response.text) throw new Error("Google Gemini returned no shot plan");
  let parsed: unknown;
  try {
    parsed = JSON.parse(response.text);
  } catch {
    throw new Error("Google Gemini returned an invalid shot-plan payload");
  }
  const plan = GeminiShotBriefSchema.parse(parsed);
  if (plan.shots.length !== input.shotCount) {
    throw new Error(`Google Gemini returned ${plan.shots.length} shots instead of ${input.shotCount}`);
  }
  return {
    ...plan,
    provenance: {
      provider: "Google",
      requestedModel: MULTISHOT_PLANNING_MODEL,
      servingModel: response.modelVersion || MULTISHOT_PLANNING_MODEL,
      transport: configured.transport,
      usedImages: input.referenceUrls.length,
      usedAudio: Boolean(input.audioReferenceUrl),
    },
  };
}

export const planMultishotWithGemini = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlanInputSchema.parse(input))
  .handler(({ data, context }) => generatePlan(data, context.userId));

export const convertLiveTranscriptToShotBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlanInputSchema.omit({
    referenceUrls: true,
    audioReferenceUrl: true,
  }).extend({
    transcript: z.string().trim().min(4).max(12_000),
  }).parse(input))
  .handler(({ data, context }) => generatePlan({
    direction: `${data.direction}\nLive director transcript:\n${data.transcript}`.trim(),
    style: data.style,
    identityAnchor: data.identityAnchor,
    aspectRatio: data.aspectRatio,
    shotCount: data.shotCount,
    referenceUrls: [],
    audioReferenceUrl: null,
  }, context.userId));

type CapabilityState = {
  access: "available" | "not_configured" | "account_unavailable" | "temporarily_unavailable";
  reason: string | null;
  checkedAt: string;
};
let liveCapabilityCache: { expires: number; value: CapabilityState } | null = null;

async function discoverLiveCapability(): Promise<CapabilityState> {
  const checkedAt = new Date().toISOString();
  // Model metadata is served by the stable discovery API. Only token creation
  // and the browser Live socket use v1alpha.
  const client = directClient();
  if (!client) {
    return {
      access: "not_configured",
      reason: "Live Voice requires a direct Google Gemini credential; the Replit Gemini proxy does not support Live API.",
      checkedAt,
    };
  }
  try {
    const model = await client.models.get({ model: MULTISHOT_LIVE_MODEL });
    return model.name
      ? { access: "available", reason: null, checkedAt }
      : { access: "account_unavailable", reason: "Google did not return the configured Live model for this account.", checkedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const unavailable = /\b(400|403|404)\b|permission|not found|not supported/i.test(message);
    return {
      access: unavailable ? "account_unavailable" : "temporarily_unavailable",
      reason: unavailable
        ? `Google rejected access to ${MULTISHOT_LIVE_MODEL}.`
        : "Google Live capability discovery could not be completed; retry shortly.",
      checkedAt,
    };
  }
}

export const getMultishotGeminiCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    if (!liveCapabilityCache || liveCapabilityCache.expires < Date.now()) {
      liveCapabilityCache = { value: await discoverLiveCapability(), expires: Date.now() + 5 * 60_000 };
    }
    return {
      planning: {
        implemented: true,
        access: planningClient() ? "validated_on_use" as const : "not_configured" as const,
        model: MULTISHOT_PLANNING_MODEL,
        provider: "Google",
        reason: planningClient() ? null : "No Google Gemini credential or supported Gemini integration is configured.",
        rateLimit: "6 plans per minute per account",
      },
      liveVoice: {
        implemented: true,
        ...liveCapabilityCache.value,
        model: MULTISHOT_LIVE_MODEL,
        provider: "Google Gemini Live API",
        sessionLimitMinutes: MULTISHOT_LIVE_SESSION_MINUTES,
        tokenUses: 1,
        rateLimit: "3 starts per minute and 12 starts per hour per account",
      },
      nativeAudioVideo: {
        implemented: false,
        access: "not_implemented" as const,
        model: "veo-3.1-generate-preview",
        reason: "No approved-preview-bound direct Google Veo native-audio adapter is implemented in Multishot.",
      },
    };
  });

const liveStarts = new Map<string, number[]>();
function assertLiveStartRate(userId: string) {
  const now = Date.now();
  const hour = (liveStarts.get(userId) ?? []).filter((time) => now - time < 60 * 60_000);
  if (hour.filter((time) => now - time < 60_000).length >= 3 || hour.length >= 12) {
    throw new Error("Live Voice start limit reached (3/minute, 12/hour)");
  }
  hour.push(now);
  liveStarts.set(userId, hour);
}

export const createMultishotLiveToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ purpose: z.literal("multishot_voice_director") }).parse(input))
  .handler(async ({ context }) => {
    assertLiveStartRate(context.userId);
    const client = directClient("v1alpha");
    if (!client) throw new Error("Direct Google Gemini Live authentication is not configured");
    const now = Date.now();
    const expireTime = new Date(now + MULTISHOT_LIVE_SESSION_MINUTES * 60_000).toISOString();
    const token = await client.authTokens.create({
      config: {
        uses: 1,
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        expireTime,
        liveConnectConstraints: {
          model: MULTISHOT_LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: [
              "You are a live film director helping shape a Multishot sequence.",
              "Ask concise production questions and turn spoken direction into actionable visual notes.",
              "Never claim to render or save a shot. The app applies the transcript only after the user stops.",
            ].join(" "),
          },
        },
        lockAdditionalFields: [],
      },
    });
    if (!token.name) throw new Error("Google did not issue a Live API ephemeral token");
    return {
      token: token.name,
      model: MULTISHOT_LIVE_MODEL,
      provider: "Google Gemini Live API",
      expiresAt: expireTime,
      sessionLimitMinutes: MULTISHOT_LIVE_SESSION_MINUTES,
    };
  });