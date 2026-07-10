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
}));
mock.module("./sync.server", () => ({
  syncLipsync: (opts: { videoUrl: string; audioUrl: string; model?: string }) =>
    syncLipsyncImpl(opts),
}));
mock.module("./hf.server", () => ({
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
  "PIAPI_API_KEY",
  // Task #206: Replit AI Integrations is now tried FIRST for image/text/audio.
  // These must be cleared like every other provider key so this file's
  // "nothing can serve the request" scenarios still hold with it unconfigured.
  "AI_INTEGRATIONS_OPENAI_BASE_URL",
  "AI_INTEGRATIONS_OPENAI_API_KEY",
  "AI_INTEGRATIONS_GEMINI_BASE_URL",
  "AI_INTEGRATIONS_GEMINI_API_KEY",
] as const;
const PROVIDER_NAMES = [
  "lovable",
  "gemini",
  "replicate",
  "huggingface",
  "sync",
  "runpod",
  "kling",
  "piapi",
  "heygen",
  "fal",
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

    const req: GenerateRequest = { kind: "image", prompt: "hi" };
    const res = await orchestrate(req);

    // lovable failed, the GPU pool reported no workers, Fal (last resort) won.
    expect(res.provider).toBe("fal");
    expect(res.url).toBe("https://img/fal.png");
    expect(calls.some((c) => c.url.includes(LOVABLE_URL))).toBe(true);
    expect(calls.some((c) => c.url.includes(FAL_URL))).toBe(true);
  });

  it("falls across FALLBACK_MODELS (same Replicate provider) and respects FALLBACK_CAP", async () => {
    process.env.REPLICATE_API_KEY = "r8_test";
    getReplicateKeyImpl = () => "r8_test";
    const slugs: string[] = [];
    replicateRunImpl = async (slug) => {
      slugs.push(slug);
      if (slug === "bytedance/seedance-1-lite") throw new Error("Replicate model crashed");
      return { output: "https://replicate.out/seedance.mp4" };
    };

    const req: GenerateRequest = { kind: "video", prompt: "a dragon" };
    const res = await orchestrate(req);

    expect(res.provider).toBe("replicate");
    expect(res.endpoint).toBe("replicate:bytedance/seedance-1-pro");
    expect(res.url).toBe("https://replicate.out/seedance.mp4");
    // FALLBACK_CAP.video === 2 → exactly the first two video models were tried.
    expect(slugs).toEqual(["bytedance/seedance-1-lite", "bytedance/seedance-1-pro"]);
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

    await orchestrate({ kind: "image", prompt: "hi" });
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

    const res = await orchestrate({ kind: "image", prompt: "hi" });
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
    expect(c).toContain("pollinations/flux");
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

  it("every edit-capable model has a real edit route (fal edit, gemini direct, or replicate nano-banana-pro)", () => {
    for (const m of EDIT_CAPABLE_IMAGE_MODELS) {
      const routable =
        Boolean(FAL_IDENTITY_EDITS[m]) ||
        Boolean(GEMINI_DIRECT_SLUGS[m]) ||
        m === "google/nano-banana-pro";
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

afterAll(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});
