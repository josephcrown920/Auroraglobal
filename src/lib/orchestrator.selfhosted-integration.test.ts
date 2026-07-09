import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { GenerateRequest } from "./orchestrator.server";

// ─── Module mocks (registered BEFORE orchestrator is imported) ─────────────────
// These mirror the pattern from orchestrator.fallback.test.ts.  The key difference
// is that `workersQueryResult` is mutable so individual tests can inject a live
// worker or an empty pool.

let workersQueryResult: { data: unknown[]; error: null } = { data: [], error: null };

// These must never be called for a selfHostedOnly request; we track any
// invocation so tests can assert the provider was bypassed.
let syncCallCount = 0;
let replicateCallCount = 0;
let heygenFetchCallCount = 0;

// A chainable, awaitable Supabase query builder.  Every builder method returns
// the same builder; awaiting it resolves to the provided `result`.
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
    // worker_jobs inserts, gen_logs inserts, and any other table → no-op
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
      getPublicUrl: () => ({ data: { publicUrl: "https://pub.example/p" } }),
    }),
  },
};

mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: supabaseStub }));

mock.module("./replicate.server", () => ({
  getReplicateKey: () => process.env.REPLICATE_API_KEY,
  replicateRun: async () => {
    replicateCallCount++;
    return { output: "https://replicate.delivery/hosted-result.mp4" };
  },
  pickReplicateUrl: (output: unknown) =>
    typeof output === "string" ? output : ((output as { url?: string })?.url ?? ""),
}));

mock.module("./sync.server", () => ({
  syncLipsync: async () => {
    syncCallCount++;
    return "https://sync.so/hosted-result.mp4";
  },
}));

mock.module("./hf.server", () => ({
  hfTextToImage: async () => ({ bytes: Buffer.from(""), contentType: "image/png" }),
  HF_ROUTER_BASE: "https://router.huggingface.co/v1",
}));

// Import AFTER mocks are registered
const { orchestrate, markSuccess } = await import("./orchestrator.server");

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/** Build a self-hosted lipsync worker row that the gpuWorker adapter will accept. */
function makeLipsyncWorker(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "w-latentsync-1",
    name: "latentsync-worker",
    endpoint_url: "https://self-hosted.example.com",
    auth_token: "gpu-secret",
    protocol: "custom",
    capabilities: ["lipsync"],
    status: "active",
    in_flight: 0,
    max_concurrency: 2,
    priority: 0,
    // Fresh heartbeat — well within the 5-minute staleness window.
    last_heartbeat: new Date(Date.now() - 30_000).toISOString(),
    runpod_sync: false,
    ...overrides,
  };
}

// Provider env keys that should be present to prove they are bypassed.
const HOSTED_KEYS = [
  "SYNC_API_KEY",
  "REPLICATE_API_KEY",
  "LOVABLE_CONNECTOR_REPLICATE_API_KEY",
  "HEYGEN_API_KEY",
  "FAL_KEY",
] as const;
const savedEnv: Record<string, string | undefined> = {};
for (const k of HOSTED_KEYS) savedEnv[k] = process.env[k];

const realFetch = globalThis.fetch;

// Hosted lipsync provider URL patterns (Sync.so, Replicate, HeyGen, Fal)
const HOSTED_PATTERNS = ["sync.so", "replicate.com", "heygen.com", "fal.run", "fal.ai"];

// ─── orchestrate(): selfHostedOnly lipsync routing ───────────────────────────

describe("orchestrate() — selfHostedOnly lipsync", () => {
  beforeEach(() => {
    // Put every hosted provider key in the environment so that if a hosted
    // adapter was mistakenly chosen, it would have the credentials to run.
    process.env.SYNC_API_KEY = "sync-key-present";
    process.env.REPLICATE_API_KEY = "r8_replicate-key-present";
    process.env.LOVABLE_CONNECTOR_REPLICATE_API_KEY = "r8_replicate-key-present";
    process.env.HEYGEN_API_KEY = "heygen-key-present";
    process.env.FAL_KEY = "fal-key-present";

    // Reset call counters
    syncCallCount = 0;
    replicateCallCount = 0;
    heygenFetchCallCount = 0;

    // Reset pool
    workersQueryResult = { data: [], error: null };

    // Reset all providers to healthy
    for (const p of ["sync", "replicate", "heygen", "runpod", "fal", "lovable", "huggingface"]) {
      markSuccess(p);
    }
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  // ── Test 1: success path ────────────────────────────────────────────────────
  it("routes exclusively to the GPU worker and returns its URL, ignoring every hosted provider", async () => {
    workersQueryResult = { data: [makeLipsyncWorker()], error: null };

    const { calls } = installFetch(({ url }) => {
      // The GPU worker's /generate endpoint — respond with a result URL.
      if (url.includes("self-hosted.example.com")) {
        return fakeResponse({ json: { url: "https://self-hosted.example.com/out/result.mp4" } });
      }
      // Any other URL reaching here means a hosted provider was called — fail loudly.
      throw new Error(`Unexpected fetch to hosted provider: ${url}`);
    });

    const req: GenerateRequest = {
      kind: "lipsync",
      model: "latentsync",
      videoUrl: "https://cdn.example.com/face.mp4",
      audioUrl: "https://cdn.example.com/voice.wav",
      selfHostedOnly: true,
    };

    const result = await orchestrate(req);

    // Result comes from the GPU worker, not any hosted provider.
    expect(result.provider).toBe("runpod"); // gpuWorker adapter name
    expect(result.endpoint).toBe("gpu:latentsync-worker");
    expect(result.url).toBe("https://self-hosted.example.com/out/result.mp4");

    // The only fetch call must be to the self-hosted worker endpoint.
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://self-hosted.example.com/generate");

    // No hosted lipsync URL was ever contacted.
    const hitHosted = calls.some((c) => HOSTED_PATTERNS.some((p) => c.url.includes(p)));
    expect(hitHosted).toBe(false);

    // Provider SDK wrappers were never invoked.
    expect(syncCallCount).toBe(0);
    expect(replicateCallCount).toBe(0);
  });

  // ── Test 2: hosted providers completely bypassed (adapter filter check) ─────
  it("skips Sync.so, Replicate, HeyGen, and Fal adapters even when all their API keys are set", async () => {
    workersQueryResult = { data: [makeLipsyncWorker()], error: null };

    const hostedUrlsHit: string[] = [];
    installFetch(({ url }) => {
      const isHosted = HOSTED_PATTERNS.some((p) => url.includes(p));
      if (isHosted) hostedUrlsHit.push(url);
      if (url.includes("self-hosted.example.com")) {
        return fakeResponse({ json: { url: "https://self-hosted.example.com/out/r2.mp4" } });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    await orchestrate({
      kind: "lipsync",
      model: "latentsync",
      videoUrl: "https://cdn.example.com/face.mp4",
      audioUrl: "https://cdn.example.com/voice.wav",
      selfHostedOnly: true,
    });

    // No hosted provider URL was touched.
    expect(hostedUrlsHit).toHaveLength(0);
    // The sync and replicate SDK wrappers were never called directly either.
    expect(syncCallCount).toBe(0);
    expect(replicateCallCount).toBe(0);
  });

  // ── Test 3: explicit failure when no lipsync worker is online ───────────────
  it("throws 'No GPU workers available' when the worker pool has no active lipsync worker", async () => {
    // workersQueryResult defaults to empty — no workers
    workersQueryResult = { data: [], error: null };

    // fetch must not be called at all (no provider, hosted or self-hosted, should be contacted).
    const { calls } = installFetch(() => {
      throw new Error("fetch must not be called when no workers are available");
    });

    const req: GenerateRequest = {
      kind: "lipsync",
      model: "latentsync",
      videoUrl: "https://cdn.example.com/face.mp4",
      audioUrl: "https://cdn.example.com/voice.wav",
      selfHostedOnly: true,
    };

    await expect(orchestrate(req)).rejects.toThrow(/No GPU workers available/);

    // Neither hosted providers nor any HTTP endpoint was contacted.
    expect(calls).toHaveLength(0);
    expect(syncCallCount).toBe(0);
    expect(replicateCallCount).toBe(0);
  });

  // ── Test 4: explicit failure when the only worker is over capacity ──────────
  it("throws 'All GPU workers failed' when every lipsync worker is at max concurrency", async () => {
    // Worker exists but is already saturated.
    workersQueryResult = {
      data: [makeLipsyncWorker({ in_flight: 2, max_concurrency: 2 })],
      error: null,
    };

    const { calls } = installFetch(() => {
      throw new Error("fetch must not be called when worker is at capacity");
    });

    await expect(
      orchestrate({
        kind: "lipsync",
        model: "latentsync",
        videoUrl: "https://cdn.example.com/face.mp4",
        audioUrl: "https://cdn.example.com/voice.wav",
        selfHostedOnly: true,
      }),
    ).rejects.toThrow(/All GPU workers failed/);

    expect(calls).toHaveLength(0);
    expect(syncCallCount).toBe(0);
    expect(replicateCallCount).toBe(0);
  });

  // ── Test 5: explicit failure when the only worker has a stale heartbeat ─────
  it("throws 'All GPU workers failed' when the only lipsync worker has a stale heartbeat", async () => {
    // Heartbeat is 10 minutes old — exceeds the 5-minute STALE_MS threshold.
    workersQueryResult = {
      data: [makeLipsyncWorker({ last_heartbeat: new Date(Date.now() - 10 * 60_000).toISOString() })],
      error: null,
    };

    const { calls } = installFetch(() => {
      throw new Error("fetch must not be called for a stale worker");
    });

    await expect(
      orchestrate({
        kind: "lipsync",
        model: "latentsync",
        videoUrl: "https://cdn.example.com/face.mp4",
        audioUrl: "https://cdn.example.com/voice.wav",
        selfHostedOnly: true,
      }),
    ).rejects.toThrow(/All GPU workers failed/);

    expect(calls).toHaveLength(0);
    expect(syncCallCount).toBe(0);
    expect(replicateCallCount).toBe(0);
  });
});

// ─── orchestrate(): selfHostedOnly assemble routing (ffmpeg-assemble sentinel) ─
// `assemble` is INTERNAL and self-hosted-only: it must reach the GPU worker via
// the `ffmpeg-assemble` sentinel model and never any hosted provider. When no
// assemble-capable worker is online it throws — runKidsStory's preflight turns
// that into a terminal, refunded failure.

/** Build a self-hosted worker that advertises the `assemble` capability. */
function makeAssembleWorker(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "w-assemble-1",
    name: "ffmpeg-worker",
    endpoint_url: "https://assembler.example.com",
    auth_token: "gpu-secret",
    protocol: "custom",
    capabilities: ["assemble"],
    status: "active",
    in_flight: 0,
    max_concurrency: 1,
    priority: 0,
    last_heartbeat: new Date(Date.now() - 30_000).toISOString(),
    runpod_sync: false,
    ...overrides,
  };
}

describe("orchestrate() — selfHostedOnly assemble", () => {
  beforeEach(() => {
    process.env.REPLICATE_API_KEY = "r8_replicate-key-present";
    process.env.FAL_KEY = "fal-key-present";
    syncCallCount = 0;
    replicateCallCount = 0;
    heygenFetchCallCount = 0;
    workersQueryResult = { data: [], error: null };
    for (const p of ["sync", "replicate", "heygen", "runpod", "fal", "lovable", "huggingface"]) {
      markSuccess(p);
    }
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("routes the assemble job to the GPU worker via the ffmpeg-assemble sentinel and returns its URL", async () => {
    workersQueryResult = { data: [makeAssembleWorker()], error: null };

    const { calls } = installFetch(({ url }) => {
      if (url.includes("assembler.example.com")) {
        return fakeResponse({ json: { url: "https://assembler.example.com/out/story.mp4" } });
      }
      throw new Error(`Unexpected fetch to hosted provider: ${url}`);
    });

    const result = await orchestrate({
      kind: "assemble",
      model: "ffmpeg-assemble",
      selfHostedOnly: true,
      params: { scenes: [], music_url: null },
    });

    expect(result.provider).toBe("runpod"); // gpuWorker adapter name
    expect(result.endpoint).toBe("gpu:ffmpeg-worker");
    expect(result.url).toBe("https://assembler.example.com/out/story.mp4");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://assembler.example.com/generate");

    const hitHosted = calls.some((c) => HOSTED_PATTERNS.some((p) => c.url.includes(p)));
    expect(hitHosted).toBe(false);
    expect(replicateCallCount).toBe(0);
  });

  it("throws 'No GPU workers available' when no assemble-capable worker is online", async () => {
    workersQueryResult = { data: [], error: null };

    const { calls } = installFetch(() => {
      throw new Error("fetch must not be called when no assemble worker is available");
    });

    await expect(
      orchestrate({
        kind: "assemble",
        model: "ffmpeg-assemble",
        selfHostedOnly: true,
        params: { scenes: [] },
      }),
    ).rejects.toThrow(/No GPU workers available/);

    expect(calls).toHaveLength(0);
    expect(replicateCallCount).toBe(0);
  });
});

// ─── orchestrate(): selfHostedOnly lyric_video routing (ffmpeg-lyricvideo sentinel) ─
// `lyric_video` synthesizes a NEW video (background + burned-in timed lyrics,
// muxed with the uploaded song) rather than transcribing/burning onto an
// existing one. It is self-hosted-only for the same reason as `assemble` (no
// hosted provider does audio+lyrics-in / synced-video-out) and must reach the
// GPU worker via the `ffmpeg-lyricvideo` sentinel model, never a hosted provider.

/** Build a self-hosted worker that advertises the `lyric_video` capability. */
function makeLyricVideoWorker(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "w-lyricvideo-1",
    name: "ffmpeg-worker",
    endpoint_url: "https://lyricvideo.example.com",
    auth_token: "gpu-secret",
    protocol: "custom",
    capabilities: ["lyric_video"],
    status: "active",
    in_flight: 0,
    max_concurrency: 1,
    priority: 0,
    last_heartbeat: new Date(Date.now() - 30_000).toISOString(),
    runpod_sync: false,
    ...overrides,
  };
}

describe("orchestrate() — selfHostedOnly lyric_video", () => {
  beforeEach(() => {
    process.env.REPLICATE_API_KEY = "r8_replicate-key-present";
    process.env.FAL_KEY = "fal-key-present";
    syncCallCount = 0;
    replicateCallCount = 0;
    heygenFetchCallCount = 0;
    workersQueryResult = { data: [], error: null };
    for (const p of ["sync", "replicate", "heygen", "runpod", "fal", "lovable", "huggingface"]) {
      markSuccess(p);
    }
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("routes the lyric_video job to the GPU worker via the ffmpeg-lyricvideo sentinel and returns its URL", async () => {
    workersQueryResult = { data: [makeLyricVideoWorker()], error: null };

    const { calls } = installFetch(({ url }) => {
      if (url.includes("lyricvideo.example.com")) {
        return fakeResponse({ json: { url: "https://lyricvideo.example.com/out/song.mp4" } });
      }
      throw new Error(`Unexpected fetch to hosted provider: ${url}`);
    });

    const result = await orchestrate({
      kind: "lyric_video",
      model: "ffmpeg-lyricvideo",
      selfHostedOnly: true,
      audioUrl: "https://storage.example.com/song.mp3",
      segments: [{ start: 0, end: 5, text: "first line" }],
    });

    expect(result.provider).toBe("runpod"); // gpuWorker adapter name
    expect(result.endpoint).toBe("gpu:ffmpeg-worker");
    expect(result.url).toBe("https://lyricvideo.example.com/out/song.mp4");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://lyricvideo.example.com/generate");
    const body = JSON.parse(calls[0].init?.body as string);
    expect(body.audio_url).toBe("https://storage.example.com/song.mp3");
    expect(body.segments).toEqual([{ start: 0, end: 5, text: "first line" }]);

    const hitHosted = calls.some((c) => HOSTED_PATTERNS.some((p) => c.url.includes(p)));
    expect(hitHosted).toBe(false);
    expect(replicateCallCount).toBe(0);
  });

  it("throws 'No GPU workers available' when no lyric_video-capable worker is online", async () => {
    workersQueryResult = { data: [], error: null };

    const { calls } = installFetch(() => {
      throw new Error("fetch must not be called when no lyric_video worker is available");
    });

    await expect(
      orchestrate({
        kind: "lyric_video",
        model: "ffmpeg-lyricvideo",
        selfHostedOnly: true,
        audioUrl: "https://storage.example.com/song.mp3",
        segments: [{ start: 0, end: 5, text: "first line" }],
      }),
    ).rejects.toThrow(/No GPU workers available/);

    expect(calls).toHaveLength(0);
    expect(replicateCallCount).toBe(0);
  });
});

// ─── Restore env after all tests ─────────────────────────────────────────────

afterAll(() => {
  for (const k of HOSTED_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});
