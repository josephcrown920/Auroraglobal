import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { z } from "zod";
import { generateWithFallback } from "./llm-fallback.server";

// ─── fetch helpers (same pattern as orchestrator.fallback.test.ts) ────────────

type Call = { url: string; init?: RequestInit };

function chatCompletion(content: unknown): Response {
  return new Response(
    JSON.stringify({
      id: "x",
      choices: [
        { index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(content) } },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function installFetch(handler: (call: { url: string; init?: RequestInit; index: number }) => Response) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    return handler({ url, init, index: calls.length - 1 });
  }) as unknown as typeof fetch;
  return { calls };
}

const realFetch = globalThis.fetch;

// Every provider key the fallback chain checks — cleared before each test so
// tests only enable the keys they explicitly set, and restored after the
// suite so this file never leaks fake credentials into other tests sharing
// the process.
const ENV_KEYS = [
  "LOVABLE_API_KEY",
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENROUTER_API_KEY",
  "HF_TOKEN",
] as const;
const savedEnv: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) savedEnv[k] = process.env[k];

const schema = z.object({ foo: z.string() });

describe("generateWithFallback — Anthropic coverage", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("includes the anthropic entry and serves the request when ANTHROPIC_API_KEY is set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const { calls } = installFetch(({ url }) => {
      if (url.includes("api.anthropic.com")) return chatCompletion({ foo: "bar" });
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await generateWithFallback({ system: "sys", prompt: "hi", schema });

    expect(res.provider).toBe("anthropic");
    expect(res.output).toEqual({ foo: "bar" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("api.anthropic.com");
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.model).toBe("claude-haiku-4-5");
  });

  it("falls through to anthropic when an earlier provider in the chain fails", async () => {
    // Provider order is lovable -> gemini -> openai -> anthropic -> openrouter
    // -> huggingface, so openai (which precedes anthropic) must be the one
    // that fails here for this to actually exercise the fallthrough.
    process.env.OPENAI_API_KEY = "oai-test";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    const { calls } = installFetch(({ url }) => {
      // 400 (non-retryable) — a 5xx would trigger the AI SDK's built-in retry
      // backoff and make this test hang/timeout instead of falling through.
      if (url.includes("api.openai.com")) return errorResponse(400, "bad request");
      if (url.includes("api.anthropic.com")) return chatCompletion({ foo: "baz" });
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await generateWithFallback({ system: "sys", prompt: "hi", schema });

    expect(res.provider).toBe("anthropic");
    expect(res.output).toEqual({ foo: "baz" });
    expect(calls.some((c) => c.url.includes("api.openai.com"))).toBe(true);
    expect(calls.some((c) => c.url.includes("api.anthropic.com"))).toBe(true);
  });

  it("skips anthropic entirely when ANTHROPIC_API_KEY is absent, even though a later provider could serve it", async () => {
    process.env.OPENROUTER_API_KEY = "or-test";
    process.env.HF_TOKEN = "hf-test";
    // ANTHROPIC_API_KEY deliberately left unset.
    const { calls } = installFetch(({ url }) => {
      // 400 (non-retryable) — a 5xx would trigger the AI SDK's built-in retry
      // backoff and make this test hang/timeout instead of falling through.
      if (url.includes("openrouter.ai")) return errorResponse(400, "bad request");
      if (url.includes("router.huggingface.co")) return chatCompletion({ foo: "qux" });
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await generateWithFallback({ system: "sys", prompt: "hi", schema });

    expect(res.provider).toBe("huggingface");
    expect(res.output).toEqual({ foo: "qux" });
    // Anthropic must never be reached — its key was never configured.
    expect(calls.some((c) => c.url.includes("api.anthropic.com"))).toBe(false);
  });

  it("surfaces the final provider's failure when anthropic is the last enabled entry and it also fails", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    installFetch(({ url }) => {
      if (url.includes("api.anthropic.com")) return errorResponse(401, "authentication_error");
      throw new Error(`unexpected fetch ${url}`);
    });

    await expect(generateWithFallback({ system: "sys", prompt: "hi", schema })).rejects.toThrow(
      /authentication_error/,
    );
  });

  it("throws immediately with no chain attempted when no provider key is configured at all", async () => {
    installFetch(() => {
      throw new Error("no fetch should be attempted");
    });

    await expect(generateWithFallback({ system: "sys", prompt: "hi", schema })).rejects.toThrow(
      /No LLM provider keys configured/,
    );
  });
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});
