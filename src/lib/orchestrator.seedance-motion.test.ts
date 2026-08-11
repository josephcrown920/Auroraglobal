import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { GenerateRequest } from "./orchestrator.server";

// Pinned-only Seedance motion branch (kind "motion" riding the seedance i2v
// video mappings). Same stubbing strategy as orchestrator.byteplus.test.ts:
// neutralise Supabase (GPU pool → "no workers") and Replicate so the only live
// decision is the motion routing; ByteDance runs against a stubbed global fetch.
//
// House rules under test:
//  • subscriber + pinned seedance key → byteplus first, Replicate fallback
//  • free tier NEVER reaches a Seedance provider, even pinned
//  • unpinned motion NEVER reaches a Seedance provider (not in the chain)
//  • driving-video motion transfer is refused (stays self-hosted MimicMotion)

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
  fetchToBytes: async () => ({ bytes: Buffer.from(""), mime: "application/octet-stream" }),
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
  "XAI_API_KEY",
  "INFERENCE_SH_API_KEY",
] as const;
const saved: Record<string, string | undefined> = {};
for (const k of ENV) saved[k] = process.env[k];
const BYTEPLUS_HOST = "bytepluses.com";

const IMG = "https://pub.example/still.png";

describe("orchestrate — pinned-only Seedance motion branch", () => {
  beforeEach(() => {
    for (const k of ENV) delete process.env[k];
    for (const p of ["byteplus", "replicate", "runpod", "fal", "gemini", "xai", "inferencesh"])
      markSuccess(p);
    getReplicateKeyImpl = () => undefined;
    replicateRunImpl = async () => {
      throw new Error("replicateRun not configured");
    };
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    globalThis.setTimeout = realSetTimeout;
  });

  it("subscriber + pinned seedance-2.0-fast → ByteDance direct serves motion (create + poll)", async () => {
    installFastClock();
    process.env.BYTEPLUS_API_KEY = "bp";
    process.env.REPLICATE_API_KEY = "r8";
    getReplicateKeyImpl = () => "r8";
    let replicateHit = false;
    replicateRunImpl = async () => {
      replicateHit = true;
      return { output: "https://replicate/should-not-win.mp4" };
    };
    installFetch(({ url, index }) => {
      if (!url.includes(BYTEPLUS_HOST)) throw new Error(`unexpected fetch ${url}`);
      if (index === 0) return fakeResponse({ json: { id: "task_m1" } });
      return fakeResponse({
        json: { status: "succeeded", content: { video_url: "https://byteplus/motion.mp4" } },
      });
    });

    const req: GenerateRequest = {
      kind: "motion",
      prompt: "slow orbit around the subject",
      imageUrls: [IMG],
      model: "seedance-2.0-fast",
      forSubscriber: true,
    };
    const res = await orchestrate(req);

    expect(res.provider).toBe("byteplus");
    expect(res.endpoint).toBe("byteplus:dreamina-seedance-2-0-fast-260128");
    expect(res.url).toBe("https://byteplus/motion.mp4");
    expect(replicateHit).toBe(false);
  });

  it("falls back to Replicate seedance-1-lite when ByteDance fails (ModelNotOpen today)", async () => {
    installFastClock();
    process.env.BYTEPLUS_API_KEY = "bp";
    process.env.REPLICATE_API_KEY = "r8";
    getReplicateKeyImpl = () => "r8";
    let replicateSlug: string | null = null;
    replicateRunImpl = async (slug) => {
      replicateSlug = slug;
      return { output: "https://replicate/motion.mp4" };
    };
    installFetch(({ url }) => {
      if (url.includes(BYTEPLUS_HOST))
        return fakeResponse({ ok: false, status: 404, text: '{"error":{"code":"ModelNotOpen"}}' });
      throw new Error(`unexpected fetch ${url}`);
    });

    const req: GenerateRequest = {
      kind: "motion",
      prompt: "push-in",
      imageUrls: [IMG],
      model: "seedance-2.0-fast",
      forSubscriber: true,
    };
    const res = await orchestrate(req);

    expect(res.provider).toBe("replicate");
    expect(replicateSlug).toBe("bytedance/seedance-1-lite");
    expect(res.url).toBe("https://replicate/motion.mp4");
  });

  it("free tier NEVER reaches a Seedance provider, even when pinned", async () => {
    process.env.BYTEPLUS_API_KEY = "bp";
    process.env.REPLICATE_API_KEY = "r8";
    getReplicateKeyImpl = () => "r8";
    let replicateHit = false;
    replicateRunImpl = async () => {
      replicateHit = true;
      return { output: "https://replicate/never.mp4" };
    };
    const { calls } = installFetch(() => fakeResponse({ json: {} }));

    const req: GenerateRequest = {
      kind: "motion",
      prompt: "orbit",
      imageUrls: [IMG],
      model: "seedance-2.0-fast",
      // forSubscriber deliberately absent — free tier
    };
    await expect(orchestrate(req)).rejects.toThrow();
    expect(replicateHit).toBe(false);
    expect(calls.some((c) => c.url.includes(BYTEPLUS_HOST))).toBe(false);
  });

  it("driving-video motion transfer is refused by the Seedance branch (stays self-hosted)", async () => {
    process.env.BYTEPLUS_API_KEY = "bp";
    process.env.REPLICATE_API_KEY = "r8";
    getReplicateKeyImpl = () => "r8";
    let replicateHit = false;
    replicateRunImpl = async () => {
      replicateHit = true;
      return { output: "https://replicate/never.mp4" };
    };
    const { calls } = installFetch(() => fakeResponse({ json: {} }));

    const req: GenerateRequest = {
      kind: "motion",
      prompt: "follow the dance",
      imageUrls: [IMG],
      videoUrl: "https://pub.example/driving.mp4",
      model: "seedance-2.0-fast",
      forSubscriber: true,
    };
    await expect(orchestrate(req)).rejects.toThrow();
    expect(replicateHit).toBe(false);
    expect(calls.some((c) => c.url.includes(BYTEPLUS_HOST))).toBe(false);
  });

  it("unpinned subscriber motion never auto-fires Seedance (not in the fallback chain)", async () => {
    process.env.BYTEPLUS_API_KEY = "bp";
    process.env.REPLICATE_API_KEY = "r8";
    getReplicateKeyImpl = () => "r8";
    let replicateHit = false;
    replicateRunImpl = async () => {
      replicateHit = true;
      return { output: "https://replicate/never.mp4" };
    };
    const { calls } = installFetch(() => fakeResponse({ json: {} }));

    const req: GenerateRequest = {
      kind: "motion",
      prompt: "orbit",
      imageUrls: [IMG],
      forSubscriber: true,
      // no model pin — candidates come from FALLBACK_MODELS.motion only
    };
    await expect(orchestrate(req)).rejects.toThrow();
    expect(replicateHit).toBe(false);
    expect(calls.some((c) => c.url.includes(BYTEPLUS_HOST))).toBe(false);
  });
});

afterAll(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});
