// Aurora AI Intelligence Router — Extended Provider Registry
// Covers all models referenced in the per-category chains.
// Each provider is independently enabled/disabled based on available secrets.

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/** A provider gateway: call it with a model id to get an AI SDK language model. */
export type RouterGateway = (modelId: string) => LanguageModel;

export type RouterProvider = {
  name: string;
  displayName: string;
  enabled: boolean;
  model: string;
  make: () => RouterGateway;
  /**
   * Per-call `providerOptions` the router must forward with every request to
   * this provider (keyed by the AI SDK provider name). Used to turn OFF strict
   * json_schema on OpenAI-compatible endpoints — see NON_STRICT_SCHEMA.
   */
  providerOptions?: Record<string, Record<string, boolean | string | number>>;
};

/**
 * Structured-output policy for OpenAI-compatible providers.
 *
 * `supportsStructuredOutputs: true` makes @ai-sdk/openai-compatible send
 * response_format = json_schema (the model SEES the schema) instead of the
 * bare json_object mode, where models writing Aurora's rich chat schema
 * (nested plan/shots unions, optional fields, transforms) fail zod validation
 * nearly every time ("No object generated: response did not match schema").
 *
 * The adapter defaults json_schema to `strict: true`, which OpenAI and Groq
 * REJECT for any schema whose objects have optional properties or lack
 * additionalProperties:false (ChatTurnSchema is both). So every provider that
 * opts into json_schema also forwards strictJsonSchema:false via
 * providerOptions. Anthropic is the exception: its OpenAI-compat endpoint
 * insists on strict:true (and rejects minItems > 1), so it keeps the default
 * and simply can't serve the richest schemas — the chain falls through.
 *
 * Verified live 2026-09-07 against ChatTurnSchema: openai / qwen / deepseek /
 * groq all fail in json_object mode and succeed with json_schema+non-strict.
 */
const NON_STRICT_SCHEMA = (providerName: string): RouterProvider["providerOptions"] => ({
  [providerName]: { strictJsonSchema: false },
});

// Every slug below was verified against the provider's live models API on
// 2026-09-07. Slugs die (Groq retired llama-3.3-70b-versatile, OpenRouter
// retired ALL of its :free Qwen/DeepSeek variants) — when the router reports
// "model does not exist" / "not a valid model ID", re-verify here first.

const OPENROUTER_HEADERS = () => ({
  Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
  "HTTP-Referer": "https://aurora.app",
  "X-Title": "Aurora AI",
});

/** Build the full provider registry. Called fresh each time so env changes are reflected. */
export function buildProviderRegistry(): Map<string, RouterProvider> {
  const registry = new Map<string, RouterProvider>();

  const add = (p: RouterProvider) => registry.set(p.name, p);

  // ── Claude (Anthropic) — Premium Creative Director ─────────────────────────
  add({
    name: "claude",
    displayName: "Claude (Anthropic)",
    enabled: !!process.env.ANTHROPIC_API_KEY,
    model: "claude-sonnet-4-5",
    make: () =>
      createOpenAICompatible({
        name: "anthropic",
        baseURL: "https://api.anthropic.com/v1",
        headers: { Authorization: `Bearer ${process.env.ANTHROPIC_API_KEY}` },
        // Anthropic's OpenAI-compat endpoint only accepts
        // response_format.type = "json_schema"; the adapter's default
        // json_object fallback is rejected with
        // "response_format.type: Input should be 'json_schema'".
        supportsStructuredOutputs: true,
      }),
  });

  // ── OpenAI (Replit AI Integrations proxy) — Always-on reliable fallback ───
  // Billed to Replit credits, no user key needed. Falls back to a direct
  // OpenAI key when the proxy isn't provisioned (e.g. a task-agent sandbox).
  {
    const proxied =
      !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY && !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    add({
      name: "openai",
      displayName: proxied ? "OpenAI (Replit)" : "OpenAI",
      enabled: proxied || !!process.env.OPENAI_API_KEY,
      model: proxied ? "gpt-5.4-mini" : "gpt-4o-mini",
      providerOptions: NON_STRICT_SCHEMA("openai"),
      make: () =>
        createOpenAICompatible({
          name: "openai",
          baseURL: proxied
            ? process.env.AI_INTEGRATIONS_OPENAI_BASE_URL!
            : "https://api.openai.com/v1",
          headers: {
            Authorization: `Bearer ${proxied ? process.env.AI_INTEGRATIONS_OPENAI_API_KEY : process.env.OPENAI_API_KEY}`,
          },
          supportsStructuredOutputs: true,
        }),
    });
  }

  // ── Gemini (Google) — Reliable General Assistant ──────────────────────────
  // The Replit Gemini proxy speaks the NATIVE Gemini API only
  // (`/models/<id>:generateContent`) — its OpenAI-compat path
  // `/chat/completions` returns "Endpoint … is not supported", so this
  // provider uses @ai-sdk/google for both the proxy and a direct key.
  {
    // Proxy mode needs BOTH the key and the base URL; a key alone must not
    // enable the provider (it would call Google with no usable credential and
    // burn a circuit-breaker strike on every request).
    const proxied =
      !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY && !!process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
    add({
      name: "gemini",
      displayName: "Gemini (Google)",
      enabled: proxied || !!process.env.GEMINI_API_KEY,
      model: "gemini-2.5-flash",
      make: () => {
        return createGoogleGenerativeAI({
          apiKey: proxied
            ? process.env.AI_INTEGRATIONS_GEMINI_API_KEY!
            : process.env.GEMINI_API_KEY!,
          // Proxy base already routes to the right API version — do NOT append /v1beta.
          baseURL: proxied ? process.env.AI_INTEGRATIONS_GEMINI_BASE_URL : undefined,
        });
      },
    });
  }

  // ── Grok (xAI) — Creative Collaborator ───────────────────────────────────
  add({
    name: "grok",
    displayName: "Grok (xAI)",
    enabled: !!process.env.XAI_API_KEY,
    model: "grok-3-mini",
    make: () =>
      createOpenAICompatible({
        name: "xai",
        baseURL: "https://api.x.ai/v1",
        headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` },
      }),
  });

  // ── Qwen (via OpenRouter) — Intelligent backup ────────────────────────────
  add({
    name: "qwen",
    displayName: "Qwen (OpenRouter)",
    enabled: !!process.env.OPENROUTER_API_KEY,
    model: "qwen/qwen3-235b-a22b-2507",
    providerOptions: NON_STRICT_SCHEMA("openrouter-qwen"),
    make: () =>
      createOpenAICompatible({
        name: "openrouter-qwen",
        baseURL: "https://openrouter.ai/api/v1",
        headers: OPENROUTER_HEADERS(),
        supportsStructuredOutputs: true,
      }),
  });

  // ── Qwen Coder (via OpenRouter) — Code-specialised ───────────────────────
  add({
    name: "qwen-coder",
    displayName: "Qwen Coder (OpenRouter)",
    enabled: !!process.env.OPENROUTER_API_KEY,
    model: "qwen/qwen3-coder-30b-a3b-instruct",
    providerOptions: NON_STRICT_SCHEMA("openrouter-qwen-coder"),
    make: () =>
      createOpenAICompatible({
        name: "openrouter-qwen-coder",
        baseURL: "https://openrouter.ai/api/v1",
        headers: OPENROUTER_HEADERS(),
        supportsStructuredOutputs: true,
      }),
  });

  // ── DeepSeek (via OpenRouter) — Intelligent backup ───────────────────────
  add({
    name: "deepseek",
    displayName: "DeepSeek (OpenRouter)",
    enabled: !!process.env.OPENROUTER_API_KEY,
    model: "deepseek/deepseek-v3.2",
    providerOptions: NON_STRICT_SCHEMA("openrouter-deepseek"),
    make: () =>
      createOpenAICompatible({
        name: "openrouter-deepseek",
        baseURL: "https://openrouter.ai/api/v1",
        headers: OPENROUTER_HEADERS(),
        supportsStructuredOutputs: true,
      }),
  });

  // ── DeepSeek Coder (via OpenRouter) — Code-specialised ───────────────────
  add({
    name: "deepseek-coder",
    displayName: "DeepSeek Coder (OpenRouter)",
    enabled: !!process.env.OPENROUTER_API_KEY,
    model: "deepseek/deepseek-v4-flash",
    providerOptions: NON_STRICT_SCHEMA("openrouter-deepseek-coder"),
    make: () =>
      createOpenAICompatible({
        name: "openrouter-deepseek-coder",
        baseURL: "https://openrouter.ai/api/v1",
        headers: OPENROUTER_HEADERS(),
        supportsStructuredOutputs: true,
      }),
  });

  // ── Llama via Groq — Emergency fallback (fast inference) ─────────────────
  // Groq's inference platform is dramatically faster than HuggingFace for Llama.
  // Falls back to HuggingFace when Groq key is absent.
  if (process.env.GROQ_API_KEY) {
    add({
      name: "llama",
      displayName: "Llama (Groq)",
      enabled: true,
      // llama-3.3-70b-versatile was retired from Groq (2026-09); gpt-oss-120b is
      // Groq's current fast frontier-class text model.
      model: "openai/gpt-oss-120b",
      providerOptions: NON_STRICT_SCHEMA("groq"),
      make: () =>
        createOpenAICompatible({
          name: "groq",
          baseURL: "https://api.groq.com/openai/v1",
          headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
          supportsStructuredOutputs: true,
        }),
    });
  } else {
    add({
      name: "llama",
      displayName: "Llama (HuggingFace)",
      enabled: !!process.env.HF_TOKEN,
      model: "meta-llama/Llama-3.3-70B-Instruct",
      make: () =>
        createOpenAICompatible({
          name: "huggingface",
          baseURL: "https://router.huggingface.co/v1",
          headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` },
        }),
    });
  }

  return registry;
}

/** Singleton-ish: rebuild once per module load (per request in serverless, per process in SSR). */
let _registry: Map<string, RouterProvider> | null = null;
export function getProviderRegistry(): Map<string, RouterProvider> {
  if (!_registry) _registry = buildProviderRegistry();
  return _registry;
}

/** Force a fresh registry build (e.g. after env changes in tests). */
export function resetProviderRegistry(): void {
  _registry = null;
}

/** Test-only registry seam. Keeps router tests deterministic without real provider credentials. */
export function setProviderRegistryForTest(registry: Map<string, RouterProvider>): void {
  _registry = registry;
}
