import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { buildProviderRegistry } from "./providers";
import { CATEGORY_CHAINS } from "./chains";

const ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "AI_INTEGRATIONS_GEMINI_API_KEY",
  "AI_INTEGRATIONS_GEMINI_BASE_URL",
  "AI_INTEGRATIONS_OPENAI_API_KEY",
  "AI_INTEGRATIONS_OPENAI_BASE_URL",
  "AI_INTEGRATIONS_OPENROUTER_API_KEY",
  "AI_INTEGRATIONS_OPENROUTER_BASE_URL",
  "OPENAI_API_KEY",
  "XAI_API_KEY",
  "OPENROUTER_API_KEY",
] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

describe("ai-router provider registry", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("every chain entry names a registered provider", () => {
    process.env.OPENROUTER_API_KEY = "x";
    const names = new Set(buildProviderRegistry().keys());
    for (const [category, chain] of Object.entries(CATEGORY_CHAINS)) {
      for (const name of chain) {
        expect(names.has(name), `${category} references unknown provider "${name}"`).toBe(true);
      }
    }
  });

  it("puts the Replit-billed OpenAI backstop in every chain", () => {
    for (const [category, chain] of Object.entries(CATEGORY_CHAINS)) {
      expect(chain.includes("openai"), `${category} has no always-on backstop`).toBe(true);
    }
  });

  it("makes OpenRouter Auto reachable from every chain without moving OpenAI", () => {
    for (const [category, chain] of Object.entries(CATEGORY_CHAINS)) {
      expect(chain[1], `${category} moved OpenAI from second priority`).toBe("openai");
      expect(chain.includes("openrouter-auto"), `${category} cannot reach OpenRouter Auto`).toBe(true);
      expect(chain.includes("llama"), `${category} still references llama`).toBe(false);
    }
  });

  it("enables the OpenAI backstop from the Replit proxy without a user key", () => {
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "proxy-key";
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "https://proxy.example/v1";
    const openai = buildProviderRegistry().get("openai");
    expect(openai?.enabled).toBe(true);
    expect(openai?.model).toBe("gpt-5.4-mini");
  });

  it("never pins retired OpenRouter :free variants or registers legacy llama", () => {
    process.env.OPENROUTER_API_KEY = "x";
    const registry = buildProviderRegistry();
    for (const p of registry.values()) {
      expect(p.model.endsWith(":free"), `${p.name} pins a retired :free slug`).toBe(false);
    }
    expect(registry.has("llama")).toBe(false);
    expect(registry.get("openrouter-auto")?.model).toBe("openrouter/auto");
  });

  it("enables Gemini from the Replit proxy alone", () => {
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY = "proxy-key";
    process.env.AI_INTEGRATIONS_GEMINI_BASE_URL = "https://proxy.example";
    const gemini = buildProviderRegistry().get("gemini");
    expect(gemini?.enabled).toBe(true);
    // Native Gemini gateway (the proxy has no OpenAI-compat /chat/completions).
    const model = gemini!.make()("gemini-2.5-flash") as { provider?: string };
    expect(String(model.provider)).toContain("google");
  });

  it("enables OpenRouter models from the Replit proxy without a direct key", () => {
    process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY = "proxy-key";
    process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL = "https://proxy.example/v1";
    const registry = buildProviderRegistry();
    expect(registry.get("qwen")?.enabled).toBe(true);
    expect(registry.get("deepseek")?.enabled).toBe(true);
    expect(registry.get("openrouter-auto")?.enabled).toBe(true);
    expect(registry.get("qwen")?.model).toBe("qwen/qwen3-235b-a22b");
  });

  it("does NOT enable Gemini from a proxy key without its base URL", () => {
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY = "proxy-key";
    expect(buildProviderRegistry().get("gemini")?.enabled).toBe(false);
    process.env.GEMINI_API_KEY = "direct";
    expect(buildProviderRegistry().get("gemini")?.enabled).toBe(true);
  });

  it("forwards strictJsonSchema:false to every OpenAI-compatible json_schema provider", () => {
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "proxy-key";
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "https://proxy.example/v1";
    process.env.XAI_API_KEY = "x";
    process.env.OPENROUTER_API_KEY = "x";
    const reg = buildProviderRegistry();
    // Strict json_schema rejects ChatTurnSchema (optional props, unions,
    // missing additionalProperties:false) on OpenAI-compatible gateways —
    // these must all opt out or the chain burns a hop on every rich-schema request.
    for (const name of ["openai", "grok", "qwen", "qwen-coder", "deepseek", "deepseek-coder", "openrouter-auto"]) {
      const p = reg.get(name)!;
      const opts = Object.values(p.providerOptions ?? {});
      expect(opts.length, `${name} has no providerOptions`).toBe(1);
      expect(opts[0]?.strictJsonSchema, `${name} does not disable strict json_schema`).toBe(false);
      const model = p.make()(p.model) as unknown as { supportsStructuredOutputs?: boolean };
      expect(model.supportsStructuredOutputs, `${name} does not request json_schema`).toBe(true);
    }
    // Anthropic's OpenAI-compat endpoint REQUIRES strict:true — never override it.
    expect(reg.get("claude")?.providerOptions).toBeUndefined();
  });

});
