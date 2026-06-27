// Inference layer entrypoint — dispatcher across all pluggable GPU backends.
//
// Reusable layer: this whole `src/lib/inference/` folder + the thin
// `src/lib/inference.functions.ts` wrapper is all you need to drop into another
// project. No DB, no auth — just HTTP-out to whichever GPU backend is configured
// via env vars. Each backend declares which task types it can serve and what env
// it needs, so routing is capability- and config-driven with explicit failure
// (never a silent fallback).

import type { InferenceInput, InferenceResult, ProviderAdapter, ProviderId, TaskType } from "./types";
import { runpodAdapter } from "./providers/runpod";
import { huggingfaceAdapter } from "./providers/huggingface";
import { customAdapter } from "./providers/custom";
import { vastAdapter } from "./providers/vast";
import { comfyuiAdapter } from "./providers/comfyui";

export const adapters: Record<ProviderId, ProviderAdapter> = {
  runpod: runpodAdapter,
  huggingface: huggingfaceAdapter,
  custom: customAdapter,
  vast: vastAdapter,
  comfyui: comfyuiAdapter,
};

/** Run inference on a specific backend. Throws if the backend is unknown. */
export async function runInference(
  provider: ProviderId,
  input: InferenceInput,
): Promise<InferenceResult> {
  const adapter = adapters[provider];
  if (!adapter) throw new Error(`Unknown provider: ${provider}`);
  return adapter.run(input);
}

function isConfigured(a: ProviderAdapter): boolean {
  return a.requiredEnv.every((k) => !!process.env[k]);
}

/**
 * Pick the first configured backend that can serve `input.task` and run it,
 * falling through to the next configured backend on failure. Throws an explicit
 * error (with per-backend missing-env reasons) when none is configured — no
 * silent fallback.
 */
export async function runInferenceAuto(
  input: InferenceInput,
): Promise<InferenceResult & { provider: ProviderId }> {
  const capable = Object.values(adapters).filter((a) => a.tasks.includes(input.task));
  const ready = capable.filter(isConfigured);
  if (ready.length === 0) {
    const reasons = capable
      .map((a) => `${a.id}: missing ${a.requiredEnv.filter((k) => !process.env[k]).join(", ") || "—"}`)
      .join("; ");
    const detail = capable.length ? ` Configure one of → ${reasons}` : "";
    throw new Error(`No GPU backend configured for "${input.task}".${detail}`);
  }
  let lastErr: Error | null = null;
  for (const a of ready) {
    try {
      const res = await a.run(input);
      return { ...res, provider: a.id };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error(`All configured GPU backends failed for "${input.task}".`);
}

export function providerStatus(): Array<{
  id: ProviderId;
  label: string;
  configured: boolean;
  missing: string[];
  tasks: TaskType[];
}> {
  return Object.values(adapters).map((a) => {
    const missing = a.requiredEnv.filter((k) => !process.env[k]);
    return { id: a.id, label: a.label, configured: missing.length === 0, missing, tasks: a.tasks };
  });
}

export type { InferenceInput, InferenceResult, ProviderId, TaskType } from "./types";
