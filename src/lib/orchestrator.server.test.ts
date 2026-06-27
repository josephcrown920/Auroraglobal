import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  dispatchCustom,
  dispatchRunpod,
  extractWorkerUrl,
  legacyCustomUrl,
  type GenerateRequest,
  type WorkerRow,
} from "./orchestrator.server";

// ─── Test helpers ────────────────────────────────────────────────────────────

const baseReq: GenerateRequest = {
  kind: "image",
  prompt: "a cat",
  imageUrls: ["http://example.com/ref.png"],
  model: "some-model",
  duration: 5,
  resolution: "720p",
};

function makeWorker(overrides: Partial<WorkerRow> = {}): WorkerRow {
  return {
    id: "w1",
    name: "worker-1",
    endpoint_url: "https://api.runpod.ai/v2/abc",
    auth_token: null,
    in_flight: 0,
    max_concurrency: 1,
    protocol: "runpod",
    runpod_sync: false,
    ...overrides,
  };
}

type FetchCall = { url: string; init: RequestInit | undefined };

/** A fake Response covering just the surface the code touches: ok/status/json/text. */
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

/**
 * Install a fake fetch driven by a handler. Records every call so tests can
 * assert on URL/method/body. Handler receives the call index + parsed url.
 */
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

// ─── Deterministic fast clock ────────────────────────────────────────────────
// dispatchRunpod's poll loop sleeps RUNPOD_POLL_MS (2.5s) between polls and is
// bounded by a deadline. Real timers would make these tests slow/flaky, so we
// replace setTimeout with one that advances a virtual Date.now() by the
// requested delay and fires the callback on the next macrotask. This keeps the
// deadline math intact while running instantly.
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

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// ─── extractWorkerUrl ─────────────────────────────────────────────────────────

describe("extractWorkerUrl", () => {
  it("returns a bare http string", () => {
    expect(extractWorkerUrl("http://example.com/a.png")).toBe("http://example.com/a.png");
    expect(extractWorkerUrl("https://example.com/a.png")).toBe("https://example.com/a.png");
  });

  it("rejects a non-http bare string", () => {
    expect(extractWorkerUrl("/relative/path.png")).toBeUndefined();
    expect(extractWorkerUrl("not a url")).toBeUndefined();
  });

  it("finds the http url inside an array", () => {
    expect(extractWorkerUrl(["nope", "/rel.png", "http://example.com/x.png"])).toBe(
      "http://example.com/x.png",
    );
  });

  it("reads a top-level url field", () => {
    expect(extractWorkerUrl({ url: "http://example.com/u.png" })).toBe("http://example.com/u.png");
  });

  it("reads a top-level output_url field", () => {
    expect(extractWorkerUrl({ output_url: "http://example.com/o.png" })).toBe(
      "http://example.com/o.png",
    );
  });

  it("unwraps a nested RunPod output object", () => {
    expect(extractWorkerUrl({ output: { image_url: "http://example.com/n.png" } })).toBe(
      "http://example.com/n.png",
    );
  });

  it("unwraps a nested RunPod output array", () => {
    expect(extractWorkerUrl({ output: ["http://example.com/arr.mp4"] })).toBe(
      "http://example.com/arr.mp4",
    );
  });

  it("ignores non-http values in known url fields", () => {
    expect(extractWorkerUrl({ url: "/relative/only.png" })).toBeUndefined();
  });

  it("returns undefined when there is no url", () => {
    expect(extractWorkerUrl({ foo: "bar" })).toBeUndefined();
    expect(extractWorkerUrl({ output: { status: "done" } })).toBeUndefined();
    expect(extractWorkerUrl(null)).toBeUndefined();
    expect(extractWorkerUrl(undefined)).toBeUndefined();
    expect(extractWorkerUrl(42)).toBeUndefined();
  });
});

// ─── legacyCustomUrl ──────────────────────────────────────────────────────────

describe("legacyCustomUrl", () => {
  it("returns a relative url string", () => {
    expect(legacyCustomUrl({ url: "/files/out.png" })).toBe("/files/out.png");
  });

  it("falls back to output_url", () => {
    expect(legacyCustomUrl({ output_url: "result/123.png" })).toBe("result/123.png");
  });

  it("returns undefined for missing/empty/non-object", () => {
    expect(legacyCustomUrl({ foo: "bar" })).toBeUndefined();
    expect(legacyCustomUrl({ url: "" })).toBeUndefined();
    expect(legacyCustomUrl("http://example.com")).toBeUndefined();
    expect(legacyCustomUrl(null)).toBeUndefined();
  });
});

// ─── dispatchCustom (legacy /generate) ────────────────────────────────────────

describe("dispatchCustom", () => {
  it("POSTs a flat body to /generate and resolves a relative url", async () => {
    const { calls } = installFetch(() => fakeResponse({ json: { url: "/files/out.png" } }));
    const w = makeWorker({ protocol: "custom", auth_token: "secret" });

    const payload = await dispatchCustom(
      "https://worker.example.com",
      w,
      baseReq,
      Date.now() + 60_000,
    );

    // legacy workers may return a relative url; extractWorkerUrl rejects it but
    // legacyCustomUrl preserves it.
    expect(extractWorkerUrl(payload)).toBeUndefined();
    expect(legacyCustomUrl(payload)).toBe("/files/out.png");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://worker.example.com/generate");
    expect(calls[0].init?.method).toBe("POST");

    const body = JSON.parse(calls[0].init!.body as string);
    // flat body — NOT wrapped under `input`
    expect(body.input).toBeUndefined();
    expect(body).toMatchObject({
      kind: "image",
      prompt: "a cat",
      image_urls: ["http://example.com/ref.png"],
      model: "some-model",
      duration: 5,
      resolution: "720p",
    });

    const headers = calls[0].init!.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer secret");
  });

  it("throws on a non-200 response", async () => {
    installFetch(() => fakeResponse({ ok: false, status: 503 }));
    const w = makeWorker({ protocol: "custom" });
    await expect(
      dispatchCustom("https://worker.example.com", w, baseReq, Date.now() + 60_000),
    ).rejects.toThrow(/503/);
  });
});

// ─── dispatchRunpod ───────────────────────────────────────────────────────────

describe("dispatchRunpod", () => {
  beforeEach(() => installFakeClock());
  afterEach(() => restoreClock());

  it("runsync: returns output and wraps body under input", async () => {
    const { calls } = installFetch(() =>
      fakeResponse({ json: { status: "COMPLETED", output: { image_url: "http://cdn/x.png" } } }),
    );
    const w = makeWorker({ runpod_sync: true, auth_token: "tok" });

    const payload = await dispatchRunpod(
      "https://api.runpod.ai/v2/abc",
      w,
      baseReq,
      Date.now() + 60_000,
    );

    expect(extractWorkerUrl(payload)).toBe("http://cdn/x.png");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.runpod.ai/v2/abc/runsync");

    const body = JSON.parse(calls[0].init!.body as string);
    expect(body.input).toMatchObject({ kind: "image", prompt: "a cat" });
    const headers = calls[0].init!.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer tok");
  });

  it("runsync: throws on a FAILED status", async () => {
    installFetch(() => fakeResponse({ json: { status: "FAILED", error: "oom" } }));
    const w = makeWorker({ runpod_sync: true });
    await expect(
      dispatchRunpod("https://api.runpod.ai/v2/abc", w, baseReq, Date.now() + 60_000),
    ).rejects.toThrow(/FAILED|oom/);
  });

  it("async /run: resolves immediately when the submit response is already COMPLETED", async () => {
    const { calls } = installFetch(() =>
      fakeResponse({ json: { status: "COMPLETED", output: { url: "http://cdn/done.png" } } }),
    );
    const w = makeWorker();

    const payload = await dispatchRunpod(
      "https://api.runpod.ai/v2/abc",
      w,
      baseReq,
      Date.now() + 60_000,
    );

    expect(extractWorkerUrl(payload)).toBe("http://cdn/done.png");
    expect(calls).toHaveLength(1); // no polling needed
    expect(calls[0].url).toBe("https://api.runpod.ai/v2/abc/run");
  });

  it("async /run + poll: COMPLETED success after a few IN_PROGRESS polls", async () => {
    const { calls } = installFetch(({ url, index }) => {
      if (url.endsWith("/run"))
        return fakeResponse({ json: { id: "job-123", status: "IN_QUEUE" } });
      // /status/job-123
      if (index <= 2) return fakeResponse({ json: { status: "IN_PROGRESS" } });
      return fakeResponse({
        json: { status: "COMPLETED", output: { video_url: "http://cdn/v.mp4" } },
      });
    });
    const w = makeWorker();

    const payload = await dispatchRunpod(
      "https://api.runpod.ai/v2/abc",
      w,
      baseReq,
      Date.now() + 60_000,
    );
    expect(extractWorkerUrl(payload)).toBe("http://cdn/v.mp4");

    expect(calls[0].url).toBe("https://api.runpod.ai/v2/abc/run");
    expect(calls[1].url).toBe("https://api.runpod.ai/v2/abc/status/job-123");
  });

  it("async /run: throws when no job id is returned", async () => {
    installFetch(() => fakeResponse({ json: { status: "IN_QUEUE" } })); // no id, not completed
    const w = makeWorker();
    await expect(
      dispatchRunpod("https://api.runpod.ai/v2/abc", w, baseReq, Date.now() + 60_000),
    ).rejects.toThrow(/no job id/);
  });

  it.each(["FAILED", "CANCELLED", "TIMED_OUT"])(
    "async poll: throws on terminal status %s",
    async (status: string) => {
      installFetch(({ url }) => {
        if (url.endsWith("/run"))
          return fakeResponse({ json: { id: "job-x", status: "IN_QUEUE" } });
        return fakeResponse({ json: { status, error: "boom" } });
      });
      const w = makeWorker();
      await expect(
        dispatchRunpod("https://api.runpod.ai/v2/abc", w, baseReq, Date.now() + 60_000),
      ).rejects.toThrow(new RegExp(status));
    },
  );

  it("async poll: keeps polling through a non-200 /status, then succeeds", async () => {
    let statusCalls = 0;
    installFetch(({ url }) => {
      if (url.endsWith("/run")) return fakeResponse({ json: { id: "job-9", status: "IN_QUEUE" } });
      statusCalls += 1;
      if (statusCalls === 1) return fakeResponse({ ok: false, status: 502 });
      return fakeResponse({ json: { status: "COMPLETED", output: { url: "http://cdn/ok.png" } } });
    });
    const w = makeWorker();

    const payload = await dispatchRunpod(
      "https://api.runpod.ai/v2/abc",
      w,
      baseReq,
      Date.now() + 60_000,
    );
    expect(extractWorkerUrl(payload)).toBe("http://cdn/ok.png");
    expect(statusCalls).toBe(2); // first poll 502 -> kept polling
  });

  it("async poll: keeps polling through a /status exception, then succeeds", async () => {
    let statusCalls = 0;
    const fn = mock((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/run")) {
        return Promise.resolve(fakeResponse({ json: { id: "job-7", status: "IN_QUEUE" } }));
      }
      statusCalls += 1;
      if (statusCalls === 1) return Promise.reject(new Error("network down"));
      return Promise.resolve(
        fakeResponse({ json: { status: "COMPLETED", output: { url: "http://cdn/r.png" } } }),
      );
    });
    globalThis.fetch = fn as unknown as typeof fetch;
    const w = makeWorker();

    const payload = await dispatchRunpod(
      "https://api.runpod.ai/v2/abc",
      w,
      baseReq,
      Date.now() + 60_000,
    );
    expect(extractWorkerUrl(payload)).toBe("http://cdn/r.png");
    expect(statusCalls).toBe(2); // first poll threw -> kept polling
  });

  it("async poll: throws a timeout once the deadline passes", async () => {
    installFetch(({ url }) => {
      if (url.endsWith("/run"))
        return fakeResponse({ json: { id: "job-loop", status: "IN_QUEUE" } });
      return fakeResponse({ json: { status: "IN_PROGRESS" } }); // never completes
    });
    const w = makeWorker();
    // small deadline window; the fake clock advances ~2.5s per poll, so this
    // terminates after a handful of iterations.
    await expect(
      dispatchRunpod("https://api.runpod.ai/v2/abc", w, baseReq, Date.now() + 10_000),
    ).rejects.toThrow(/poll timeout/);
  });
});
