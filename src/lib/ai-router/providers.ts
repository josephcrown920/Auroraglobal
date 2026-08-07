// Aurora AI Intelligence Router — Extended Provider Registry
// Covers all models referenced in the per-category chains.
// Each provider is independently enabled/disabled based on available secrets.

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export type RouterProvider = {
  name: string;
  displayName: string;
  enabled: boolean;
  model: string;
  make: () => ReturnType<typeof createOpenAICompatible>;
};

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
      }),
  });

  // ── Gemini (Google) — Reliable General Assistant ──────────────────────────
  add({
    name: "gemini",
    displayName: "Gemini (Google)",
    enabled: !!process.env.GEMINI_API_KEY || !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    model: "gemini-2.5-flash",
    make: () => {
      const key = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY!;
      const base =
        process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ||
        "https://generativelanguage.googleapis.com/v1beta/openai";
      return createOpenAICompatible({
        name: "gemini",
        baseURL: base,
        headers: { Authorization: `Bearer ${key}` },
      });
    },
  });

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
    model: "qwen/qwen3-235b-a22b:free",
    make: () =>
      createOpenAICompatible({
        name: "openrouter-qwen",
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://aurora.app",
          "X-Title": "Aurora AI",
        },
      }),
  });

  // ── Qwen Coder (via OpenRouter) — Code-specialised ───────────────────────
  add({
    name: "qwen-coder",
    displayName: "Qwen Coder (OpenRouter)",
    enabled: !!process.env.OPENROUTER_API_KEY,
    model: "qwen/qwen2.5-coder-32b-instruct",
    make: () =>
      createOpenAICompatible({
        name: "openrouter-qwen-coder",
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://aurora.app",
          "X-Title": "Aurora AI",
        },
      }),
  });

  // ── DeepSeek (via OpenRouter) — Intelligent backup ───────────────────────
  add({
    name: "deepseek",
    displayName: "DeepSeek (OpenRouter)",
    enabled: !!process.env.OPENROUTER_API_KEY,
    model: "deepseek/deepseek-chat-v3-0324:free",
    make: () =>
      createOpenAICompatible({
        name: "openrouter-deepseek",
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://aurora.app",
          "X-Title": "Aurora AI",
        },
      }),
  });

  // ── DeepSeek Coder (via OpenRouter) — Code-specialised ───────────────────
  add({
    name: "deepseek-coder",
    displayName: "DeepSeek Coder (OpenRouter)",
    enabled: !!process.env.OPENROUTER_API_KEY,
    model: "deepseek/deepseek-r1-distill-qwen-32b",
    make: () =>
      createOpenAICompatible({
        name: "openrouter-deepseek-coder",
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://aurora.app",
          "X-Title": "Aurora AI",
        },
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
      model: "llama-3.3-70b-versatile",
      make: () =>
        createOpenAICompatible({
          name: "groq",
          baseURL: "https://api.groq.com/openai/v1",
          headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
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
