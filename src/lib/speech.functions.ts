import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reserveOrchestrateRecord } from "./generate-core.server";
import { PRICING } from "./pricing";

export const SPEECH_VOICE_OPTIONS = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel", description: "Calm, narration" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella", description: "Warm, friendly" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni", description: "Deep, confident" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh", description: "Casual, energetic" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam", description: "Clear, authoritative" },
  { id: "MF3mGyEYCl7XYWbV9V6O", label: "Elli", description: "Bright, youthful" },
] as const;

export const DEFAULT_SPEECH_VOICE_ID = SPEECH_VOICE_OPTIONS[0].id;

/**
 * Generate a voiceover via ElevenLabs TTS. Reserves credits upfront, routes
 * through the orchestrator's `audio` adapter chain (ElevenLabs first), commits
 * credits, and records a generations row — same flow as /api/public/generate.
 */
export const generateSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      text: z.string().min(1).max(2000),
      voiceId: z.string().max(120).default(DEFAULT_SPEECH_VOICE_ID),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const outcome = await reserveOrchestrateRecord({
      userId: context.userId,
      kind: "audio",
      model: "elevenlabs/tts",
      prompt: data.text,
      params: { voiceId: data.voiceId },
      cost: PRICING.base.audio,
      reason: "speech_tts",
    });
    if (!outcome.ok) {
      const err = new Error(outcome.error);
      if (outcome.insufficient) (err as Error & { code?: string }).code = "out_of_credit";
      throw err;
    }
    return { url: outcome.url!, provider: outcome.provider };
  });
