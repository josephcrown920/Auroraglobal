// TanStack Start server-function wrapper around the inference layer.
// This is the *only* file that ties the reusable `lib/inference/` folder
// to TanStack — replace it with an Edge Function, Next route, etc. to
// reuse the adapters elsewhere.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runInference, providerStatus } from "./inference";
import { normaliseInferenceInput } from "./inference/protocols";
import type { ProviderId } from "./inference/types";

// Accept the legacy {mediaUrl, mode} shape at the boundary; normalise before
// passing to the inference layer so internal code stays clean.
const RunInput = z.object({
  provider: z.enum(["runpod", "huggingface", "custom", "vast", "comfyui", "inferencesh"]),
  audioUrl: z.string().url(),
  mediaUrl: z.string().url(),
  mode: z.enum(["image", "video"]),
});

export const runLipSync = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RunInput.parse(d))
  .handler(async ({ data }) => {
    try {
      const result = await runInference(
        data.provider as ProviderId,
        normaliseInferenceInput({
          task: "lipsync",
          audioUrl: data.audioUrl,
          mediaUrl: data.mediaUrl,
          mode: data.mode,
        }),
      );
      return { ok: true as const, videoUrl: result.videoUrl ?? result.outputUrl };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false as const, error: message };
    }
  });

export const getProviderStatus = createServerFn({ method: "GET" }).handler(async () => {
  return providerStatus();
});
