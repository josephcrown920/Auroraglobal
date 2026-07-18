import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, Output } from "ai";
import type { z } from "zod";

type Provider = {
  name: string;
  enabled: boolean;
  make: () => ReturnType<typeof createOpenAICompatible>;
  model: string;
};

export type LlmProviderPreference = "auto" | "anthropic" | "xai" | "openrouter";

function providers(): Provider[] {
  return [
    {
      name: "lovable",
      enabled: !!process.env.LOVABLE_API_KEY,
      model: "google/gemini-3-flash-preview",
      make: () =>
        createOpenAICompatible({
          name: "lovable",
          baseURL: "https://ai.gateway.lovable.dev/v1",
          headers: {
            "Lovable-API-Key": process.env.LOVABLE_API_KEY!,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
        }),
    },
    {
      name: "gemini",
      enabled: !!process.env.GEMINI_API_KEY,
      model: "gemini-2.5-flash",
      make: () =>
        createOpenAICompatible({
          name: "gemini",
          baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
          headers: { Authorization: `Bearer ${process.env.GEMINI_API_KEY}` },
        }),
    },
    {
      name: "openai",
      enabled: !!process.env.OPENAI_API_KEY,
      model: "gpt-4o-mini",
      make: () =>
        createOpenAICompatible({
          name: "openai",
          baseURL: "https://api.openai.com/v1",
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        }),
    },
    {
      // Anthropic's OpenAI-compatibility endpoint: /v1/chat/completions with a
      // standard Bearer token (verified — returns authentication_error, not 404).
      name: "anthropic",
      enabled: !!process.env.ANTHROPIC_API_KEY,
      model: "claude-haiku-4-5",
      make: () =>
        createOpenAICompatible({
          name: "anthropic",
          baseURL: "https://api.anthropic.com/v1",
          headers: { Authorization: `Bearer ${process.env.ANTHROPIC_API_KEY}` },
        }),
    },
    {
      name: "xai",
      enabled: !!process.env.XAI_API_KEY,
      model: "grok-4",
      make: () =>
        createOpenAICompatible({
          name: "xai",
          baseURL: "https://api.x.ai/v1",
          headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}` },
        }),
    },
    {
      name: "openrouter",
      enabled: !!process.env.OPENROUTER_API_KEY,
      model: "google/gemini-2.5-flash",
      make: () =>
        createOpenAICompatible({
          name: "openrouter",
          baseURL: "https://openrouter.ai/api/v1",
          headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
        }),
    },
    {
      // Hugging Face's OpenAI-compatible router. Routes to whichever provider
      // (Together, Fireworks, HF-hosted, etc.) is currently serving the model.
      name: "huggingface",
      enabled: !!process.env.HF_TOKEN,
      model: "meta-llama/Llama-3.3-70B-Instruct",
      make: () =>
        createOpenAICompatible({
          name: "huggingface",
          baseURL: "https://router.huggingface.co/v1",
          headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` },
        }),
    },
  ];
}

export type FallbackResult<T> = { provider: string; output: T };

export async function generateWithFallback<T>(args: {
  system: string;
  prompt: string;
  // Input type is deliberately loose so schemas with .transform() infer T from
  // their OUTPUT type rather than their raw wire shape.
  schema: z.ZodType<T, z.ZodTypeDef, unknown>;
  preferredProvider?: LlmProviderPreference;
}): Promise<FallbackResult<T>> {
  const enabledProviders = providers().filter((p) => p.enabled);
  const preferred = args.preferredProvider && args.preferredProvider !== "auto"
    ? enabledProviders.filter((p) => p.name === args.preferredProvider)
    : [];
  const chain = preferred.length > 0
    ? [...preferred, ...enabledProviders.filter((p) => p.name !== args.preferredProvider)]
    : enabledProviders;
  if (chain.length === 0) throw new Error("No LLM provider keys configured");

  let lastErr: unknown;
  for (const p of chain) {
    try {
      const gateway = p.make();
      const model = gateway(p.model);
      const { experimental_output } = await generateText({
        model,
        system: args.system,
        prompt: args.prompt,
        experimental_output: Output.object({ schema: args.schema }),
      });
      return { provider: p.name, output: experimental_output as T };
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[llm-fallback] ${p.name} failed: ${msg}`);
      // 402 = out of credits, 429 = rate limit, 5xx = upstream — try next
      // Anything else also falls through to the next provider.
      continue;
    }
  }
  const finalMsg = lastErr instanceof Error ? lastErr.message : "All LLM providers failed";
  throw new Error(finalMsg);
}
