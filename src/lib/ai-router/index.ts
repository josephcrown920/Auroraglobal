// Aurora AI Intelligence Router — Main Entry Point
import { generateText, Output } from "ai";
import type { z } from "zod";
import { classifyRequest } from "./classifier";
import { CATEGORY_CHAINS } from "./chains";
import { getProviderRegistry } from "./providers";
import { countHealthyForCategory, isHealthy, recordOutcome } from "./health";
import { logRouterDecision } from "./logger";
import type { RequestCategory } from "./categories";
import { VIDEO_AGENT_SYSTEM_CONTRACT } from "@/lib/video-production-brain";

export type { RequestCategory } from "./categories";
export { classifyRequest } from "./classifier";
export { getHealthSnapshot } from "./health";
export { countHealthyForCategory } from "./health";
export { CATEGORY_CHAINS } from "./chains";

export type RoutedResult<T> = {
  output: T;
  provider: string;
  category: RequestCategory;
  fallbackCount: number;
  latencyMs: number;
  degraded?: boolean;
};

export type RoutedGenerateArgs<T> = {
  system: string;
  prompt: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  category?: RequestCategory;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  estimatedCost?: number;
  degradedOutput?: T;
};

/** Central structured LLM entry point. VIDEO_DIRECTION calls inherit the shared production brain contract. */
export async function routedGenerate<T>(args: RoutedGenerateArgs<T>): Promise<RoutedResult<T>> {
  const t0 = Date.now();
  const category: RequestCategory = args.category ?? classifyRequest(args.prompt);
  const chain = CATEGORY_CHAINS[category] ?? CATEGORY_CHAINS.GENERAL_CHAT;
  const registry = getProviderRegistry();
  const candidates = chain.map((name) => registry.get(name)).filter((p): p is NonNullable<typeof p> => !!p && p.enabled && isHealthy(p.name));

  if (candidates.length === 0) {
    const enabledCandidates = chain.map((name) => registry.get(name)).filter((p): p is NonNullable<typeof p> => !!p && p.enabled);
    if (enabledCandidates.length === 0) throw new Error("No LLM provider keys configured for Aurora AI Router");
    if (countHealthyForCategory(category, new Set(enabledCandidates.map((p) => p.name))) === 0) {
      if (args.degradedOutput === undefined) throw new Error("Aurora AI is temporarily catching up. Please try again in a moment.");
      const latencyMs = Date.now() - t0;
      void logRouterDecision({ category, provider_used: "none", fallback_count: 0, latency_ms: latencyMs, success: false, failure_reason: "All enabled providers are temporarily unhealthy", estimated_cost: args.estimatedCost ?? 0 });
      return { output: args.degradedOutput, provider: "none", category, fallbackCount: 0, latencyMs, degraded: true };
    }
  }

  const messages = [
    ...(args.conversationHistory ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: args.prompt },
  ];
  const system = category === "VIDEO_DIRECTION" ? `${VIDEO_AGENT_SYSTEM_CONTRACT}\n\nAGENT-SPECIFIC SYSTEM INSTRUCTIONS:\n${args.system}` : args.system;

  let lastErr: unknown;
  let fallbackCount = 0;
  for (const provider of candidates) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const callStart = Date.now();
      try {
        const gateway = provider.make();
        const model = gateway(provider.model);
        const { experimental_output } = await generateText({ model, system, messages, experimental_output: Output.object({ schema: args.schema }) });
        const latencyMs = Date.now() - t0;
        const callLatency = Date.now() - callStart;
        recordOutcome(provider.name, callLatency, true);
        void logRouterDecision({ category, provider_used: provider.name, fallback_count: fallbackCount, latency_ms: latencyMs, success: true, failure_reason: null, estimated_cost: args.estimatedCost ?? 0 });
        return { output: experimental_output as T, provider: provider.name, category, fallbackCount, latencyMs };
      } catch (err) {
        const callLatency = Date.now() - callStart;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[ai-router] ${provider.name} attempt ${attempt} failed: ${msg}`);
        if (attempt === 2) { recordOutcome(provider.name, callLatency, false); lastErr = err; fallbackCount++; }
      }
    }
  }

  const latencyMs = Date.now() - t0;
  const reason = lastErr instanceof Error ? lastErr.message : "All providers failed";
  void logRouterDecision({ category, provider_used: "none", fallback_count: fallbackCount, latency_ms: latencyMs, success: false, failure_reason: reason, estimated_cost: args.estimatedCost ?? 0 });
  throw new Error(reason);
}
