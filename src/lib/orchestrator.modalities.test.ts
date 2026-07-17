import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { GenerateRequest } from "./orchestrator.server";

// Coverage for the newer modalities + their routing: free/keyed text chain,
// ElevenLabs TTS (audio), Runware free-image, and Runway image-to-video polling,
// plus the pure candidate-model selection (getCandidateModels) and the unified
// MODEL_REGISTRY lookup (resolveModel). Mirrors orchestrator.fallback.test.ts:
// stub Supabase + provider SDKs, drive providers via mocked global fetch.

let getReplicateKeyImpl: () => string | undefined = () => undefined;
let replicateRunImpl: (
  slug: string,
  input: unknown,
  t?: number,
) => Promise<{ output: unknown }> = async () => {
  throw new Error("replicateRun not configured");
};
let syncLipsyncImpl: (opts: {
  videoUrl: string;
  audioUrl: string;
  model?: string;
}) => Promise<string> = async () => {
  throw new Error("syncLipsync not configured");
};

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
const supabaseStub = {
  from: () => makeQuery({ data: [], error: null, count: 0 }),
  rpc: async () => ({ data: null, error: null }),
  storage: {
    from: () => ({
      createSignedUrl: async () => ({
        data: { signedUrl: "https://signed.example/x" },
        error: null,
      }),
      upload: async () => ({ data: { path: "p" }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "https://pub.example/x" } }),
    }),
  },
};

mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: supabaseStub }));
mock.module("./replicate.server", () => ({
  getReplicateKey: () => getReplicateKeyImpl(),
  replicateRun: (slug: string, input: unknown, t?: number) => replicateRunImpl(slug, input, t),
  pickReplicateUrl: (output: unknown) =>
    typeof output === "string" ? output : ((output as { url?: string })?.url ?? ""),
  fetchToBytes: async () => ({ bytes: Buffer.from(""), mime: "application/octet-stream" }),
}));
mock.module("./sync.server", () => ({
  syncLipsync: (opts: { videoUrl: string; audioUrl: string; model?: string }) =>
    syncLipsyncImpl(opts),
}));
mock.module("./hf.server", () => ({
  hfTextToImage: async () => ({ bytes: Buffer.from(""), contentType: "image/png" }),
  HF_ROUTER_BASE: "https://router.huggingface.co/v1",
}));

const { orchestrate, getCandidateModels, resolveModel, markSuccess } =
  await import("./orchestrator.server");

// ─── fetch + clock helpers (same pattern as orchestrator.fallback.test.ts) ────

type FetchCall = { url: string; init: RequestInit | undefined };

function fakeResponse(opts: {
  ok?: boolean;
  status?: number;
  json?: unknown;
  text?: string;
  bytes?: ArrayBuffer;
  headers?: Record<string, string>;
}): Response {
  const status = opts.status ?? (opts.ok === false ? 500 : 200);
  return {
    ok: opts.ok ?? (status >= 200 && status < 300),
    status,
    json: async () => opts.json,
    text: async () => opts.text ?? "",
    arrayBuffer: async () => opts.bytes ?? new ArrayBuffer(0),
    headers: { get: (k: string) => opts.headers?.[k.toLowerCase()] ?? null },
  } as unknown as Response;
}

function installFetch(
  handler: (call: { url: string; init?: RequestInit; index: number }) => Response,
) {
  const calls: FetchCall[] = [];
  const fn = mock((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    return Promise.resolve(handler({ url, init, index: calls.length - 1 }));
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return { calls };
}

const realNow = Date.now;
const realSetTimeout = globalThis.setTimeout;
let fakeNow = 0;
function installFakeClock(start = 1_000_000) {
  fakeNow = start;
  Date.now = () => fakeNow;
  globalThis.setTimeout = ((cb: (...a: unknown[]) => void, ms?: number) => {
    fakeNow += ms ?? 0;
    return realSetTimeout(cb, 0);
  }) as unknown as typeof setTimeout;
}
function restoreClock() {
  Date.now = realNow;
  globalThis.setTimeout = realSetTimeout;
}

const ENV_KEYS = [
  "GROQ_API_KEY",
  "MISTRAL_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "HF_TOKEN",
  "LOVABLE_API_KEY",
  "ELEVENLABS_API_KEY",
  "RUNWARE_API_KEY",
  "RUNWAY_API_KEY",
  "FAL_KEY",
  "REPLICATE_API_KEY",
  // inference.sh cloud adapter — must be cleared so it doesn't bleed through
  // from the Replit secret into tests that expect specific provider counts.
  "INFERENCE_SH_API_KEY",
] as const;
const PROVIDER_NAMES = [
  "pollinations",
  "groq",
  "gemini-text",
  "mistral",
  "openai",
  "anthropic",
  "hf-text",
  "lovable-text",
  "elevenlabs",
  "runware",
  "runway",
  "runpod",
  "replicate",
  "fal",
  "kling",
  "lovable",
  "gemini",
  "inferencesh",
];
const savedEnv: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
const realFetch = globalThis.fetch;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

describe("getCandidateModels", () => {
  it("prepends the requested model and caps per kind", () => {
    expect(getCandidateModels({ kind: "video", prompt: "x", model: "kling-3.0" })).toEqual([
      "kling-3.0",
      "xai/grok-imagine-video-1.5",
      "ltx/ltx-video",
    ]);
  });

  it("dedupes when the requested model already appears in the fallback list", () => {
    const c = getCandidateModels({ kind: "image", prompt: "x", model: "pollinations/flux" });
    expect(c[0]).toBe("pollinations/flux");
    expect(c.filter((m) => m === "pollinations/flux")).toHaveLength(1);
    // Task #206: image gained 2 Replit-billed candidates ahead of the existing
    // chain (FALLBACK_CAP.image rose 4→6). inference.sh cloud Flux added one
    // more keyed fallback (cap→7 entries + 1 for any explicit model = cap 8).
    expect(c.length).toBeLessThanOrEqual(8);
  });

  it("pins self-hosted requests to the single requested model", () => {
    expect(
      getCandidateModels({ kind: "video", prompt: "x", model: "latentsync", selfHostedOnly: true }),
    ).toEqual(["latentsync"]);
  });

  it("returns an empty list for a self-hosted request with no model", () => {
    expect(getCandidateModels({ kind: "image", prompt: "x", selfHostedOnly: true })).toEqual([]);
  });

  it("never silently truncates the text fallback chain (cap >= list length)", () => {
    // Regression guard: adding a model to FALLBACK_MODELS.text without bumping
    // FALLBACK_CAP.text silently drops the tail provider from the chain.
    const candidates = getCandidateModels({ kind: "text", prompt: "x" });
    expect(candidates).toContain("pollinations/openai");
    expect(candidates).toContain("lovable/gemini-2.5-flash");
    expect(candidates).toContain("anthropic/claude-haiku-4-5");
  });
});

describe("resolveModel", () => {
  it("resolves known models to their provider/kind", () => {
    expect(resolveModel("runway/gen4-turbo")).toMatchObject({ provider: "runway", kind: "video" });
    expect(resolveModel("elevenlabs/tts")).toMatchObject({ provider: "elevenlabs", kind: "audio" });
    expect(resolveModel("pollinations/openai")).toMatchObject({
      provider: "pollinations",
      kind: "text",
    });
  });

  it("returns null for unknown or empty models", () => {
    expect(resolveModel("nope/x")).toBeNull();
    expect(resolveModel(null)).toBeNull();
  });
});

// ─── Modality routing through orchestrate() ───────────────────────────────────

describe("orchestrate modality routing", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
    for (const p of PROVIDER_NAMES) markSuccess(p);
    getReplicateKeyImpl = () => undefined;
    replicateRunImpl = async () => {
      throw new Error("replicateRun not configured");
    };
    syncLipsyncImpl = async () => {
      throw new Error("syncLipsync not configured");
    };
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    restoreClock();
  });

  it("walks the text chain: keyless Pollinations fails, keyed Groq serves", async () => {
    installFakeClock(); // keep withRetry backoff instant
    process.env.GROQ_API_KEY = "gk";
    const { calls } = installFetch(({ url }) => {
      if (url.includes("text.pollinations.ai"))
        return fakeResponse({ ok: false, status: 500, text: "down" });
      if (url.includes("api.groq.com"))
        return fakeResponse({ json: { choices: [{ message: { content: "hello from groq" } }] } });
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await orchestrate({ kind: "text", prompt: "hi" });
    expect(res.provider).toBe("groq");
    expect(res.text).toBe("hello from groq");
    expect(res.url).toBe("");
    expect(calls.some((c) => c.url.includes("text.pollinations.ai"))).toBe(true);
    expect(calls.some((c) => c.url.includes("api.groq.com"))).toBe(true);
  });

  it("routes an explicit Claude model to the Anthropic adapter when keyed", async () => {
    process.env.ANTHROPIC_API_KEY = "ak";
    const { calls } = installFetch(({ url }) => {
      if (url.includes("api.anthropic.com"))
        return fakeResponse({ json: { choices: [{ message: { content: "hello from claude" } }] } });
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await orchestrate({
      kind: "text",
      prompt: "hi",
      model: "anthropic/claude-sonnet-4-5",
    });
    expect(res.provider).toBe("anthropic");
    expect(res.text).toBe("hello from claude");
    expect(calls[0].url).toContain("api.anthropic.com/v1/chat/completions");
    const headers = (calls[0].init?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ak");
  });

  it("skips Anthropic cleanly in the fallback chain when the key is absent", async () => {
    installFakeClock();
    // No ANTHROPIC_API_KEY set — chain must fall through Claude to Lovable.
    process.env.LOVABLE_API_KEY = "lk";
    const { calls } = installFetch(({ url }) => {
      if (url.includes("text.pollinations.ai"))
        return fakeResponse({ ok: false, status: 500, text: "down" });
      if (url.includes("ai.gateway.lovable.dev"))
        return fakeResponse({ json: { choices: [{ message: { content: "from lovable" } }] } });
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await orchestrate({ kind: "text", prompt: "hi" });
    expect(res.provider).toBe("lovable-text");
    expect(calls.some((c) => c.url.includes("api.anthropic.com"))).toBe(false);
  });

  it("serves the audio modality via ElevenLabs when keyed", async () => {
    process.env.ELEVENLABS_API_KEY = "ek";
    const { calls } = installFetch(({ url }) => {
      if (url.includes("api.elevenlabs.io"))
        return fakeResponse({ bytes: new Uint8Array([1, 2, 3]).buffer });
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await orchestrate({ kind: "audio", prompt: "say hi", model: "elevenlabs/tts" });
    expect(res.provider).toBe("elevenlabs");
    expect(res.url).toBe("https://pub.example/x");
    expect(calls[0].url).toContain("api.elevenlabs.io");
  });

  it("serves image-to-video via Runway, polling until SUCCEEDED", async () => {
    installFakeClock();
    process.env.RUNWAY_API_KEY = "rwk";
    const { calls } = installFetch(({ url }) => {
      if (url.includes("image_to_video")) return fakeResponse({ json: { id: "task1" } });
      if (url.includes("/tasks/"))
        return fakeResponse({
          json: { status: "SUCCEEDED", output: ["https://runway.out/v.mp4"] },
        });
      throw new Error(`unexpected fetch ${url}`);
    });

    const req: GenerateRequest = {
      kind: "video",
      prompt: "move",
      model: "runway/gen4-turbo",
      imageUrls: ["https://img/start.png"],
    };
    const res = await orchestrate(req);
    expect(res.provider).toBe("runway");
    expect(res.url).toBe("https://runway.out/v.mp4");
    expect(calls.some((c) => c.url.includes("image_to_video"))).toBe(true);
    expect(calls.some((c) => c.url.includes("/tasks/"))).toBe(true);
  });

});

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});
