import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, Output } from "ai";
import type { z } from "zod";

type Provider = {
  name: string;
  enabled: boolean;
  make: () => ReturnType<typeof createOpenAICompatible>;
  model: string;
};

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
  schema: z.ZodType<T>;
}): Promise<FallbackResult<T>> {
  const chain = providers().filter((p) => p.enabled);
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
