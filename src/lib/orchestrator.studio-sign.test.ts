import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

// signStudioRefs/signIfStudio rewrite private `studio` bucket reference URLs
// into short-lived signed URLs before an external provider fetches them —
// the public path 400s since the bucket is private. Reuses the supabase
// storage stub pattern from orchestrator.fallback.test.ts. mock.module must
// be registered before orchestrator.server is imported.

type SignResult = { data: { signedUrl: string } | null; error: { message: string } | null };
let createSignedUrlImpl: (path: string) => Promise<SignResult> = async (path) => ({
  data: { signedUrl: `https://signed.example/${path}` },
  error: null,
});
const signedUrlCalls: string[] = [];

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

const supabaseAdmin = {
  from: () => makeQuery({ data: [], error: null, count: 0 }),
  rpc: async () => ({ data: null, error: null }),
  storage: {
    from: (bucket: string) => ({
      createSignedUrl: async (path: string) => {
        signedUrlCalls.push(`${bucket}:${path}`);
        return createSignedUrlImpl(path);
      },
    }),
  },
};

mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin }));

const { signIfStudio, signStudioRefs, PUBLIC_STUDIO_RE } = await import("./orchestrator.server");

const STUDIO_URL =
  "https://proj.supabase.co/storage/v1/object/public/studio/u1/refs/face%201.png?x=1";
const NON_STUDIO_URL = "https://example.com/some/other/image.png";

beforeEach(() => {
  signedUrlCalls.length = 0;
  createSignedUrlImpl = async (path) => ({
    data: { signedUrl: `https://signed.example/${path}` },
    error: null,
  });
});
afterEach(() => {
  /* nothing to restore — supabaseAdmin mock is process-local to this file */
});

describe("PUBLIC_STUDIO_RE", () => {
  it("matches a public studio object URL and captures the path", () => {
    const m = STUDIO_URL.match(PUBLIC_STUDIO_RE);
    expect(m).not.toBeNull();
    expect(m?.[1]).toBe("u1/refs/face%201.png?x=1");
  });

  it("does not match a non-studio URL", () => {
    expect(NON_STUDIO_URL.match(PUBLIC_STUDIO_RE)).toBeNull();
  });
});

describe("signIfStudio", () => {
  it("converts a public studio URL into a signed URL", async () => {
    const out = await signIfStudio(STUDIO_URL);
    expect(out).toBe("https://signed.example/u1/refs/face 1.png");
    // Query string stripped and the path decoded before signing.
    expect(signedUrlCalls).toEqual(["studio:u1/refs/face 1.png"]);
  });

  it("passes a non-studio URL through untouched", async () => {
    const out = await signIfStudio(NON_STUDIO_URL);
    expect(out).toBe(NON_STUDIO_URL);
    expect(signedUrlCalls).toHaveLength(0);
  });

  it("passes null/undefined through untouched", async () => {
    expect(await signIfStudio(undefined)).toBeUndefined();
    expect(await signIfStudio(null)).toBeNull();
  });

  it("falls back to the original URL when signing errors, instead of throwing", async () => {
    createSignedUrlImpl = async () => ({ data: null, error: { message: "not found" } });
    const out = await signIfStudio(STUDIO_URL);
    expect(out).toBe(STUDIO_URL);
  });

  it("falls back to the original URL when signing returns no signedUrl", async () => {
    createSignedUrlImpl = async () => ({ data: null, error: null });
    const out = await signIfStudio(STUDIO_URL);
    expect(out).toBe(STUDIO_URL);
  });
});

describe("signStudioRefs", () => {
  it("signs every studio URL across imageUrls, audioUrl, and videoUrl", async () => {
    const req = {
      kind: "video" as const,
      imageUrls: [STUDIO_URL, NON_STUDIO_URL],
      audioUrl: STUDIO_URL,
      videoUrl: STUDIO_URL,
    };
    const out = await signStudioRefs(req);

    expect(out.imageUrls?.[0]).toBe("https://signed.example/u1/refs/face 1.png");
    expect(out.imageUrls?.[1]).toBe(NON_STUDIO_URL);
    expect(out.audioUrl).toBe("https://signed.example/u1/refs/face 1.png");
    expect(out.videoUrl).toBe("https://signed.example/u1/refs/face 1.png");
    // Original request object must not be mutated.
    expect(req.imageUrls[0]).toBe(STUDIO_URL);
    expect(req.audioUrl).toBe(STUDIO_URL);
    expect(req.videoUrl).toBe(STUDIO_URL);
  });

  it("leaves non-studio refs and a request with no refs untouched", async () => {
    const req = { kind: "image" as const, imageUrls: [NON_STUDIO_URL] };
    const out = await signStudioRefs(req);
    expect(out.imageUrls).toEqual([NON_STUDIO_URL]);
    expect(out.audioUrl).toBeUndefined();
    expect(out.videoUrl).toBeUndefined();
    expect(signedUrlCalls).toHaveLength(0);

    const bare = { kind: "text" as const };
    const outBare = await signStudioRefs(bare);
    expect(outBare).toMatchObject({ kind: "text" });
  });

  it("falls back to original URLs across the whole request when signing fails, without throwing", async () => {
    createSignedUrlImpl = async () => ({ data: null, error: { message: "expired session" } });
    const req = {
      kind: "video" as const,
      imageUrls: [STUDIO_URL],
      audioUrl: STUDIO_URL,
      videoUrl: STUDIO_URL,
    };
    const out = await signStudioRefs(req);
    expect(out.imageUrls?.[0]).toBe(STUDIO_URL);
    expect(out.audioUrl).toBe(STUDIO_URL);
    expect(out.videoUrl).toBe(STUDIO_URL);
  });
});
