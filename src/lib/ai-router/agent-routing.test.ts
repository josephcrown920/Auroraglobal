import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { z } from "zod";
import { routedGenerate } from "./index";
import { freeOpenRouterFetch, FREE_OPENROUTER_BASE, modelArkTextFetch } from "./agent-routing";
import { buildProviderRegistry, resetProviderRegistry } from "./providers";
import { resetHealthMap, recordOutcome } from "./health";

const keys = [
  "MODELARK_TEXT_MODEL", "BYTEPLUS_API_KEY", "ARK_API_KEY", "BYTEPLUS_BASE_URL",
  "ARK_BASE_URL", "OPENROUTER_API_KEY", "AI_INTEGRATIONS_OPENROUTER_API_KEY",
  "AI_INTEGRATIONS_OPENROUTER_BASE_URL",
] as const;
const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const noLogs = { logDecision: async () => {} };
const args = {
  system: "Return JSON with a reply.",
  prompt: "Hello",
  schema: z.object({ reply: z.string().min(1) }),
  routingMode: "modelark-free" as const,
};
let requests: Array<{ url: string; body: Record<string, unknown>; authorization: string | null }>;

function completion(model: string, content = '{"reply":"OK"}') {
  return Response.json({
    id: "test-completion",
    object: "chat.completion",
    created: 1,
    model,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: 0 },
  });
}

function intercept(reply: (request: typeof requests[number]) => Response | Promise<Response>) {
  globalThis.fetch = (async (input, init) => {
    const request = {
      url: String(input),
      body: JSON.parse(String(init?.body)),
      authorization: new Headers(init?.headers).get("authorization"),
    };
    requests.push(request);
    if (!request.url.endsWith("/chat/completions")) throw new Error("Unexpected network call");
    return reply(request);
  }) as typeof fetch;
}

beforeEach(() => {
  for (const key of keys) delete process.env[key];
  process.env.MODELARK_TEXT_MODEL = "test-modelark";
  process.env.BYTEPLUS_API_KEY = "test-byteplus";
  process.env.ARK_API_KEY = "test-ark";
  process.env.OPENROUTER_API_KEY = "test-openrouter";
  requests = [];
  resetProviderRegistry();
  resetHealthMap();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of keys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
  resetProviderRegistry();
  resetHealthMap();
});

describe("ModelArk then OpenRouter free agent routing", () => {
  it("uses ModelArk first, keeps conversation/schema, and reports the serving model", async () => {
    intercept(() => completion("served-modelark"));
    const result = await routedGenerate({
      ...args, conversationHistory: [{ role: "user", content: "Keep the red coat." }],
      preferredProviders: ["openai", "qwen"],
    }, noLogs);
    expect(result).toMatchObject({ output: { reply: "OK" }, provider: "modelark", model: "served-modelark", fallbackCount: 0 });
    expect(requests).toHaveLength(1);
    expect(requests[0].body.model).toBe("test-modelark");
    expect(JSON.stringify(requests[0].body.messages)).toContain("Keep the red coat.");
    expect(JSON.stringify(requests[0].body.messages)).toContain("REQUIRED API OUTPUT FORMAT");
    expect(JSON.stringify(requests[0].body.messages)).toContain("properties");
    expect(requests[0].body.response_format).toMatchObject({ type: "json_schema" });
  });

  it("reuses alternate Ark credential only after definitive 401", async () => {
    intercept((r) => r.authorization === "Bearer test-byteplus"
      ? Response.json({ error: { message: "Unauthorized" } }, { status: 401 })
      : completion("served-modelark"));
    const result = await routedGenerate(args, noLogs);
    expect(result.provider).toBe("modelark");
    expect(requests.map((r) => r.authorization)).toEqual(["Bearer test-byteplus", "Bearer test-ark"]);
  });

  for (const status of [400, 402, 403, 404, 429, 500, 503]) {
    it(`falls directly to the free pool on ModelArk HTTP ${status}, never other paid providers`, async () => {
      intercept((r) => r.url.startsWith(FREE_OPENROUTER_BASE)
        ? completion("pool/served-model:free")
        : Response.json({ error: { message: "Provider unavailable" } }, { status }));
      const result = await routedGenerate({ ...args, maxAttemptsPerProvider: 2 }, noLogs);
      expect(result).toMatchObject({ provider: "openrouter-free", model: "pool/served-model:free", fallbackCount: 1 });
      expect(requests).toHaveLength(2);
      expect(requests[1].body.model).toBe("openrouter/free");
      expect(requests[1].body.provider).toEqual({ allow_fallbacks: false, max_price: { prompt: 0, completion: 0, request: 0 } });
    });
  }

  it("falls back on malformed structured ModelArk output", async () => {
    intercept((r) => r.url.startsWith(FREE_OPENROUTER_BASE)
      ? completion("pool/free")
      : completion("modelark", '{"unexpected":true}'));
    expect((await routedGenerate(args, noLogs)).provider).toBe("openrouter-free");
    expect(requests).toHaveLength(2);
  });

  it("falls back after a ModelArk timeout without retrying paid work", async () => {
    intercept((r) => {
      if (!r.url.startsWith(FREE_OPENROUTER_BASE)) throw new DOMException("Timed out", "TimeoutError");
      return completion("pool/free");
    });
    expect((await routedGenerate(args, noLogs)).provider).toBe("openrouter-free");
    expect(requests).toHaveLength(2);
  });

  for (const status of [401, 429, 503]) {
    it(`fails clearly when the fallback returns ${status}; no retries or paid escape`, async () => {
      intercept(() => Response.json({ error: { message: "Unavailable" } }, { status }));
      await expect(routedGenerate({ ...args, preferredProviders: ["qwen", "openai"] }, noLogs))
        .rejects.toThrow("No paid fallback was used");
      expect(requests.filter((r) => r.url.startsWith(FREE_OPENROUTER_BASE))).toHaveLength(1);
      expect(requests.every((r) => ["test-modelark", "openrouter/free"].includes(String(r.body.model)))).toBe(true);
    });
  }

  it("uses free backup if ModelArk config is missing", async () => {
    delete process.env.MODELARK_TEXT_MODEL;
    intercept(() => completion("pool/free"));
    expect((await routedGenerate(args, noLogs)).provider).toBe("openrouter-free");
    expect(requests).toHaveLength(1);
    expect(requests[0].body.model).toBe("openrouter/free");
  });

  it("does not use a billed Replit OpenRouter proxy as the free backup", () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY = "test-proxy";
    process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL = "https://proxy.example/v1";
    expect(buildProviderRegistry().get("openrouter-free")?.enabled).toBe(false);
  });

  it("missing both providers fails before any network call, without crashing startup", async () => {
    delete process.env.MODELARK_TEXT_MODEL;
    delete process.env.OPENROUTER_API_KEY;
    intercept(() => completion("should-not-run"));
    expect(() => buildProviderRegistry()).not.toThrow();
    await expect(routedGenerate(args, noLogs)).rejects.toThrow("Agent planning is not configured");
    expect(requests).toHaveLength(0);
  });

  it("unhealthy constrained providers never produce a fake successful degraded plan", async () => {
    for (const provider of ["modelark", "openrouter-free"]) {
      for (let n = 0; n < 3; n++) recordOutcome(provider, 1, false);
    }
    intercept(() => completion("should-not-run"));
    await expect(routedGenerate({ ...args, degradedOutput: { reply: "pretend success" } }, noLogs))
      .rejects.toThrow("temporarily unavailable");
    expect(requests).toHaveLength(0);
  });
});

describe("free transport cost boundary", () => {
  for (const body of [
    { model: "openrouter/auto" },
    { model: "qwen/qwen3-coder" },
    { model: "openrouter/free", models: ["paid/model"] },
    { model: "openrouter/free", plugins: [{ id: "web" }] },
    { model: "openrouter/free", route: "fallback" },
  ]) {
    it(`rejects unsafe request ${JSON.stringify(body)}`, async () => {
      intercept(() => completion("should-not-run"));
      await expect(freeOpenRouterFetch(`${FREE_OPENROUTER_BASE}/chat/completions`, {
        method: "POST", body: JSON.stringify(body),
      })).rejects.toThrow();
      expect(requests).toHaveLength(0);
    });
  }

  it("overwrites provider price overrides and refuses alternate endpoints", async () => {
    intercept(() => completion("pool/free"));
    await freeOpenRouterFetch(`${FREE_OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      body: JSON.stringify({ model: "openrouter/free", provider: { max_price: { prompt: 10 }, allow_fallbacks: true } }),
    });
    expect(requests[0].body.provider).toEqual({ allow_fallbacks: false, max_price: { prompt: 0, completion: 0, request: 0 } });
    await expect(freeOpenRouterFetch("https://proxy.example/v1/chat/completions", {
      method: "POST", body: '{"model":"openrouter/free"}',
    })).rejects.toThrow("unexpected request");
    expect(requests).toHaveLength(1);
  });

  it("blocks a ModelArk model override at the transport boundary", async () => {
    intercept(() => completion("should-not-run"));
    await expect(modelArkTextFetch("https://ark.ap-southeast.bytepluses.com/api/v3/chat/completions", {
      method: "POST", body: '{"model":"some-other-paid-model"}',
    })).rejects.toThrow("does not match");
    expect(requests).toHaveLength(0);
  });
});