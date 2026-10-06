// Aurora AI Intelligence Router — Main Entry Point
// classifyRequest → pick category chain → filter enabled+healthy providers →
// try each with retry-once → record health → log result → return output.
//
// Backward-compatible with generateWithFallback: same schema-driven output,
// same error-throw contract, adds category + provider metadata to the result.

import { asSchema, generateText, Output } from "ai";
import type { z } from "zod";
import { classifyRequest } from "./classifier";
import { CATEGORY_CHAINS } from "./chains";
import { getProviderRegistry, type RouterProvider } from "./providers";
import { countHealthyForCategory, isHealthy, recordOutcome } from "./health";
import { logRouterDecision } from "./logger";
import type { RequestCategory } from "./categories";
import { AGENT_BRAIN_CHAIN, FREE_OPENROUTER_MODEL } from "./agent-routing";

const PROVIDER_TIMEOUT_MS = 15_000;
const ROUTER_TIMEOUT_MS = 45_000;

function retryableProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(408|409|429|500|502|503|504)\b|timed?\s*out|timeout|ECONNRESET|fetch failed/i.test(message);
}

function safeProviderError(error: unknown): string {
  const seen = new Set<unknown>();
  const issues: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current && !seen.has(current); depth++) {
    seen.add(current);
    if (typeof current !== "object") break;
    const record = current as Record<string, unknown>;
    if (Array.isArray(record.issues)) {
      for (const issue of record.issues.slice(0, 8)) {
        if (!issue || typeof issue !== "object") continue;
        const item = issue as { path?: unknown; code?: unknown };
        const path = Array.isArray(item.path) ? item.path.join(".") : "root";
        const code = typeof item.code === "string" ? item.code : "invalid";
        issues.push(`${path || "root"}:${code}`);
      }
    }
    current = record.cause ?? record.error;
  }
  if (issues.length) return `schema_validation(${issues.join(",")})`;

  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const message = error instanceof Error ? error.message : String(error);
  const status =
    typeof record.statusCode === "number"
      ? record.statusCode
      : typeof record.status === "number"
        ? record.status
        : message.match(/\b(400|401|402|403|404|408|409|422|429|500|502|503|504)\b/)?.[1];
  const kind =
    /schema|object generated|validation|zod/i.test(message)
      ? "schema_validation"
      : /timed?\s*out|timeout|abort/i.test(message)
        ? "timeout"
        : /model.*(exist|valid)|not.*model/i.test(message)
          ? "model_id"
          : /401|403|auth|unauthor/i.test(message)
            ? "authentication"
            : /429|rate/i.test(message)
              ? "rate_limit"
              : "provider_error";
  return status ? `${kind}(http_${status})` : kind;
}

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
  /** Exact serving model id selected by the router (safe to disclose in UI). */
  model: string | null;
  /** Category the request was classified as. */
  category: RequestCategory;
  /** How many providers were tried before success. */
  fallbackCount: number;
  /** End-to-end latency in ms. */
  latencyMs: number;
  /** True when no healthy provider was available and the caller received its soft fallback. */
  degraded?: boolean;
};

export type RoutedGenerateDeps = {
  logDecision?: typeof logRouterDecision;
  generateText?: typeof generateText;
  providerRegistry?: Map<string, RouterProvider>;
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
  /**
   * Internal routing preference for a specialized workload. Names are provider
   * registry keys. Remaining category fallbacks are retained in their normal
   * order, so this changes preference without pinning a request.
   */
  preferredProviders?: string[];
  /** Strict agent brain: ModelArk first, OpenRouter free only as the backup. */
  routingMode?: "modelark-free";
  /** Internal bounded overrides for unusually large structured server outputs. */
  providerTimeoutMs?: number;
  routerTimeoutMs?: number;
  maxAttemptsPerProvider?: 1 | 2;
  maxOutputTokens?: number;
  /** Additional server validation that runs inside each fallback attempt. */
  validateOutput?: (output: T) => T;
};

/**
 * Category-aware LLM call with per-provider health tracking and decision logging.
 * Central entry point for structured LLM generation across Aurora.
 */
export async function routedGenerate<T>(
  args: RoutedGenerateArgs<T>,
  deps: RoutedGenerateDeps = {},
): Promise<RoutedResult<T>> {
  const logDecision = deps.logDecision ?? logRouterDecision;
  const runGenerateText = deps.generateText ?? generateText;
  const t0 = Date.now();
  if (args.routingMode !== undefined && args.routingMode !== "modelark-free") {
    throw new Error("Unsupported agent routing mode.");
  }
  const agentMode = args.routingMode === "modelark-free";
  const providerTimeoutMs = Math.max(
    1_000,
    Math.min(60_000, Math.trunc(args.providerTimeoutMs ?? (agentMode ? 40_000 : PROVIDER_TIMEOUT_MS))),
  );
  const routerTimeoutMs = Math.max(
    providerTimeoutMs,
    Math.min(120_000, Math.trunc(args.routerTimeoutMs ?? (agentMode ? 90_000 : ROUTER_TIMEOUT_MS))),
  );
  const maxAttemptsPerProvider = agentMode ? 1 : (args.maxAttemptsPerProvider ?? 2);
  const maxOutputTokens =
    args.maxOutputTokens === undefined
      ? (agentMode ? 4_000 : undefined)
      : Math.max(256, Math.min(12_000, Math.trunc(args.maxOutputTokens)));

  // 1. Classify (or use caller-provided category).
  const category: RequestCategory = args.category ?? classifyRequest(args.prompt);

  // 2. Build the ordered provider list for this category.
  const categoryChain = CATEGORY_CHAINS[category] ?? CATEGORY_CHAINS.GENERAL_CHAT;
  const chain = agentMode
    ? [...AGENT_BRAIN_CHAIN]
    : [...new Set([...(args.preferredProviders ?? []), ...categoryChain])];
  const registry = deps.providerRegistry ?? getProviderRegistry();

  // 3. Filter to enabled + healthy providers.
  const candidates = chain
    .map((name) => registry.get(name))
    .filter((p): p is NonNullable<typeof p> => !!p && p.enabled && isHealthy(p.name));

  if (candidates.length === 0) {
    const enabledCandidates = chain
      .map((name) => registry.get(name))
      .filter((p): p is NonNullable<typeof p> => !!p && p.enabled);
    if (enabledCandidates.length === 0) {
      if (agentMode) {
        throw new Error("Agent planning is not configured. ModelArk needs a key and MODELARK_TEXT_MODEL, or the free fallback needs OPENROUTER_API_KEY.");
      }
      throw new Error("No LLM provider keys configured for Aurora AI Router");
    }

    // Do not immediately hammer a chain that the health tracker has
    // circuit-broken. Chat callers can render a friendly retryable response;
    // other callers must explicitly provide a schema-shaped fallback.
    if (agentMode) {
      throw new Error("ModelArk and the free OpenRouter fallback are temporarily unavailable. Please try again shortly. No paid fallback was used.");
    }
    if (countHealthyForCategory(category, new Set(enabledCandidates.map((p) => p.name))) === 0) {
      if (args.degradedOutput === undefined) {
        throw new Error("Aurora AI is temporarily catching up. Please try again in a moment.");
      }
      const latencyMs = Date.now() - t0;
      void logDecision({
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
        model: null,
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
  // Both providers may accept non-strict json_schema yet answer with prose.
  // Make the transport contract explicit without weakening runtime validation.
  const system = agentMode
    ? `${args.system}\n\nREQUIRED API OUTPUT FORMAT: Return exactly one valid JSON object matching the following JSON Schema. Put conversational prose inside the appropriate string field, never outside the JSON. No markdown fences. A request for a short/plain-text answer describes that string field, not the API envelope.\n${JSON.stringify(await asSchema(args.schema).jsonSchema)}`
    : args.system;

  let lastErr: unknown;
  let fallbackCount = 0;

  for (const provider of candidates) {
    if (Date.now() - t0 >= routerTimeoutMs) break;
    // Retry-once: attempt the provider up to 2 times before moving to the next.
    for (let attempt = 1; attempt <= maxAttemptsPerProvider; attempt++) {
      const callStart = Date.now();
      try {
        if (agentMode && provider.name === "openrouter-free" && provider.model !== FREE_OPENROUTER_MODEL) {
          throw new Error("Paid OpenRouter model blocked.");
        }
        const gateway = provider.make();
        const model = gateway(provider.model);

        const { experimental_output, response } = await runGenerateText({
          model,
          system,
          messages,
          experimental_output: Output.object({ schema: args.schema }),
          // e.g. strictJsonSchema:false for OpenAI-compatible json_schema mode.
          providerOptions: provider.providerOptions,
           maxOutputTokens: maxOutputTokens ?? (provider.name === "openrouter-auto" ? 4096 : undefined),
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(
            Math.max(1, Math.min(providerTimeoutMs, routerTimeoutMs - (Date.now() - t0))),
          ),
        });

        const output = args.validateOutput
          ? args.validateOutput(experimental_output as T)
          : (experimental_output as T);
        const latencyMs = Date.now() - t0;
        const callLatency = Date.now() - callStart;
        recordOutcome(provider.name, callLatency, true);

        // Fire-and-forget log (never let it block the response).
        void logDecision({
          category,
          provider_used: provider.name,
          fallback_count: fallbackCount,
          latency_ms: latencyMs,
          success: true,
          failure_reason: null,
          estimated_cost: args.estimatedCost ?? 0,
        });

        return {
          output,
          provider: provider.name,
          // Auto Router is an alias, not the model that actually answered.
          // The OpenAI-compatible SDK exposes OpenRouter's response.model here.
          model:
            response?.modelId && response.modelId !== "openrouter/auto"
              ? response.modelId
              : provider.model === "openrouter/auto"
                ? null
                : provider.model,
          category,
          fallbackCount,
          latencyMs,
        };
      } catch (err) {
        const callLatency = Date.now() - callStart;
        console.warn(
          `[ai-router] ${provider.name} attempt ${attempt} failed: ${safeProviderError(err)}`,
        );

        const shouldRetry =
          attempt < maxAttemptsPerProvider &&
          retryableProviderError(err) &&
          Date.now() - t0 < routerTimeoutMs;
        if (!shouldRetry) {
          // Both attempts failed — record health hit and move to next provider.
          recordOutcome(provider.name, callLatency, false);
          lastErr = err;
          fallbackCount++;
          break;
        }
        // Only transient failures get one retry. Invalid/retired model slugs,
        // schema incompatibilities, auth and credit errors fall through now.
      }
    }
  }

  // All providers exhausted — log failure and throw.
  const latencyMs = Date.now() - t0;
  const reason = lastErr ? safeProviderError(lastErr) : "all_providers_failed";
  void logDecision({
    category,
    provider_used: "none",
    fallback_count: fallbackCount,
    latency_ms: latencyMs,
    success: false,
    failure_reason: reason,
    estimated_cost: args.estimatedCost ?? 0,
  });
  if (agentMode) {
    const explanation = /rate_limit|http_429/.test(reason)
      ? "The free fallback is rate-limited."
      : /timeout/.test(reason)
        ? "The request timed out."
        : /schema_validation/.test(reason)
          ? "The providers could not return a valid plan."
          : "The providers could not complete the request.";
    throw new Error(`ModelArk and the free OpenRouter fallback are unavailable. ${explanation} Please try again shortly. No paid fallback was used.`);
  }

  throw new Error(reason);
}
