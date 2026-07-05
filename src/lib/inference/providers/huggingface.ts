// Hugging Face Space (Gradio) adapter.
// Calls a Space's Gradio REST API via the modern /gradio_api/call/<fn> SSE flow.
//
// Required env:
//   HF_SPACE_URL    — e.g. "https://username-spacename.hf.space"
//   HF_TOKEN        — optional, only needed for private Spaces
//   HF_FN_NAME      — optional, defaults to "predict"
//   HF_TASKS        — optional comma list declaring what this Space actually
//                     runs (e.g. "image"). Defaults to every task the Gradio
//                     protocol can carry, which may overstate a single-model
//                     Space's real capability.
//
// Space contract: the Gradio function receives a positional argument list. For
// lip-sync that is (audio, media, mode); for other tasks it is
// (prompt, image, audio, video). See `gradioData` in ../protocols.ts.

import type { InferenceInput, InferenceResult, ProbeResult, ProviderAdapter } from "../types";
import {
  callGradioSpace,
  extractGradioUrl,
  gradioData,
  probeReachable,
  toResult,
} from "../protocols";

export const huggingfaceAdapter: ProviderAdapter = {
  id: "huggingface",
  label: "Hugging Face Space (Gradio)",
  requiredEnv: ["HF_SPACE_URL"],
  tasks: ["image", "video", "lipsync", "motion"],
  capabilitiesEnvVar: "HF_TASKS",

  async probeHealth(timeoutMs?: number): Promise<ProbeResult | null> {
    const base = process.env.HF_SPACE_URL?.replace(/\/$/, "");
    if (!base) return null;
    // The Gradio app root answers 2xx when the Space is awake.
    return probeReachable(`${base}/`, { token: process.env.HF_TOKEN, expectOk: true, timeoutMs });
  },

  async run(input: InferenceInput): Promise<InferenceResult> {
    const spaceUrl = process.env.HF_SPACE_URL?.replace(/\/$/, "");
    const token = process.env.HF_TOKEN;
    const fnName = process.env.HF_FN_NAME || "predict";
    if (!spaceUrl) {
      throw new Error("HuggingFace not configured: set HF_SPACE_URL secret.");
    }

    const result = await callGradioSpace(spaceUrl, fnName, token, gradioData(input));
    const outputUrl = extractGradioUrl(result, spaceUrl);
    if (!outputUrl) {
      throw new Error(
        `Could not find output URL in HF response: ${JSON.stringify(result).slice(0, 300)}`,
      );
    }
    return toResult(outputUrl, input, result);
  },
};
