import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// ─── Module mocks (registered BEFORE orchestrator is imported) ─────────────────
// Task #206: Replit AI Integrations (billed to the owner's Replit credits) is now
// the FIRST choice for image/text/audio, ahead of the self-hosted GPU pool and the
// rest of the existing external chain. These tests drive the routing preference,
// the env-var-missing skip, the pinned-model bypass, and the failure fallthrough.
//
// IMPORTANT: we deliberately do NOT `mock.module("openai")` / `mock.module("@google/genai")`
// here. Bun's mock.module is process-global (see .agents/memory/bun-mock-module-leakage.md);
// sibling orchestrator test files import orchestrator.server.ts unconditionally, which
// statically imports those two packages for real, so whichever test file's import wins the
// race locks in the module for the whole process. Both SDKs resolve `fetch` from the global
// (OpenAI's client captures it at construction — which is why the Replit clients are built
// fresh per request rather than cached — and @google/genai's default fetcher calls the
// global `fetch` directly on every request), so intercepting `globalThis.fetch` works
// regardless of load order and matches how every other adapter in this file is tested.

function makeQuery(result: unknown) {
  const b: Record<string, unknown> = {};
  for (const m of [
    "select",
    "eq",
    "neq",
    "contains",
    "order",
    "limit",
    "insert",
    "update",
    "delete",
    "upsert",
    "single",
    "maybeSingle",
    "head",
    "gte",
    "lte",
  ]) {
    b[m] = () => b;
  }
  (b as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result);
  return b;
}

// No GPU workers online for any of these tests — routing decisions are driven
// purely by the Replit-first priority change under test.
const supabaseStub = {
  from: (table: string) => {
    if (table === "gpu_workers") return makeQuery({ data: [], error: null });
    return makeQuery({ data: [], error: null, count: 0 });
  },
  rpc: async () => ({ data: null, error: null }),
  storage: {
    from: () => ({
      createSignedUrl: async () => ({
        data: { signedUrl: "https://signed.example/ref" },
        error: null,
      }),
      upload: async () => ({ data: { path: "p" }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "https://pub.example/p" } }),
    }),
  },
};
mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: supabaseStub }));

const { orchestrate, markSuccess, isHealthy } = await import("./orchestrator.server");

// ─── fetch mocking ───────────────────────────────────────────────────────────

function fakeResponse(opts: {
  ok?: boolean;
  status?: number;
  json?: unknown;
  text?: string;
}): Response {
  const status = opts.status ?? (opts.ok === false ? 500 : 200);
  return {
    ok: opts.ok ?? (status >= 200 && status < 300),
    status,
    statusText: "",
    // The @google/genai SDK's HttpResponse wrapper reads `response.headers.entries()`
    // directly, so a plain object here throws — a real Headers instance is required.
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => opts.json,
    text: async () => opts.text ?? JSON.stringify(opts.json ?? {}),
    arrayBuffer: async () => new ArrayBuffer(4),
  } as unknown as Response;
}

function installFetch(handler: (call: { url: string; init?: RequestInit }) => Response) {
  const calls: { url: string }[] = [];
  const fn = mock((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url });
    return Promise.resolve(handler({ url, init }));
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return { calls };
}

const realFetch = globalThis.fetch;

const REPLIT_OPENAI_IMAGE_JSON = { data: [{ b64_json: "cmVwbGl0LW9wZW5haS1pbWFnZQ==" }] };
const REPLIT_OPENAI_TEXT_JSON = {
  choices: [{ message: { content: "hello from replit openai text" } }],
};
const REPLIT_OPENAI_AUDIO_JSON = {
  choices: [{ message: { audio: { data: "cmVwbGl0LWF1ZGlv" } } }],
};
const REPLIT_GEMINI_IMAGE_JSON = {
  candidates: [
    {
      content: {
        parts: [{ inlineData: { data: "cmVwbGl0LWdlbWluaS1pbWFnZQ==", mimeType: "image/png" } }],
      },
    },
  ],
};

const ENV_KEYS = [
  "AI_INTEGRATIONS_OPENAI_BASE_URL",
  "AI_INTEGRATIONS_OPENAI_API_KEY",
  "AI_INTEGRATIONS_GEMINI_BASE_URL",
  "AI_INTEGRATIONS_GEMINI_API_KEY",
  "GEMINI_API_KEY",
  "ELEVENLABS_API_KEY",
  "LOVABLE_API_KEY",
] as const;
const savedEnv: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) savedEnv[k] = process.env[k];

describe("orchestrate() — Replit AI Integrations first, GPU/external as fallback (Task #206)", () => {
  beforeEach(() => {
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "https://proxy.example/openai/v1";
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "openai-proxy-key";
    process.env.AI_INTEGRATIONS_GEMINI_BASE_URL = "https://proxy.example/gemini";
    process.env.AI_INTEGRATIONS_GEMINI_API_KEY = "gemini-proxy-key";
    delete process.env.GEMINI_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
    process.env.LOVABLE_API_KEY = "lk-present";
    for (const p of [
      "runpod",
      "lovable",
      "elevenlabs",
      "gemini-text",
      "replit-gemini-image",
      "replit-openai-image",
      "replit-openai-text",
      "replit-gemini-text",
      "replit-openai-audio",
    ]) {
      markSuccess(p);
    }
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("routes an unpinned image request to Replit's Gemini adapter first, never touching GPU/external", async () => {
    const { calls } = installFetch(({ url }) => {
      if (url.includes("proxy.example/gemini"))
        return fakeResponse({ json: REPLIT_GEMINI_IMAGE_JSON });
      throw new Error(`no other HTTP call expected, got: ${url}`);
    });

    const res = await orchestrate({ kind: "image", prompt: "a red fox" });

    expect(res.backend).toBe("external");
    expect(res.provider).toBe("replit-gemini-image");
    expect(res.endpoint).toBe("replit-gemini-image:gemini-2.5-flash-image");
    expect(calls.some((c) => c.url.includes("proxy.example/gemini"))).toBe(true);
    expect(calls.some((c) => c.url.includes("proxy.example/openai"))).toBe(false);
  });

  it("routes an unpinned text request to Replit's OpenAI adapter first", async () => {
    installFetch(({ url }) => {
      if (url.includes("proxy.example/openai"))
        return fakeResponse({ json: REPLIT_OPENAI_TEXT_JSON });
      throw new Error(`no other HTTP call expected, got: ${url}`);
    });

    const res = await orchestrate({ kind: "text", prompt: "say hi" });

    expect(res.backend).toBe("external");
    expect(res.provider).toBe("replit-openai-text");
    expect(res.text).toBe("hello from replit openai text");
  });

  it("routes an unpinned audio (TTS) request to Replit's OpenAI adapter first", async () => {
    installFetch(({ url }) => {
      if (url.includes("proxy.example/openai"))
        return fakeResponse({ json: REPLIT_OPENAI_AUDIO_JSON });
      throw new Error(`no other HTTP call expected, got: ${url}`);
    });

    const res = await orchestrate({ kind: "audio", prompt: "read this aloud" });

    expect(res.backend).toBe("external");
    expect(res.provider).toBe("replit-openai-audio");
  });

  it("pins to an explicit non-Replit image model and never touches the Replit proxy endpoints", async () => {
    process.env.GEMINI_API_KEY = "direct-gemini-key";
    const { calls } = installFetch(({ url }) => {
      if (url.includes("generativelanguage.googleapis.com"))
        return fakeResponse({
          json: {
            candidates: [
              { content: { parts: [{ inlineData: { data: "aW1n", mimeType: "image/png" } }] } },
            ],
          },
        });
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await orchestrate({
      kind: "image",
      prompt: "a red fox",
      model: "google/gemini-2.5-flash-image",
    });

    expect(res.provider).toBe("gemini");
    expect(calls.some((c) => c.url.includes("proxy.example"))).toBe(false);
  });

  it("pins to an explicit non-Replit text model and never touches the Replit proxy endpoints", async () => {
    process.env.GEMINI_API_KEY = "direct-gemini-key";
    const { calls } = installFetch(({ url }) => {
      if (url.includes("generativelanguage.googleapis.com"))
        return fakeResponse({
          json: { candidates: [{ content: { parts: [{ text: "direct gemini reply" }] } }] },
        });
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await orchestrate({
      kind: "text",
      prompt: "say hi",
      model: "gemini/gemini-2.0-flash",
    });

    expect(res.provider).toBe("gemini-text");
    expect(res.text).toBe("direct gemini reply");
    expect(calls.some((c) => c.url.includes("proxy.example"))).toBe(false);
  });

  it("pins to ElevenLabs for audio and never touches the Replit proxy endpoints", async () => {
    process.env.ELEVENLABS_API_KEY = "el-key";
    const { calls } = installFetch(({ url }) => {
      if (url.includes("api.elevenlabs.io"))
        return fakeResponse({ ok: true, status: 200, text: "" });
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await orchestrate({
      kind: "audio",
      prompt: "read this aloud",
      model: "elevenlabs/tts",
    });

    expect(res.provider).toBe("elevenlabs");
    expect(calls.some((c) => c.url.includes("proxy.example"))).toBe(false);
  });

  it("skips the Replit adapters cleanly (no crash) when the integration env vars are absent", async () => {
    delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    delete process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
    delete process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    const { calls } = installFetch(({ url }) => {
      if (url.includes("ai.gateway.lovable.dev"))
        return fakeResponse({
          json: {
            choices: [{ message: { images: [{ image_url: { url: "https://img/lovable.png" } }] } }],
          },
        });
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await orchestrate({ kind: "image", prompt: "a red fox" });

    expect(res.backend).toBe("external");
    expect(res.provider).toBe("lovable");
    expect(calls.some((c) => c.url.includes("proxy.example"))).toBe(false);
  });

  it("falls through to the next candidate and circuit-breaks when the Replit call fails", async () => {
    installFetch(({ url }) => {
      if (url.includes("proxy.example/gemini"))
        return fakeResponse({
          ok: false,
          status: 500,
          json: { error: { message: "upstream error", code: 500, status: "INTERNAL" } },
        });
      if (url.includes("proxy.example/openai"))
        return fakeResponse({ json: REPLIT_OPENAI_IMAGE_JSON });
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await orchestrate({ kind: "image", prompt: "a red fox" });

    expect(res.provider).toBe("replit-openai-image");
    expect(isHealthy("replit-gemini-image")).toBe(false);
  });
});

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});
