import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { buildProviderRegistry } from "./providers";

const savedKey = process.env.OPENROUTER_API_KEY;
const savedProxyKey = process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
const savedProxyUrl = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL;
const realFetch = globalThis.fetch;

describe("OpenRouter Auto provider wire protocol", () => {
  beforeEach(() => {
    delete process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
    delete process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL;
    process.env.OPENROUTER_API_KEY = "wire-test-key";
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    if (savedKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = savedKey;
    if (savedProxyKey === undefined) delete process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
    else process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY = savedProxyKey;
    if (savedProxyUrl === undefined) delete process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL;
    else process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL = savedProxyUrl;
  });

  it("sends low-tier, schema-aware routing controls and caps output on the wire", async () => {
    let requestUrl = "";
    let requestHeaders: Headers | undefined;
    let wireBody: Record<string, unknown> | undefined;
    globalThis.fetch = async (input, init) => {
      requestUrl = String(input);
      requestHeaders = new Headers(init?.headers);
      wireBody = JSON.parse(String(init?.body));
      return Response.json({
        id: "generation-1",
        created: 1_700_000_000,
        model: "google/gemini-2.5-flash",
        choices: [
          {
            message: { role: "assistant", content: '{"reply":"ok"}' },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
      });
    };

    const provider = buildProviderRegistry().get("openrouter-auto")!;
    const model = provider.make()(provider.model) as LanguageModelV3;
    const result = await model.doGenerate({
      prompt: [{ role: "user", content: [{ type: "text", text: "hello" }] }],
      // The router applies this provider's bounded output default before the
      // adapter builds the wire request.
      maxOutputTokens: 4096,
      responseFormat: {
        type: "json",
        schema: {
          type: "object",
          properties: { reply: { type: "string" } },
          required: ["reply"],
        },
      },
      providerOptions: provider.providerOptions,
    });

    expect(requestUrl).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(requestHeaders?.get("authorization")).toBe("Bearer wire-test-key");
    expect(wireBody).toMatchObject({
      model: "openrouter/auto",
      max_tokens: 4096,
      plugins: [{ id: "auto-router", cost_tier: "low" }],
      provider: { require_parameters: true },
      response_format: {
        type: "json_schema",
        json_schema: { strict: false },
      },
    });
    // The compatible adapter exposes OpenRouter's selected concrete model.
    expect(result.response?.modelId).toBe("google/gemini-2.5-flash");
  });

});