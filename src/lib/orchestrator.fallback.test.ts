import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { GenerateRequest } from "./orchestrator.server";

// ─── Module mocks (must be registered before orchestrator is imported) ─────────
// orchestrate() reaches into Supabase (worker pool + logging) and the provider
// SDK wrappers. Stub them all so the only thing the tests drive is the
// decision/fallback logic itself. Network is mocked via global fetch where a
// provider hits it directly (lovable, fal).

// Mutable provider-SDK behaviour, reset per test.
let getReplicateKeyImpl: () => string | undefined = () => undefined;
let replicateRunImpl: (
  slug: string,
  input: unknown,
  t?: number,
) => Promise<{ output: unknown }> = async () => {
  throw new Error("replicateRun not configured for this test");
};
let syncLipsyncImpl: (opts: {
  videoUrl: string;
  audioUrl: string;
  model?: string;
}) => Promise<string> = async () => {
  throw new Error("syncLipsync not configured for this test");
};

// A chainable, awaitable Supabase query stub. Every builder method returns the
// same builder; awaiting it resolves to an empty result set (so the GPU-worker
// pool always reports "no workers" and falls through), and inserts are no-ops.
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
  // Progress parser (task #284) — orchestrator.server imports it at top level,
  // so the stub MUST export it or this suite crashes at import time whenever it
  // runs before any file that loads the real module (Bun mock.module is
  // process-global; incomplete stubs are order-dependent breakage).
  replicateProgressPct: () => null,
}));
mock.module("./sync.server", () => ({
  syncLipsync: (opts: { videoUrl: string; audioUrl: string; model?: string }) =>
    syncLipsyncImpl(opts),
}));
mock.module("./hf.server", () => ({
  // Must cover every hf.server export that top-level imports of the
  // jobs/orchestrator graph touch — an incomplete stub leaks process-wide
  // (Bun mock.module) and breaks OTHER suites' imports at link time.
  hfTextToSpeech: async () => ({ bytes: new Uint8Array(), contentType: "audio/flac" }),
  hfTextToImage: async () => ({ bytes: Buffer.from(""), contentType: "image/png" }),
  HF_ROUTER_BASE: "https://router.huggingface.co/v1",
}));

const {
  orchestrate,
  markFailure,
  markSuccess,
  isHealthy,
  getProviderHealthSnapshot,
  geminiDirectModelFor,
  GEMINI_DIRECT_SLUGS,
  GEMINI_DIRECT_DEFAULT_MODEL,
  FAL_IDENTITY_EDITS,
  getCandidateModels,
  EDIT_CAPABLE_IMAGE_MODELS,
  NO_VIDEO_PROVIDER_MSG,
} = await import("./orchestrator.server");

// ─── fetch + clock helpers (same pattern as orchestrator.server.test.ts) ───────

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

// Provider env keys touched by these tests — snapshot + restore so we never leak
// fake credentials into other test files sharing the process.
const ENV_KEYS = [
  "LOVABLE_API_KEY",
  "FAL_KEY",
  "GEMINI_API_KEY",
  "HF_TOKEN",
  "KLING_ACCESS_KEY",
  "KLING_SECRET_KEY",
  "HEYGEN_API_KEY",
  "SYNC_API_KEY",
  "REPLICATE_API_KEY",
  "LOVABLE_CONNECTOR_REPLICATE_API_KEY",
  "XAI_API_KEY",
  "OPENAI_API_KEY",
  // Task #206: Replit AI Integrations is now tried FIRST for image/text/audio.
  // These must be cleared like every other provider key so this file's
  // "nothing can serve the request" scenarios still hold with it unconfigured.
  "AI_INTEGRATIONS_OPENAI_BASE_URL",
  "AI_INTEGRATIONS_OPENAI_API_KEY",
  "AI_INTEGRATIONS_GEMINI_BASE_URL",
  "AI_INTEGRATIONS_GEMINI_API_KEY",
  // inference.sh cloud adapter — must be cleared so it doesn't bleed through
  // from the Replit secret into tests that expect only specific providers.
  "INFERENCE_SH_API_KEY",
  // Video-chain adapters (task #305 exhaustion tests): neither key exists in
  // this workspace today, but scrub them so the "chain fully unconfigured"
  // scenarios can never be leaked into by a future secret.
  "LTX_API_KEY",
  "RUNWAY_API_KEY",
] as const;
const PROVIDER_NAMES = [
  "lovable",
  "gemini",
  "replicate",
  "sync",
  "runpod",
  "kling",
  "heygen",
  "fal",
  "xai",
  "sora",
  "inferencesh",
];
const savedEnv: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) savedEnv[k] = process.env[k];

const realFetch = globalThis.fetch;

// ─── orchestrate(): provider + model fallback ─────────────────────────────────

describe("orchestrate fallback", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
    for (const p of PROVIDER_NAMES) markSuccess(p); // reset health to healthy
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

  const LOVABLE_URL = "ai.gateway.lovable.dev";
  const FAL_URL = "fal.run";

  it("returns the first healthy provider's result without trying later ones", async () => {
    process.env.LOVABLE_API_KEY = "lk";
    const { calls } = installFetch(({ url }) => {
      if (url.includes(LOVABLE_URL))
        return fakeResponse({
          json: {
            choices: [{ message: { images: [{ image_url: { url: "https://img/lovable.png" } }] } }],
          },
        });
      throw new Error(`unexpected fetch ${url}`);
    });

    const req: GenerateRequest = {
      kind: "image",
      prompt: "hi",
      model: "google/gemini-2.5-flash-image",
    };
    const res = await orchestrate(req);

    expect(res.provider).toBe("lovable");
    expect(res.url).toBe("https://img/lovable.png");
    // Only lovable was hit — the GPU pool and Fal were never reached.
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain(LOVABLE_URL);
  });

  it("falls through to the next provider when the first one throws", async () => {
    process.env.LOVABLE_API_KEY = "lk";
    process.env.FAL_KEY = "fk";
    const { calls } = installFetch(({ url }) => {
      if (url.includes(LOVABLE_URL))
        return fakeResponse({ ok: false, status: 400, text: "bad gateway input" });
      if (url.includes(FAL_URL))
        return fakeResponse({ json: { images: [{ url: "https://img/fal.png" }] } });
      throw new Error(`unexpected fetch ${url}`);
    });

    // Pinning a model + providing imageUrls keeps the candidate list to a single
    // entry and lets fal serve via the FAL_IDENTITY_EDITS edit path (no default
    // image path exists in FAL_MAP for t2i requests without a specific model).
    const req: GenerateRequest = {
      kind: "image",
      prompt: "hi",
      model: "google/gemini-2.5-flash-image",
      imageUrls: ["https://ref.example/face.jpg"],
    };
    const res = await orchestrate(req);

    // lovable failed, the GPU pool reported no workers, Fal (last resort) won.
    expect(res.provider).toBe("fal");
    expect(res.url).toBe("https://img/fal.png");
    expect(calls.some((c) => c.url.includes(LOVABLE_URL))).toBe(true);
    expect(calls.some((c) => c.url.includes(FAL_URL))).toBe(true);
  });

  it("falls across FALLBACK_MODELS to the first available provider and respects FALLBACK_CAP", async () => {
    // After removing unregistered openai/sora-2, video FALLBACK_MODELS start:
    //   ["xai/grok-imagine-video-1.5", "fal/ovi", "ltx/ltx-video", "veo-2", ...]
    // FALLBACK_CAP.video = 3 → candidates (no explicit model) = [xai, ltx, veo-2].
    // ltx and veo-2 have no keys in this test → adapters filtered out.
    // xAI has a key and fetch is mocked → succeeds as the first working candidate.
    installFakeClock();
    process.env.XAI_API_KEY = "xai_test";
    markSuccess("xai");
    const { calls } = installFetch(({ url, index }) => {
      if (!url.includes("api.x.ai")) throw new Error(`unexpected fetch ${url}`);
      if (index === 0) return fakeResponse({ json: { id: "req_xai_1" } }); // create
      return fakeResponse({ json: { video: { url: "https://xai.out/video.mp4" } } }); // poll
    });

    const req: GenerateRequest = { kind: "video", prompt: "a dragon" };
    const res = await orchestrate(req);

    expect(res.provider).toBe("xai");
    expect(res.url).toBe("https://xai.out/video.mp4");
    // Only api.x.ai was ever contacted (create + one poll round).
    expect(calls.every((c) => c.url.includes("api.x.ai"))).toBe(true);
  });

  it("returns generated text from a text-modality provider (Pollinations, keyless)", async () => {
    const { calls } = installFetch(({ url }) => {
      if (url.includes("text.pollinations.ai"))
        return fakeResponse({ text: "a generated haiku about the sea" });
      throw new Error(`unexpected fetch ${url}`);
    });

    const req: GenerateRequest = {
      kind: "text",
      prompt: "write a haiku",
      model: "pollinations/openai",
    };
    const res = await orchestrate(req);

    expect(res.provider).toBe("pollinations");
    expect(res.text).toBe("a generated haiku about the sea");
    // Free text providers don't produce a media URL.
    expect(res.url).toBe("");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("text.pollinations.ai");
  });

  it("returns generated text from a text-modality provider (Pollinations, keyless)", async () => {
    const { calls } = installFetch(({ url }) => {
      if (url.includes("text.pollinations.ai"))
        return fakeResponse({ text: "a generated haiku about the sea" });
      throw new Error(`unexpected fetch ${url}`);
    });

    const req: GenerateRequest = {
      kind: "text",
      prompt: "write a haiku",
      model: "pollinations/openai",
    };
    const res = await orchestrate(req);

    expect(res.provider).toBe("pollinations");
    expect(res.text).toBe("a generated haiku about the sea");
    // Free text providers don't produce a media URL.
    expect(res.url).toBe("");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("text.pollinations.ai");
  });

  it("throws an explanatory 'no provider available' error when nothing can serve the request", async () => {
    // Audio has no keyless provider: ElevenLabs needs a key (absent) and the only
    // other option is a `tts` GPU worker, and the pool is cooled down here.
    // (Image/text can't reach this state anymore — Pollinations is free + keyless.)
    markFailure("runpod");
    const req: GenerateRequest = { kind: "audio", model: "elevenlabs/tts" };
    await expect(orchestrate(req)).rejects.toThrow(/No provider available for audio/);
  });

  // ─── Video chain exhaustion (task #305) ──────────────────────────────────────
  // /orchestrate video must fail LOUDLY with one stable message when every
  // candidate is exhausted — never a misleading raw last-provider error, and
  // never the old silent Ken Burns soft-landing (ffmpeg-free is now gated on
  // the explicit "ffmpeg-free-video" model pick).

  it("unpinned video with nothing configured throws the stable no-video-provider error — and never soft-lands on ffmpeg-free", async () => {
    const { calls } = installFetch(() => {
      throw new Error("unexpected fetch — no hosted provider should be attempted");
    });
    const req: GenerateRequest = { kind: "video", prompt: "a fast car" };
    // GPU pool is healthy but empty (supabase stub) → attempted + silently
    // skipped; every hosted adapter lacks its key → chain exhausted.
    await expect(orchestrate(req)).rejects.toThrow(
      /No video provider available right now — try again or switch model/,
    );
    // Before the ffmpeg-free model gate, this request "succeeded" with a Ken
    // Burns pan over a Pollinations still. Prove no image fetch was even tried.
    expect(calls.some((c) => c.url.includes("pollinations"))).toBe(false);
  });

  it("unpinned video with the chain unconfigured AND the pool cooled keeps terminal-classifiable reasons in the suffix", async () => {
    markFailure("runpod"); // cool the GPU pool → nothing at all can be tried
    const req: GenerateRequest = { kind: "video", prompt: "a fast car" };
    const err = await orchestrate(req).then(
      () => null,
      (e: Error) => e,
    );
    expect(err).not.toBeNull();
    expect(err!.message.startsWith(NO_VIDEO_PROVIDER_MSG)).toBe(true);
    // "missing config/key" must survive in the suffix: the job queue's
    // classifyJobError treats this config-gap as terminal (refund) as before.
    expect(err!.message).toContain("missing config/key");
  });

  it("unpinned video where a provider was tried and failed wraps the raw error under the stable message", async () => {
    markFailure("runpod"); // keep the pool out so the last error is the provider's
    process.env.XAI_API_KEY = "xk";
    installFetch(() => fakeResponse({ ok: false, status: 400, text: "synthetic provider outage" }));
    const req: GenerateRequest = {
      kind: "video",
      prompt: "a fast car",
      model: "xai/grok-imagine-video-1.5",
    };
    const err = await orchestrate(req).then(
      () => null,
      (e: Error) => e,
    );
    expect(err).not.toBeNull();
    expect(err!.message.startsWith(NO_VIDEO_PROVIDER_MSG)).toBe(true);
    // Raw last-provider error preserved as a suffix: ops logs stay diagnosable
    // and the job queue's terminal/transient classification sees the same tokens.
    expect(err!.message).toContain("(last:");
    expect(err!.message).toContain("400");
  });

  it("pinned video keeps the raw provider error — the wrap is for the fallback chain only", async () => {
    process.env.XAI_API_KEY = "xk";
    installFetch(() => fakeResponse({ ok: false, status: 400, text: "synthetic provider outage" }));
    const req: GenerateRequest = {
      kind: "video",
      prompt: "a fast car",
      model: "xai/grok-imagine-video-1.5",
      pinnedModelOnly: true,
    };
    const err = await orchestrate(req).then(
      () => null,
      (e: Error) => e,
    );
    expect(err).not.toBeNull();
    // The user chose THIS model: a rate-limit/outage on it must surface as
    // such (accurate retry advice), not as "no video provider available".
    expect(err!.message).not.toContain("No video provider available");
    expect(err!.message).toContain("400");
  });

  it("aborts immediately on a FATAL request error without burning later fallbacks", async () => {
    process.env.LOVABLE_API_KEY = "lk";
    process.env.FAL_KEY = "fk";
    const { calls } = installFetch(({ url }) => {
      if (url.includes(LOVABLE_URL))
        return fakeResponse({ ok: false, status: 400, text: "unsafe url host not allowed" });
      if (url.includes(FAL_URL))
        return fakeResponse({ json: { images: [{ url: "https://img/fal.png" }] } });
      throw new Error(`unexpected fetch ${url}`);
    });

    const req: GenerateRequest = {
      kind: "image",
      prompt: "hi",
      model: "google/gemini-2.5-flash-image",
    };
    await expect(orchestrate(req)).rejects.toThrow(/unsafe/);
    // Fal must NOT have been attempted — the request is fatal for every provider.
    expect(calls.some((c) => c.url.includes(FAL_URL))).toBe(false);
  });

  it("does NOT cool down a provider after a non-provider-down failure", async () => {
    process.env.LOVABLE_API_KEY = "lk";
    process.env.FAL_KEY = "fk";
    installFetch(({ url }) => {
      if (url.includes(LOVABLE_URL))
        return fakeResponse({ ok: false, status: 400, text: "bad input shape" });
      if (url.includes(FAL_URL))
        return fakeResponse({ json: { images: [{ url: "https://img/fal.png" }] } });
      throw new Error(`unexpected fetch ${url}`);
    });

    // Pin model + imageUrls so fal can serve via FAL_IDENTITY_EDITS path and
    // lovable is only tried once (single candidate → failures stays at 0 on 400).
    await orchestrate({
      kind: "image",
      prompt: "hi",
      model: "google/gemini-2.5-flash-image",
      imageUrls: ["https://ref.example/face.jpg"],
    });
    // A 400 input error is provider-agnostic noise, not a provider outage.
    expect(isHealthy("lovable")).toBe(true);
    expect(getProviderHealthSnapshot()["lovable"]?.failures ?? 0).toBe(0);
  });

  it("cools down a provider after a PROVIDER_DOWN failure", async () => {
    installFakeClock();
    process.env.LOVABLE_API_KEY = "lk";
    process.env.FAL_KEY = "fk";
    installFetch(({ url }) => {
      if (url.includes(LOVABLE_URL))
        return fakeResponse({ ok: false, status: 503, text: "service unavailable" });
      if (url.includes(FAL_URL))
        return fakeResponse({ json: { images: [{ url: "https://img/fal.png" }] } });
      throw new Error(`unexpected fetch ${url}`);
    });

    // Pin model + imageUrls: single candidate → lovable fails exactly once with 503.
    const res = await orchestrate({
      kind: "image",
      prompt: "hi",
      model: "google/gemini-2.5-flash-image",
      imageUrls: ["https://ref.example/face.jpg"],
    });
    expect(res.provider).toBe("fal"); // still served by falling through
    // A 503 is a genuine outage signal → lovable is circuit-broken.
    expect(isHealthy("lovable")).toBe(false);
    const snap = getProviderHealthSnapshot()["lovable"];
    expect(snap.failures).toBe(1);
    expect(snap.cooldownMs).toBeGreaterThan(0);
  });
});

// ─── In-memory health tracking ────────────────────────────────────────────────

describe("provider health tracking", () => {
  beforeEach(() => installFakeClock(1_000_000));
  afterEach(() => restoreClock());

  it("markFailure opens a cooldown that isHealthy respects until it expires", () => {
    markSuccess("hp");
    expect(isHealthy("hp")).toBe(true);

    markFailure("hp"); // failures=1 → 5s cooldown
    expect(isHealthy("hp")).toBe(false);
    fakeNow += 4_999;
    expect(isHealthy("hp")).toBe(false);
    fakeNow += 2; // now past cooldownUntil
    expect(isHealthy("hp")).toBe(true);
  });

  it("escalates the cooldown with repeated failures, capped at 120s", () => {
    markSuccess("esc");
    markFailure("esc");
    expect(getProviderHealthSnapshot()["esc"]).toMatchObject({ failures: 1, cooldownMs: 5_000 });
    markFailure("esc");
    expect(getProviderHealthSnapshot()["esc"]).toMatchObject({ failures: 2, cooldownMs: 15_000 });
    markFailure("esc");
    expect(getProviderHealthSnapshot()["esc"].cooldownMs).toBe(45_000);
    markFailure("esc"); // 5*27=135 → capped
    expect(getProviderHealthSnapshot()["esc"].cooldownMs).toBe(120_000);
  });

  it("markSuccess clears failures and cooldown", () => {
    markFailure("rs");
    markFailure("rs");
    expect(isHealthy("rs")).toBe(false);

    markSuccess("rs");
    expect(isHealthy("rs")).toBe(true);
    expect(getProviderHealthSnapshot()["rs"]).toMatchObject({
      failures: 0,
      cooldownMs: 0,
      ready: true,
    });
  });

  it("getProviderHealthSnapshot flips ready false→true as the cooldown expires", () => {
    markSuccess("snp");
    markFailure("snp");
    expect(getProviderHealthSnapshot()["snp"].ready).toBe(false);

    fakeNow += 6_000;
    expect(getProviderHealthSnapshot()["snp"].ready).toBe(true);
    expect(getProviderHealthSnapshot()["snp"].cooldownMs).toBe(0);
  });
});

// ─── Gemini direct model routing (Task: Spin/bulk identity model swap) ────────

describe("geminiDirectModelFor", () => {
  it("maps every registry gemini-family key to a live API slug (no dead -preview 2.5 slug)", () => {
    expect(geminiDirectModelFor("google/gemini-3.1-flash-image-preview")).toBe(
      "gemini-3.1-flash-image-preview",
    );
    expect(geminiDirectModelFor("google/gemini-3-pro-image-preview")).toBe(
      "gemini-3-pro-image-preview",
    );
    // The API renamed gemini-2.5-flash-image-preview → gemini-2.5-flash-image;
    // the old hardcoded slug 404s and must never come back.
    expect(geminiDirectModelFor("google/gemini-2.5-flash-image")).toBe("gemini-2.5-flash-image");
    expect(geminiDirectModelFor("google/nano-banana")).toBe("gemini-2.5-flash-image");
    for (const slug of Object.values(GEMINI_DIRECT_SLUGS)) {
      expect(slug).not.toBe("gemini-2.5-flash-image-preview");
    }
  });

  it("returns the default flash model for model-less requests", () => {
    expect(geminiDirectModelFor(undefined)).toBe(GEMINI_DIRECT_DEFAULT_MODEL);
    expect(geminiDirectModelFor(null)).toBe(GEMINI_DIRECT_DEFAULT_MODEL);
  });

  it("refuses non-gemini models so geminiDirect cannot hijack other image requests", () => {
    expect(geminiDirectModelFor("fal-ai/seedream-4")).toBeNull();
    expect(geminiDirectModelFor("replicate/flux-schnell")).toBeNull();
    expect(geminiDirectModelFor("pollinations/flux")).toBeNull();
  });
});

describe("FAL_IDENTITY_EDITS", () => {
  it("covers every gemini-family model with an image_urls[] edit endpoint", () => {
    for (const model of Object.keys(GEMINI_DIRECT_SLUGS)) {
      expect(FAL_IDENTITY_EDITS[model]).toMatch(/\/edit$/);
    }
  });
});

describe("fal identity-preserving fallback", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
    for (const p of PROVIDER_NAMES) markSuccess(p);
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("routes a gemini-family model with a reference image to the fal edit endpoint with image_urls[]", async () => {
    process.env.FAL_KEY = "fal-test";
    const { calls } = installFetch(({ url }) => {
      if (url.includes("fal.run/fal-ai/nano-banana/edit")) {
        return fakeResponse({ json: { images: [{ url: "https://fal.media/out.png" }] } });
      }
      return fakeResponse({ ok: false, status: 500, text: "unexpected fetch " + url });
    });

    const res = await orchestrate({
      kind: "image",
      model: "google/gemini-3.1-flash-image-preview",
      prompt: "rooftop golden hour, full-body",
      imageUrls: ["https://example.com/face.jpg"],
    } as GenerateRequest);

    expect(res.url).toBe("https://fal.media/out.png");
    const falCall = calls.find((c) => c.url.includes("fal.run/fal-ai/nano-banana/edit"));
    expect(falCall).toBeDefined();
    const body = JSON.parse(String(falCall!.init?.body));
    // Identity contract: the reference image must arrive as image_urls[] — the
    // generic flux/schnell path (text-to-image) would silently drop the face.
    expect(body.image_urls).toEqual(["https://example.com/face.jpg"]);
    expect(body.prompt).toContain("rooftop");
  });
});

// ─── editStrict (photo editor) ─────────────────────────────────────────────────

describe("editStrict (photo editor)", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
    for (const p of PROVIDER_NAMES) markSuccess(p);
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("filters the candidate list to edit-capable models only", () => {
    const c = getCandidateModels({
      kind: "image",
      model: "google/nano-banana",
      editStrict: true,
    } as GenerateRequest);
    expect(c[0]).toBe("google/nano-banana");
    for (const m of c) expect(EDIT_CAPABLE_IMAGE_MODELS.has(m)).toBe(true);
    // The text-to-image fallbacks would ignore the source photo — never eligible.
    expect(c).not.toContain("fal-ai/seedream-4");
    expect(c).not.toContain("replicate/flux-schnell");
    expect(c).not.toContain("pollinations/flux");
  });

  it("leaves non-strict image requests untouched (t2i fallbacks still reachable)", () => {
    const c = getCandidateModels({
      kind: "image",
      model: "google/nano-banana",
    } as GenerateRequest);
    expect(c).toContain("fal-ai/seedream-4");
  });

  it("pinnedModelOnly returns exactly the requested model — no video fallback (xAI UGC engine)", () => {
    // The xai-ugc lip-sync engine pins to grok-imagine-video-1.5: a silent
    // seedance/kling substitute would not be a UGC talking-head video and must
    // never be delivered (or charged for) in its place.
    const c = getCandidateModels({
      kind: "video",
      model: "xai/grok-imagine-video-1.5",
      pinnedModelOnly: true,
    } as GenerateRequest);
    expect(c).toEqual(["xai/grok-imagine-video-1.5"]);
  });

  it("every edit-capable model has a real edit route (fal edit, gemini direct, replicate nano-banana-pro, or the Replit Gemini proxy)", () => {
    for (const m of EDIT_CAPABLE_IMAGE_MODELS) {
      const routable =
        Boolean(FAL_IDENTITY_EDITS[m]) ||
        Boolean(GEMINI_DIRECT_SLUGS[m]) ||
        m === "google/nano-banana-pro" ||
        // Replit-billed Gemini image proxy inlines imageUrls as inline_data.
        m === "replit/gemini-2.5-flash-image";
      expect(routable).toBe(true);
    }
  });

  it("dispatches a strict nano-banana edit to the fal edit endpoint with image_urls[]", async () => {
    process.env.FAL_KEY = "fal-test";
    const { calls } = installFetch(({ url }) => {
      if (url.includes("fal.run/fal-ai/nano-banana/edit")) {
        return fakeResponse({ json: { images: [{ url: "https://fal.media/edited.png" }] } });
      }
      return fakeResponse({ ok: false, status: 500, text: "unexpected fetch " + url });
    });

    const res = await orchestrate({
      kind: "image",
      model: "google/nano-banana",
      editStrict: true,
      prompt: "Edit the attached photo: make it golden hour.",
      imageUrls: ["https://example.com/photo.jpg"],
    } as GenerateRequest);

    expect(res.url).toBe("https://fal.media/edited.png");
    const falCall = calls.find((c) => c.url.includes("fal.run/fal-ai/nano-banana/edit"));
    expect(falCall).toBeDefined();
    const body = JSON.parse(String(falCall!.init?.body));
    // The uploaded photo must arrive as the edit source, not a loose reference.
    expect(body.image_urls).toEqual(["https://example.com/photo.jpg"]);
  });

  it("fails explicitly when no edit-capable candidate survives, instead of falling back to t2i", async () => {
    // No provider keys at all → the only strict candidate (nano-banana) has no
    // healthy adapter, and flux/pollinations must NOT be silently substituted.
    installFetch(() => fakeResponse({ ok: false, status: 500, text: "no provider should be hit" }));
    await expect(
      orchestrate({
        kind: "image",
        model: "google/nano-banana",
        editStrict: true,
        prompt: "Edit the attached photo: remove the background.",
        imageUrls: ["https://example.com/photo.jpg"],
      } as GenerateRequest),
    ).rejects.toThrow();
  });
});

// ─── Kling Omni routing lock (Task #244 regression guard) ─────────────────────
// Two invariants must hold forever:
//  1. getCandidateModels lists kling-3.0-omni as the first candidate when it is
//     explicitly requested, so the Replicate adapter can pick it up.
//  2. klingDirect.supports() rejects kling-3.0-omni even with KLING creds +
//     forSubscriber:true — the JWT adapter always calls "kling-v1", which would
//     silently downgrade quality/pricing instead of using the verified
//     kwaivgi/kling-v2.1-master Replicate slug.

describe("kling-3.0-omni routing (regression guard)", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
    for (const p of PROVIDER_NAMES) markSuccess(p);
    getReplicateKeyImpl = () => undefined;
    replicateRunImpl = async () => {
      throw new Error("replicateRun not configured");
    };
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    restoreClock();
  });

  it("getCandidateModels places kling-3.0-omni first when explicitly requested", () => {
    // Regression: a future edit to getCandidateModels (e.g. adding a hard
    // exclusion list) must not silently drop kling-3.0-omni from the candidate
    // set, or the Replicate adapter would never receive the request.
    const candidates = getCandidateModels({
      kind: "video",
      prompt: "cinematic storm",
      model: "kling-3.0-omni",
      forSubscriber: true,
    });
    expect(candidates[0]).toBe("kling-3.0-omni");
  });

  it("klingDirect does NOT serve kling-3.0-omni even with Kling creds — falls through to Replicate (kwaivgi/kling-v2.1-master)", async () => {
    // Regression: if someone removes the `r.model !== "kling-3.0-omni"` guard
    // from klingDirect.supports(), it would silently call Kling's "kling-v1"
    // API model instead of the Replicate kwaivgi/kling-v2.1-master slug.
    installFakeClock();
    process.env.KLING_ACCESS_KEY = "test-access-key";
    process.env.KLING_SECRET_KEY = "test-secret-key";
    getReplicateKeyImpl = () => "rep-test-key";

    let replicateSlug = "";
    replicateRunImpl = async (slug) => {
      replicateSlug = slug;
      if (slug === "kwaivgi/kling-v2.1-master") {
        return { output: "https://replicate.delivery/kling-omni.mp4" };
      }
      throw new Error(`unexpected Replicate slug: ${slug}`);
    };

    const { calls } = installFetch(({ url }) => {
      // If klingDirect fires, it hits api.klingai.com — that must never happen.
      if (url.includes("api.klingai.com")) {
        throw new Error("klingDirect must NOT be called for kling-3.0-omni — regression detected");
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await orchestrate({
      kind: "video",
      prompt: "cinematic storm over the ocean",
      model: "kling-3.0-omni",
      forSubscriber: true,
    });

    // The request must have been served by Replicate, not by Kling's JWT adapter.
    expect(res.provider).toBe("replicate");
    expect(res.url).toBe("https://replicate.delivery/kling-omni.mp4");
    expect(replicateSlug).toBe("kwaivgi/kling-v2.1-master");
    // Belt-and-suspenders: Kling's API endpoint was never contacted.
    expect(calls.some((c) => c.url.includes("api.klingai.com"))).toBe(false);
  });
});

// ─── Identity context survives across fallback candidates (audit gap) ─────────
// The provider-fallback audit flagged that identity/reference context
// (imageUrls, prompt) is carried via the single shared GenerateRequest object
// reused across every candidate attempt — never rebuilt or dropped mid-loop.
// Prove this explicitly for a case where the FIRST candidate fails and a
// SECOND candidate must still receive the exact same reference image, so a
// future refactor that clones/narrows the request per-attempt gets caught.
describe("identity context (imageUrls) is identical across every fallback attempt", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
    for (const p of PROVIDER_NAMES) markSuccess(p);
    // Reset provider-SDK stubs to their defaults — a prior describe block
    // (kling-3.0-omni routing) leaves these pointed at Replicate-succeeds
    // behavior, which would otherwise leak into this suite's "only lovable
    // and fal are reachable" assumption.
    getReplicateKeyImpl = () => undefined;
    replicateRunImpl = async () => {
      throw new Error("replicateRun not configured for this test");
    };
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("passes the same imageUrls to fal after lovable fails, for an unpinned identity-edit request", async () => {
    process.env.LOVABLE_API_KEY = "lk";
    process.env.FAL_KEY = "fk";
    const LOVABLE_URL = "ai.gateway.lovable.dev";
    const FAL_URL = "fal.run";
    const refImage = "https://ref.example/face-lock.jpg";
    // Same shape as the "falls through to the next provider when the first one
    // throws" precedent above: pinning a model + providing imageUrls keeps the
    // candidate list to a single entry, so only lovable then fal are ever hit.
    const { calls } = installFetch(({ url }) => {
      if (url.includes(LOVABLE_URL))
        return fakeResponse({ ok: false, status: 400, text: "bad gateway input" });
      if (url.includes(FAL_URL))
        return fakeResponse({ json: { images: [{ url: "https://img/fal.png" }] } });
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await orchestrate({
      kind: "image",
      prompt: "same character, different pose",
      model: "google/gemini-2.5-flash-image",
      imageUrls: [refImage],
    } as GenerateRequest);

    expect(res.provider).toBe("fal");
    const lovableCall = calls.find((c) => c.url.includes(LOVABLE_URL));
    const falCall = calls.find((c) => c.url.includes(FAL_URL));
    expect(lovableCall).toBeDefined();
    expect(falCall).toBeDefined();
    // The reference image the FIRST candidate saw (embedded in its request
    // body) must be the exact same URL the fallback candidate received.
    const lovableBody = JSON.parse(String(lovableCall!.init?.body));
    const falBody = JSON.parse(String(falCall!.init?.body));
    const lovableImageUrl = lovableBody?.messages?.[0]?.content?.find?.(
      (c: { type?: string }) => c.type === "image_url",
    )?.image_url?.url;
    expect(lovableImageUrl).toBe(refImage);
    expect(falBody.image_urls).toEqual([refImage]);
  });
});

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});
