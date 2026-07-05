import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { GenerateRequest } from "./orchestrator.server";

// Same stubbing strategy as orchestrator.fallback.test.ts: neutralise Supabase
// (GPU pool → "no workers"), Replicate, sync and HF so the only live decision is
// the ByteDance-direct-vs-Replicate/fal preference. ByteDance itself is exercised
// against a stubbed global fetch (the real byteplus.server module runs).

let getReplicateKeyImpl: () => string | undefined = () => undefined;
let replicateRunImpl: (
  slug: string,
  input: unknown,
  t?: number,
) => Promise<{ output: unknown }> = async () => {
  throw new Error("replicateRun not configured");
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
}));
mock.module("./sync.server", () => ({ syncLipsync: async () => "https://x" }));
mock.module("./hf.server", () => ({
  hfTextToImage: async () => ({ bytes: Buffer.from(""), contentType: "image/png" }),
  HF_ROUTER_BASE: "https://router.huggingface.co/v1",
}));

const { orchestrate, markSuccess } = await import("./orchestrator.server");

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
    headers: { get: () => null },
    json: async () => opts.json,
    text: async () => opts.text ?? "",
  } as unknown as Response;
}
type Call = { url: string };
function installFetch(handler: (call: { url: string; index: number }) => Response) {
  const calls: Call[] = [];
  const fn = mock((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url });
    return Promise.resolve(handler({ url, index: calls.length - 1 }));
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return { calls };
}
const realSetTimeout = globalThis.setTimeout;
function installFastClock() {
  globalThis.setTimeout = ((cb: (...a: unknown[]) => void) =>
    realSetTimeout(cb, 0)) as unknown as typeof setTimeout;
}

const realFetch = globalThis.fetch;
const ENV = [
  "BYTEPLUS_API_KEY",
  "ARK_API_KEY",
  "REPLICATE_API_KEY",
  "FAL_KEY",
  "GEMINI_API_KEY",
] as const;
const saved: Record<string, string | undefined> = {};
for (const k of ENV) saved[k] = process.env[k];
const BYTEPLUS_HOST = "bytepluses.com";

describe("orchestrate — ByteDance direct preference for Seed models", () => {
  beforeEach(() => {
    for (const k of ENV) delete process.env[k];
    for (const p of ["byteplus", "replicate", "runpod", "fal", "gemini"]) markSuccess(p);
    getReplicateKeyImpl = () => undefined;
    replicateRunImpl = async () => {
      throw new Error("replicateRun not configured");
    };
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    globalThis.setTimeout = realSetTimeout;
  });

  it("prefers ByteDance direct over Replicate for a Seed image model when the key is present", async () => {
    process.env.BYTEPLUS_API_KEY = "bp";
    process.env.REPLICATE_API_KEY = "r8";
    getReplicateKeyImpl = () => "r8";
    let replicateHit = false;
    replicateRunImpl = async () => {
      replicateHit = true;
      return { output: "https://replicate/should-not-win.png" };
    };
    const { calls } = installFetch(({ url }) => {
      if (url.includes(BYTEPLUS_HOST))
        return fakeResponse({ json: { data: [{ url: "https://byteplus/img.png" }] } });
      throw new Error(`unexpected fetch ${url}`);
    });

    const req: GenerateRequest = { kind: "image", prompt: "a fox", model: "fal-ai/seedream-4" };
    const res = await orchestrate(req);

    expect(res.provider).toBe("byteplus");
    expect(res.endpoint).toBe("byteplus:seedream-4-0-250828");
    expect(res.url).toBe("https://byteplus/img.png");
    expect(replicateHit).toBe(false); // Replicate never reached
    expect(calls.some((c) => c.url.includes(BYTEPLUS_HOST))).toBe(true);
  });

  it("falls back to Replicate when the direct call fails (explicit fallback, no silent hide)", async () => {
    process.env.BYTEPLUS_API_KEY = "bp";
    process.env.REPLICATE_API_KEY = "r8";
    getReplicateKeyImpl = () => "r8";
    replicateRunImpl = async () => ({ output: "https://replicate/seedream.png" });
    installFetch(({ url }) => {
      if (url.includes(BYTEPLUS_HOST))
        return fakeResponse({ ok: false, status: 500, text: "boom" });
      throw new Error(`unexpected fetch ${url}`);
    });

    const req: GenerateRequest = { kind: "image", prompt: "a fox", model: "fal-ai/seedream-4" };
    const res = await orchestrate(req);

    expect(res.provider).toBe("replicate");
    expect(res.url).toBe("https://replicate/seedream.png");
  });

  it("does not engage ByteDance when no key is set — Replicate serves the Seed model", async () => {
    process.env.REPLICATE_API_KEY = "r8";
    getReplicateKeyImpl = () => "r8";
    let byteplusHit = false;
    replicateRunImpl = async () => ({ output: "https://replicate/seedream.png" });
    installFetch(({ url }) => {
      if (url.includes(BYTEPLUS_HOST)) {
        byteplusHit = true;
        return fakeResponse({ json: { data: [{ url: "https://byteplus/img.png" }] } });
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const req: GenerateRequest = { kind: "image", prompt: "a fox", model: "fal-ai/seedream-4" };
    const res = await orchestrate(req);

    expect(res.provider).toBe("replicate");
    expect(byteplusHit).toBe(false);
  });

  it("prefers ByteDance direct for a Seed video model (create + poll)", async () => {
    installFastClock();
    process.env.BYTEPLUS_API_KEY = "bp";
    process.env.REPLICATE_API_KEY = "r8";
    getReplicateKeyImpl = () => "r8";
    let replicateHit = false;
    replicateRunImpl = async () => {
      replicateHit = true;
      return { output: "https://replicate/vid.mp4" };
    };
    installFetch(({ url, index }) => {
      if (!url.includes(BYTEPLUS_HOST)) throw new Error(`unexpected fetch ${url}`);
      if (index === 0) return fakeResponse({ json: { id: "task_1" } });
      return fakeResponse({
        json: { status: "succeeded", content: { video_url: "https://byteplus/vid.mp4" } },
      });
    });

    const req: GenerateRequest = { kind: "video", prompt: "a dragon", model: "seedance-2.0" };
    const res = await orchestrate(req);

    expect(res.provider).toBe("byteplus");
    expect(res.endpoint).toBe("byteplus:seedance-1-0-pro-250528");
    expect(res.url).toBe("https://byteplus/vid.mp4");
    expect(replicateHit).toBe(false);
  });

  it("routes Seedream 4.5 to its own checkpoint, not the 4.0 alias", async () => {
    process.env.BYTEPLUS_API_KEY = "bp";
    installFetch(({ url }) => {
      if (url.includes(BYTEPLUS_HOST))
        return fakeResponse({ json: { data: [{ url: "https://byteplus/img45.png" }] } });
      throw new Error(`unexpected fetch ${url}`);
    });

    const req: GenerateRequest = { kind: "image", prompt: "a fox", model: "fal-ai/seedream-4.5" };
    const res = await orchestrate(req);

    expect(res.provider).toBe("byteplus");
    expect(res.endpoint).toBe("byteplus:seedream-4-5-251128");
    expect(res.url).toBe("https://byteplus/img45.png");
  });

  it("serves the newest Seedream 5.0 model ByteDance-direct (no Replicate mapping exists)", async () => {
    process.env.BYTEPLUS_API_KEY = "bp";
    installFetch(({ url }) => {
      if (url.includes(BYTEPLUS_HOST))
        return fakeResponse({ json: { data: [{ url: "https://byteplus/img5.png" }] } });
      throw new Error(`unexpected fetch ${url}`);
    });

    const req: GenerateRequest = { kind: "image", prompt: "a fox", model: "fal-ai/seedream-5" };
    const res = await orchestrate(req);

    expect(res.provider).toBe("byteplus");
    expect(res.endpoint).toBe("byteplus:seedream-5-0-260128");
    expect(res.url).toBe("https://byteplus/img5.png");
  });

  it("serves the newest Seedance 3.0 model ByteDance-direct (create + poll)", async () => {
    installFastClock();
    process.env.BYTEPLUS_API_KEY = "bp";
    installFetch(({ url, index }) => {
      if (!url.includes(BYTEPLUS_HOST)) throw new Error(`unexpected fetch ${url}`);
      if (index === 0) return fakeResponse({ json: { id: "task_2" } });
      return fakeResponse({
        json: { status: "succeeded", content: { video_url: "https://byteplus/vid3.mp4" } },
      });
    });

    const req: GenerateRequest = { kind: "video", prompt: "a dragon", model: "seedance-3.0" };
    const res = await orchestrate(req);

    expect(res.provider).toBe("byteplus");
    expect(res.endpoint).toBe("byteplus:seedance-1-5-pro-251215");
    expect(res.url).toBe("https://byteplus/vid3.mp4");
  });
});

afterAll(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});
