import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { z } from "zod";
import { routedGenerate } from "./index";
import { recordOutcome, resetHealthMap } from "./health";
import { resetProviderRegistry } from "./providers";

const ROUTER_ENV_KEYS = [
  "ANTHROPIC_API_KEY",
  "AI_INTEGRATIONS_ANTHROPIC_API_KEY",
  "AI_INTEGRATIONS_ANTHROPIC_BASE_URL",
  "GEMINI_API_KEY",
  "AI_INTEGRATIONS_GEMINI_API_KEY",
  "AI_INTEGRATIONS_GEMINI_BASE_URL",
  "AI_INTEGRATIONS_OPENAI_API_KEY",
  "AI_INTEGRATIONS_OPENAI_BASE_URL",
  "OPENAI_API_KEY",
  "XAI_API_KEY",
  "OPENROUTER_API_KEY",
  "AI_INTEGRATIONS_OPENROUTER_API_KEY",
  "AI_INTEGRATIONS_OPENROUTER_BASE_URL",
  "GROQ_API_KEY",
  "HF_TOKEN",
] as const;
const savedEnv = Object.fromEntries(ROUTER_ENV_KEYS.map((key) => [key, process.env[key]]));

describe("routedGenerate degraded routing", () => {
  beforeEach(() => {
    for (const key of ROUTER_ENV_KEYS) delete process.env[key];
    process.env.GEMINI_API_KEY = "test-gemini-key";
    resetProviderRegistry();
    resetHealthMap();
  });

  afterEach(() => {
    for (const key of ROUTER_ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    resetProviderRegistry();
    resetHealthMap();
  });

  it("returns a schema-shaped degraded response when every enabled provider is exhausted", async () => {
    recordOutcome("gemini", 10, false);
    recordOutcome("gemini", 10, false);
    recordOutcome("gemini", 10, false);

    const result = await routedGenerate({
      system: "system",
      prompt: "How much does Aurora cost?",
      schema: z.object({ reply: z.string() }),
      category: "PRICING",
      degradedOutput: { reply: "Please try again shortly." },
    });

    expect(result).toMatchObject({
      provider: "none",
      category: "PRICING",
      degraded: true,
      output: { reply: "Please try again shortly." },
    });
  });
});