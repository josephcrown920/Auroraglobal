// Aurora AI Intelligence Router — Main Entry Point
// classifyRequest → pick category chain → filter enabled+healthy providers →
// try each with retry-once → record health → log result → return output.
//
// Backward-compatible with generateWithFallback: same schema-driven output,
// same error-throw contract, adds category + provider metadata to the result.

import { generateText, Output } from "ai";
import type { z } from "zod";
import { classifyRequest } from "./classifier";
import { CATEGORY_CHAINS } from "./chains";
import { getProviderRegistry } from "./providers";
import { countHealthyForCategory, isHealthy, recordOutcome } from "./health";
import { logRouterDecision } from "./logger";
import type { RequestCategory } from "./categories";

export type { RequestCategory } from "./categories";
export { classifyRequest } from "./classifier";
export { getHealthSnapshot } from "./health";
export { countHealthyForCategory } from "./health";
export { CATEGORY_CHAINS } from "./chains";

export type RoutedResult<T> = {
  /** Output matching the caller's schema. */
  output: T;
  /** Provider that delivered the result. */
  provider: string;
  /** Category the request was classified as. */
  category: RequestCategory;
  /** How many providers were tried before success. */
  fallbackCount: number;
  /** End-to-end latency in ms. */
  latencyMs: number;
  /** True when no healthy provider was available and the caller received its soft fallback. */
  degraded?: boolean;
};

export type RoutedGenerateArgs<T> = {
  system: string;
  prompt: string;
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  /** Pre-classified category — skips the classifier when already known. */
  category?: RequestCategory;
  /** Prior conversation turns. Passed as proper `messages` array to each provider. */
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  /** Estimated credit cost for logging purposes (does not affect routing). */
  estimatedCost?: number;
  /** Schema-shaped response to return when every enabled provider is circuit-broken. */
  degradedOutput?: T;
};

/**
 * Category-aware LLM call with per-provider health tracking and decision logging.
 * Replaces direct `generateWithFallback` calls in agent chat paths.
 */
export async function routedGenerate<T>(args: RoutedGenerateArgs<T>): Promise<RoutedResult<T>> {
  const t0 = Date.now();

  // 1. Classify (or use caller-provided category).
  const category: RequestCategory = args.category ?? classifyRequest(args.prompt);

  // 2. Build the ordered provider list for this category.
  const chain = CATEGORY_CHAINS[category] ?? CATEGORY_CHAINS.GENERAL_CHAT;
  const registry = getProviderRegistry();

  // 3. Filter to enabled + healthy providers.
  const candidates = chain
    .map((name) => registry.get(name))
    .filter((p): p is NonNullable<typeof p> => !!p && p.enabled && isHealthy(p.name));

  if (candidates.length === 0) {
    const enabledCandidates = chain
      .map((name) => registry.get(name))
      .filter((p): p is NonNullable<typeof p> => !!p && p.enabled);
    if (enabledCandidates.length === 0) {
      throw new Error("No LLM provider keys configured for Aurora AI Router");
    }

    // Do not immediately hammer a chain that the health tracker has
    // circuit-broken. Chat callers can render a friendly retryable response;
    // other callers must explicitly provide a schema-shaped fallback.
    if (countHealthyForCategory(category, new Set(enabledCandidates.map((p) => p.name))) === 0) {
      if (args.degradedOutput === undefined) {
        throw new Error("Aurora AI is temporarily catching up. Please try again in a moment.");
      }
      const latencyMs = Date.now() - t0;
      void logRouterDecision({
        category,
        provider_used: "none",
        fallback_count: 0,
        latency_ms: latencyMs,
        success: false,
        failure_reason: "All enabled providers are temporarily unhealthy",
        estimated_cost: args.estimatedCost ?? 0,
      });
      return {
        output: args.degradedOutput,
        provider: "none",
        category,
        fallbackCount: 0,
        latencyMs,
        degraded: true,
      };
    }
  }

  // 4. Build the messages array (multi-turn when history is present).
  const messages = [
    ...(args.conversationHistory ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: args.prompt },
  ];

  let lastErr: unknown;
  let fallbackCount = 0;

  for (const provider of candidates) {
    // Retry-once: attempt the provider up to 2 times before moving to the next.
    for (let attempt = 1; attempt <= 2; attempt++) {
      const callStart = Date.now();
      try {
        const gateway = provider.make();
        const model = gateway(provider.model);

        const { experimental_output } = await generateText({
          model,
          system: args.system,
          messages,
          experimental_output: Output.object({ schema: args.schema }),
        });

        const latencyMs = Date.now() - t0;
        const callLatency = Date.now() - callStart;
        recordOutcome(provider.name, callLatency, true);

        // Fire-and-forget log (never let it block the response).
        void logRouterDecision({
          category,
          provider_used: provider.name,
          fallback_count: fallbackCount,
          latency_ms: latencyMs,
          success: true,
          failure_reason: null,
          estimated_cost: args.estimatedCost ?? 0,
        });

        return {
          output: experimental_output as T,
          provider: provider.name,
          category,
          fallbackCount,
          latencyMs,
        };
      } catch (err) {
        const callLatency = Date.now() - callStart;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[ai-router] ${provider.name} attempt ${attempt} failed: ${msg}`);

        if (attempt === 2) {
          // Both attempts failed — record health hit and move to next provider.
          recordOutcome(provider.name, callLatency, false);
          lastErr = err;
          fallbackCount++;
        }
        // If attempt 1 failed, loop immediately to attempt 2 (retry-once).
      }
    }
  }

  // All providers exhausted — log failure and throw.
  const latencyMs = Date.now() - t0;
  const reason = lastErr instanceof Error ? lastErr.message : "All providers failed";
  void logRouterDecision({
    category,
    provider_used: "none",
    fallback_count: fallbackCount,
    latency_ms: latencyMs,
    success: false,
    failure_reason: reason,
    estimated_cost: args.estimatedCost ?? 0,
  });

  throw new Error(reason);
}
