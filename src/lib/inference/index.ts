// Inference layer entrypoint — dispatcher across all GPU providers.
//
// Reusable layer: this whole `src/lib/inference/` folder + the thin
// `src/lib/inference.functions.ts` wrapper is all you need to drop into
// another project. No DB, no auth — just HTTP-out to whichever GPU
// backend is configured via env vars.

import type { InferenceInput, InferenceResult, ProviderAdapter, ProviderId } from "./types";
import { runpodAdapter } from "./providers/runpod";
import { huggingfaceAdapter } from "./providers/huggingface";
import { customAdapter } from "./providers/custom";

export const adapters: Record<ProviderId, ProviderAdapter> = {
  runpod: runpodAdapter,
  huggingface: huggingfaceAdapter,
  custom: customAdapter,
};

export async function runInference(
  provider: ProviderId,
  input: InferenceInput,
): Promise<InferenceResult> {
  const adapter = adapters[provider];
  if (!adapter) throw new Error(`Unknown provider: ${provider}`);
  return adapter.run(input);
}

export function providerStatus(): Array<{
  id: ProviderId;
  label: string;
  configured: boolean;
  missing: string[];
}> {
  return Object.values(adapters).map((a) => {
    const missing = a.requiredEnv.filter((k) => !process.env[k]);
    return { id: a.id, label: a.label, configured: missing.length === 0, missing };
  });
}

export type { InferenceInput, InferenceResult, ProviderId } from "./types";
