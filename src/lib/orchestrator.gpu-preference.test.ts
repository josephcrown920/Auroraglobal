import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { GenerateRequest } from "./orchestrator.server";

// ─── Module mocks (registered BEFORE orchestrator is imported) ─────────────────
// Task #71: the self-hosted GPU worker pool is now PREFERRED first for stills,
// video and lip-sync, with paid external providers as automatic fallback. These
// tests drive a NON-selfHostedOnly request and assert the routing preference, the
// graceful fallback, and the `backend` label surfaced on the result.
//
// `workersQueryResult` is mutable so each test injects a live worker or an empty
// pool. The supabase stub ignores `.contains()`/`.eq()` filters, so whatever rows
// we hand it come back for the gpu_workers query (capability filtering is Supabase's
// job in production, not under test here).

let workersQueryResult: { data: unknown[]; error: null } = { data: [], error: null };

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
  from: (table: string) => {
    if (table === "gpu_workers") return makeQuery(workersQueryResult);
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

// Replicate/Sync wrappers must never run in these tests (no keys set), but stub
// them so an accidental call is observable rather than a module-load crash.
let replicateCallCount = 0;
mock.module("./replicate.server", () => ({
  getReplicateKey: () => process.env.REPLICATE_API_KEY,
  replicateRun: async () => {
    replicateCallCount++;
    return { output: "https://replicate.delivery/should-not-be-used.mp4" };
  },
  pickReplicateUrl: (output: unknown) =>
    typeof output === "string" ? output : ((output as { url?: string })?.url ?? ""),
}));
mock.module("./hf.server", () => ({
  hfTextToImage: async () => ({ bytes: Buffer.from(""), contentType: "image/png" }),
  HF_ROUTER_BASE: "https://router.huggingface.co/v1",
}));

const { orchestrate, markSuccess, isHealthy, getProviderHealthSnapshot } =
  await import("./orchestrator.server");

// ─── fetch helpers ────────────────────────────────────────────────────────────

type FetchCall = { url: string; init: RequestInit | undefined };

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
    json: async () => opts.json,
    text: async () => opts.text ?? "",
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

/** A healthy self-hosted worker the gpuWorker adapter will dispatch to. */
function makeWorker(
  capabilities: string[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "w-gpu-1",
    name: "colab-gpu",
    endpoint_url: "https://self-hosted.example.com",
    auth_token: "gpu-secret",
    protocol: "custom",
    capabilities,
    status: "active",
    in_flight: 0,
    max_concurrency: 2,
    priority: 0,
    last_heartbeat: new Date(Date.now() - 30_000).toISOString(),
    runpod_sync: false,
    ...overrides,
  };
}

const WORKER_HOST = "self-hosted.example.com";
const LOVABLE_URL = "ai.gateway.lovable.dev";

// Keep external creds set so that, if routing were wrong, an external provider
// COULD serve — proving the GPU-first preference is doing the work, not luck.
const ENV_KEYS = ["LOVABLE_API_KEY", "FAL_KEY", "REPLICATE_API_KEY"] as const;
const savedEnv: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) savedEnv[k] = process.env[k];

const realFetch = globalThis.fetch;

describe("orchestrate() — prefers self-hosted GPU first, external as fallback (Task #71)", () => {
  beforeEach(() => {
    process.env.LOVABLE_API_KEY = "lk-present";
    process.env.FAL_KEY = "fk-present";
    delete process.env.REPLICATE_API_KEY;
    replicateCallCount = 0;
    workersQueryResult = { data: [], error: null };
    for (const p of ["runpod", "lovable", "fal", "replicate", "pollinations", "gemini"]) {
      markSuccess(p);
    }
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("routes a still to the GPU worker first and labels it backend=self-hosted, skipping external", async () => {
    workersQueryResult = { data: [makeWorker(["image"])], error: null };
    const { calls } = installFetch(({ url }) => {
      if (url.includes(WORKER_HOST))
        return fakeResponse({ json: { url: "https://self-hosted.example.com/out/img.png" } });
      // Reaching an external provider means the GPU was NOT preferred — fail loudly.
      throw new Error(`external provider should not be reached: ${url}`);
    });

    const res = await orchestrate({
      kind: "image",
      prompt: "a red fox",
      model: "google/gemini-2.5-flash-image",
    });

    expect(res.backend).toBe("self-hosted");
    expect(res.provider).toBe("runpod");
    expect(res.endpoint).toBe("gpu:colab-gpu");
    expect(res.url).toBe("https://self-hosted.example.com/out/img.png");
    // The only network call was the worker's /generate endpoint.
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://self-hosted.example.com/generate");
    expect(calls.some((c) => c.url.includes(LOVABLE_URL))).toBe(false);
  });

  it("routes video to the GPU worker first when one is online", async () => {
    workersQueryResult = { data: [makeWorker(["video"])], error: null };
    const { calls } = installFetch(({ url }) => {
      if (url.includes(WORKER_HOST))
        return fakeResponse({ json: { url: "https://self-hosted.example.com/out/clip.mp4" } });
      throw new Error(`external provider should not be reached: ${url}`);
    });

    const res = await orchestrate({ kind: "video", prompt: "a dragon flying" });

    expect(res.backend).toBe("self-hosted");
    expect(res.provider).toBe("runpod");
    expect(res.url).toBe("https://self-hosted.example.com/out/clip.mp4");
    expect(replicateCallCount).toBe(0);
    expect(calls.every((c) => c.url.includes(WORKER_HOST))).toBe(true);
  });

  it("routes lip-sync to the GPU worker first when one is online", async () => {
    workersQueryResult = { data: [makeWorker(["lipsync"])], error: null };
    const { calls } = installFetch(({ url }) => {
      if (url.includes(WORKER_HOST))
        return fakeResponse({ json: { url: "https://self-hosted.example.com/out/lip.mp4" } });
      throw new Error(`external provider should not be reached: ${url}`);
    });

    const res = await orchestrate({
      kind: "lipsync",
      model: "latentsync",
      videoUrl: "https://cdn.example.com/face.mp4",
      audioUrl: "https://cdn.example.com/voice.wav",
    });

    expect(res.backend).toBe("self-hosted");
    expect(res.provider).toBe("runpod");
    expect(res.endpoint).toBe("gpu:colab-gpu");
    expect(res.url).toBe("https://self-hosted.example.com/out/lip.mp4");
    expect(calls.every((c) => c.url.includes(WORKER_HOST))).toBe(true);
  });

  it("falls back to an external provider (backend=external) when no GPU worker is online", async () => {
    workersQueryResult = { data: [], error: null }; // pool offline
    const { calls } = installFetch(({ url }) => {
      if (url.includes(WORKER_HOST)) throw new Error(`worker should not be reached: ${url}`);
      if (url.includes(LOVABLE_URL))
        return fakeResponse({
          json: {
            choices: [{ message: { images: [{ image_url: { url: "https://img/lovable.png" } }] } }],
          },
        });
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await orchestrate({
      kind: "image",
      prompt: "a red fox",
      model: "google/gemini-2.5-flash-image",
    });

    expect(res.backend).toBe("external");
    expect(res.provider).toBe("lovable");
    expect(res.url).toBe("https://img/lovable.png");
    // No call ever reached the (offline) worker host.
    expect(calls.some((c) => c.url.includes(WORKER_HOST))).toBe(false);
  });

  it("does NOT cool down the GPU pool when it is merely unavailable (clean fallback)", async () => {
    workersQueryResult = { data: [], error: null }; // no eligible worker
    installFetch(({ url }) => {
      if (url.includes(LOVABLE_URL))
        return fakeResponse({
          json: {
            choices: [{ message: { images: [{ image_url: { url: "https://img/lovable.png" } }] } }],
          },
        });
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await orchestrate({
      kind: "image",
      prompt: "x",
      model: "google/gemini-2.5-flash-image",
    });

    expect(res.backend).toBe("external");
    // "No GPU workers available" is a skip, not a failure: the pool stays healthy
    // and its failure counter never moves (no phantom dashboard error rows).
    expect(isHealthy("runpod")).toBe(true);
    expect(getProviderHealthSnapshot()["runpod"]?.failures ?? 0).toBe(0);
  });

  it("falls back AND circuit-breaks the GPU pool when a real dispatch error occurs", async () => {
    workersQueryResult = { data: [makeWorker(["image"])], error: null };
    const { calls } = installFetch(({ url }) => {
      // Worker is online but its /generate hard-fails with a 500.
      if (url.includes(WORKER_HOST)) return fakeResponse({ ok: false, status: 500, text: "boom" });
      if (url.includes(LOVABLE_URL))
        return fakeResponse({
          json: {
            choices: [{ message: { images: [{ image_url: { url: "https://img/lovable.png" } }] } }],
          },
        });
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await orchestrate({
      kind: "image",
      prompt: "x",
      model: "google/gemini-2.5-flash-image",
    });

    // The request still succeeds via the external fallback…
    expect(res.backend).toBe("external");
    expect(res.provider).toBe("lovable");
    // …the worker was attempted first…
    expect(calls.some((c) => c.url.includes(WORKER_HOST))).toBe(true);
    expect(calls.some((c) => c.url.includes(LOVABLE_URL))).toBe(true);
    // …and a genuine 5xx dispatch error DID trip the pool's circuit breaker.
    expect(isHealthy("runpod")).toBe(false);
  });
});

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});
