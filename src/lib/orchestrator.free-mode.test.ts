import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { GenerateRequest } from "./orchestrator.server";

// ─── "Free GPU only" mode ─────────────────────────────────────────────────────
// When the global free-only flag is ON, EVERY modality may run only on the
// self-hosted GPU pool plus genuinely free ($0) providers (Pollinations). No paid
// adapter (Replicate, Kling, HeyGen, Fal, Runway, Lovable, ElevenLabs, …) may be
// reached, so none can ever bill. When no free path exists for a kind (video /
// lip-sync / motion with no online worker) the request fails fast with the
// friendly "start your GPU" message — never a paid fallback. When the flag is OFF
// the existing GPU-first-then-paid-fallback behavior is preserved.
//
// The supabase stub serves `gpu_workers` and `app_settings` from mutable vars so
// each test injects the worker pool and the flag value independently.

let workersQueryResult: { data: unknown[]; error: null } = { data: [], error: null };
let freeModeQueryResult: { data: { value: unknown } | null; error: null } = {
  data: null,
  error: null,
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
  from: (table: string) => {
    if (table === "gpu_workers")
      // hasActiveWorkerForKind() reads `count` (head:true), the gpuWorker adapter
      // reads `data` — surface both off the same injected pool.
      return makeQuery({
        ...workersQueryResult,
        count: Array.isArray(workersQueryResult.data) ? workersQueryResult.data.length : 0,
      });
    if (table === "app_settings") return makeQuery(freeModeQueryResult);
    return makeQuery({ data: [], error: null, count: 0 });
  },
  // gpu_worker_inflight_inc must return a number: the dispatch loop treats a
  // NULL result as "worker already full" and skips the candidate entirely.
  rpc: async (fn: string) => ({
    data: fn === "gpu_worker_inflight_inc" ? 1 : null,
    error: null,
  }),
  storage: {
    from: () => ({
      createSignedUrl: async () => ({
        data: { signedUrl: "https://signed.example/ref" },
        error: null,
      }),
      upload: async () => ({ data: { path: "p" }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "https://pub.example/pollinations.jpg" } }),
    }),
  },
};

mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: supabaseStub }));

let replicateCallCount = 0;
mock.module("./replicate.server", () => ({
  getReplicateKey: () => process.env.REPLICATE_API_KEY,
  replicateRun: async () => {
    replicateCallCount++;
    return { output: "https://replicate.delivery/should-not-be-used.mp4" };
  },
  pickReplicateUrl: (output: unknown) =>
    typeof output === "string" ? output : ((output as { url?: string })?.url ?? ""),
  fetchToBytes: async () => ({ bytes: Buffer.from(""), mime: "application/octet-stream" }),
}));
let syncCallCount = 0;
mock.module("./sync.server", () => ({
  syncLipsync: async () => {
    syncCallCount++;
    return "https://sync.so/should-not-be-used.mp4";
  },
}));
mock.module("./hf.server", () => ({
  // Must cover every hf.server export that top-level imports of the
  // jobs/orchestrator graph touch — an incomplete stub leaks process-wide
  // (Bun mock.module) and breaks OTHER suites' imports at link time.
  hfTextToSpeech: async () => ({ bytes: new Uint8Array(), contentType: "audio/flac" }),
  hfTextToImage: async () => ({ bytes: Buffer.from(""), contentType: "image/png" }),
  HF_ROUTER_BASE: "https://router.huggingface.co/v1",
}));

const { orchestrate, markSuccess, assertFreeModeServable, FREE_MODE_NO_WORKER_MSG } =
  await import("./orchestrator.server");

// ─── fetch helpers ────────────────────────────────────────────────────────────

type FetchCall = { url: string; init: RequestInit | undefined };

function fakeResponse(opts: {
  ok?: boolean;
  status?: number;
  json?: unknown;
  text?: string;
  bytes?: ArrayBuffer;
  contentType?: string;
}): Response {
  const status = opts.status ?? (opts.ok === false ? 500 : 200);
  return {
    ok: opts.ok ?? (status >= 200 && status < 300),
    status,
    json: async () => opts.json,
    text: async () => opts.text ?? "",
    arrayBuffer: async () => opts.bytes ?? new ArrayBuffer(8),
    headers: {
      get: (h: string) =>
        h.toLowerCase() === "content-type" ? (opts.contentType ?? "image/jpeg") : null,
    },
  } as unknown as Response;
}

function installFetch(handler: (call: { url: string; init?: RequestInit }) => Response) {
  const calls: FetchCall[] = [];
  const fn = mock((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    return Promise.resolve(handler({ url, init }));
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return { calls };
}

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
// Every paid provider URL fragment. Any hit here in free mode is a hard failure.
const PAID_HOSTS = [
  "replicate.com",
  "api.klingai",
  "klingai.com",
  "heygen.com",
  "fal.run",
  "fal.ai",
  "runwayml.com",
  "ai.gateway.lovable.dev",
  "elevenlabs.io",
  "api.elevenlabs",
];

// Keep ALL paid provider keys set so that, if routing were wrong, a paid adapter
// COULD serve — proving the free-only filter (not a missing key) does the work.
const ENV_KEYS = [
  "LOVABLE_API_KEY",
  "FAL_KEY",
  "REPLICATE_API_KEY",
  "SYNC_API_KEY",
  "HEYGEN_API_KEY",
  "ELEVENLABS_API_KEY",
  "RUNWAY_API_KEY",
  "PIAPI_API_KEY",
  "FREE_GPU_ONLY",
] as const;
const savedEnv: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) savedEnv[k] = process.env[k];

const realFetch = globalThis.fetch;

function setAllPaidKeys() {
  process.env.LOVABLE_API_KEY = "lk-present";
  process.env.FAL_KEY = "fk-present";
  process.env.REPLICATE_API_KEY = "r8_present";
  process.env.SYNC_API_KEY = "sync-present";
  process.env.HEYGEN_API_KEY = "heygen-present";
  process.env.ELEVENLABS_API_KEY = "el-present";
  process.env.RUNWAY_API_KEY = "rw-present";
}

beforeEach(() => {
  setAllPaidKeys();
  // No env default for the flag — each test drives it via the app_settings row.
  delete process.env.FREE_GPU_ONLY;
  replicateCallCount = 0;
  syncCallCount = 0;
  workersQueryResult = { data: [], error: null };
  freeModeQueryResult = { data: null, error: null };
  for (const p of [
    "runpod",
    "lovable",
    "fal",
    "replicate",
    "pollinations",
    "gemini",
    "sync",
    "heygen",
    "runway",
    "elevenlabs",
    "kling",
  ]) {
    markSuccess(p);
  }
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const FREE_ON = { data: { value: true }, error: null } as const;

describe("orchestrate() — Free GPU only mode ON", () => {
  it("rejects image request when no GPU worker is online (no free hosted fallback)", async () => {
    freeModeQueryResult = { data: { value: true }, error: null };
    workersQueryResult = { data: [], error: null }; // no GPU worker online
    installFetch(({ url }) => {
      if (PAID_HOSTS.some((h) => url.includes(h)))
        throw new Error(`paid provider must not be called: ${url}`);
      throw new Error(`unexpected fetch ${url}`);
    });

    await expect(
      orchestrate({ kind: "image", prompt: "a red fox", model: "google/gemini-2.5-flash-image" }),
    ).rejects.toThrow();
  });

  it("routes a still to the self-hosted worker first when one is online, skipping paid", async () => {
    freeModeQueryResult = { ...FREE_ON };
    workersQueryResult = { data: [makeWorker(["image"])], error: null };
    const { calls } = installFetch(({ url }) => {
      if (url.includes(WORKER_HOST))
        return fakeResponse({ json: { url: "https://self-hosted.example.com/out/img.png" } });
      throw new Error(`nothing but the worker should be called: ${url}`);
    });

    const res = await orchestrate({
      kind: "image",
      prompt: "a red fox",
      model: "google/gemini-2.5-flash-image",
    });

    expect(res.backend).toBe("self-hosted");
    expect(res.provider).toBe("runpod");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://self-hosted.example.com/generate");
  });

  it("serves VIDEO on the self-hosted worker and never touches a paid video provider", async () => {
    freeModeQueryResult = { ...FREE_ON };
    workersQueryResult = { data: [makeWorker(["video"])], error: null };
    const { calls } = installFetch(({ url }) => {
      if (url.includes(WORKER_HOST))
        return fakeResponse({ json: { url: "https://self-hosted.example.com/out/clip.mp4" } });
      throw new Error(`paid video provider must not be called: ${url}`);
    });

    const res = await orchestrate({ kind: "video", prompt: "a dragon flying" });

    expect(res.backend).toBe("self-hosted");
    expect(replicateCallCount).toBe(0);
    expect(calls.every((c) => c.url.includes(WORKER_HOST))).toBe(true);
  });

  it("VIDEO with no online worker fails fast with the friendly message — no paid fallback", async () => {
    freeModeQueryResult = { ...FREE_ON };
    workersQueryResult = { data: [], error: null };
    const { calls } = installFetch(({ url }) => {
      throw new Error(`no provider should be called: ${url}`);
    });

    await expect(orchestrate({ kind: "video", prompt: "x" })).rejects.toThrow(
      FREE_MODE_NO_WORKER_MSG,
    );
    expect(calls).toHaveLength(0);
    expect(replicateCallCount).toBe(0);
  });

  it("LIP-SYNC with no online worker fails fast and never calls Sync/HeyGen/Replicate", async () => {
    freeModeQueryResult = { ...FREE_ON };
    workersQueryResult = { data: [], error: null };
    const { calls } = installFetch(({ url }) => {
      throw new Error(`no provider should be called: ${url}`);
    });

    await expect(
      orchestrate({
        kind: "lipsync",
        model: "sync/lipsync-2",
        videoUrl: "https://cdn.example.com/face.mp4",
        audioUrl: "https://cdn.example.com/voice.wav",
      }),
    ).rejects.toThrow(FREE_MODE_NO_WORKER_MSG);
    expect(calls).toHaveLength(0);
    expect(syncCallCount).toBe(0);
    expect(replicateCallCount).toBe(0);
  });

  it("AUDIO/TTS falls back to the friendly failure instead of paid ElevenLabs when no worker", async () => {
    freeModeQueryResult = { ...FREE_ON };
    workersQueryResult = { data: [], error: null };
    const { calls } = installFetch(({ url }) => {
      throw new Error(`ElevenLabs must not be called: ${url}`);
    });

    await expect(
      orchestrate({ kind: "audio", prompt: "say hi", model: "elevenlabs/tts" }),
    ).rejects.toThrow(FREE_MODE_NO_WORKER_MSG);
    expect(calls).toHaveLength(0);
  });
});

describe("orchestrate() — Free GPU only mode OFF (today's behavior preserved)", () => {
  it("falls back to a paid provider when no GPU worker is online", async () => {
    freeModeQueryResult = { data: { value: false }, error: null };
    workersQueryResult = { data: [], error: null };
    const { calls } = installFetch(({ url }) => {
      if (url.includes("ai.gateway.lovable.dev"))
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
    expect(calls.some((c) => c.url.includes("ai.gateway.lovable.dev"))).toBe(true);
  });
});

describe("assertFreeModeServable()", () => {
  it("no-ops entirely when free mode is OFF (even with no workers)", async () => {
    freeModeQueryResult = { data: { value: false }, error: null };
    workersQueryResult = { data: [], error: null };
    await expect(assertFreeModeServable("video")).resolves.toBeUndefined();
  });

  it("allows IMAGE in free mode without a GPU worker (Pollinations is a $0 hosted fallback)", async () => {
    freeModeQueryResult = { ...FREE_ON };
    workersQueryResult = { data: [], error: null };
    // Pollinations has estimateCost === 0 so assertFreeModeServable returns early — no worker needed.
    await expect(assertFreeModeServable("image")).resolves.toBeUndefined();
  });

  it("blocks VIDEO in free mode when no worker is online", async () => {
    freeModeQueryResult = { ...FREE_ON };
    workersQueryResult = { data: [], error: null };
    await expect(assertFreeModeServable("video")).rejects.toThrow(FREE_MODE_NO_WORKER_MSG);
  });

  it("allows VIDEO in free mode when a worker IS online", async () => {
    freeModeQueryResult = { ...FREE_ON };
    workersQueryResult = { data: [makeWorker(["video"])], error: null };
    await expect(assertFreeModeServable("video")).resolves.toBeUndefined();
  });
});

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});
