import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  bytePlusBaseUrl,
  bytePlusImage,
  bytePlusVideo,
  BytePlusError,
  getBytePlusKey,
} from "./byteplus.server";
import { classifyJobError } from "./jobs.server";

// ─── fetch + clock helpers ────────────────────────────────────────────────────

function fakeResponse(opts: {
  ok?: boolean;
  status?: number;
  json?: unknown;
  text?: string;
  headers?: Record<string, string>;
}): Response {
  const status = opts.status ?? (opts.ok === false ? 500 : 200);
  const headers = opts.headers ?? {};
  return {
    ok: opts.ok ?? (status >= 200 && status < 300),
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => opts.json,
    text: async () => opts.text ?? "",
  } as unknown as Response;
}

type Call = { url: string; init?: RequestInit };
function installFetch(
  handler: (call: { url: string; init?: RequestInit; index: number }) => Response,
) {
  const calls: Call[] = [];
  const fn = mock((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    return Promise.resolve(handler({ url, init, index: calls.length - 1 }));
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return { calls };
}

// setTimeout in the video poller must not actually sleep in tests.
const realSetTimeout = globalThis.setTimeout;
function installFastClock() {
  globalThis.setTimeout = ((cb: (...a: unknown[]) => void) =>
    realSetTimeout(cb, 0)) as unknown as typeof setTimeout;
}

const realFetch = globalThis.fetch;
const ENV = ["BYTEPLUS_API_KEY", "ARK_API_KEY", "BYTEPLUS_BASE_URL", "ARK_BASE_URL"] as const;
const saved: Record<string, string | undefined> = {};
for (const k of ENV) saved[k] = process.env[k];

describe("byteplus.server — key + base URL resolution", () => {
  beforeEach(() => {
    for (const k of ENV) delete process.env[k];
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    globalThis.setTimeout = realSetTimeout;
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("reads BYTEPLUS_API_KEY then falls back to ARK_API_KEY", () => {
    expect(getBytePlusKey()).toBeUndefined();
    process.env.ARK_API_KEY = "ark-key";
    expect(getBytePlusKey()).toBe("ark-key");
    process.env.BYTEPLUS_API_KEY = "bp-key";
    expect(getBytePlusKey()).toBe("bp-key"); // BYTEPLUS wins
  });

  it("defaults the base URL and strips a trailing slash from an override", () => {
    expect(bytePlusBaseUrl()).toContain("ark.ap-southeast.bytepluses.com");
    process.env.BYTEPLUS_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3/";
    expect(bytePlusBaseUrl()).toBe("https://ark.cn-beijing.volces.com/api/v3");
  });

  it("throws (not silently no-ops) when no key is configured", async () => {
    installFetch(() => fakeResponse({ json: { data: [{ url: "x" }] } }));
    await expect(bytePlusImage({ model: "m", prompt: "hi" })).rejects.toThrow(/missing/i);
  });
});

describe("byteplus.server — image", () => {
  beforeEach(() => {
    for (const k of ENV) delete process.env[k];
    process.env.BYTEPLUS_API_KEY = "bp-key";
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("POSTs to /images/generations with a bearer key and returns data[0].url", async () => {
    const { calls } = installFetch(({ url }) => {
      expect(url).toContain("/images/generations");
      return fakeResponse({ json: { data: [{ url: "https://cdn.byteplus/img.png" }] } });
    });
    const url = await bytePlusImage({ model: "seedream-4-0-250828", prompt: "a fox" });
    expect(url).toBe("https://cdn.byteplus/img.png");
    const init = calls[0].init!;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer bp-key");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("seedream-4-0-250828");
    expect(body.prompt).toBe("a fox");
    expect(body.image).toBeUndefined(); // no reference image
  });

  it("passes a single reference image as a string and multiple as an array", async () => {
    let seen: unknown;
    installFetch(({ init }) => {
      seen = JSON.parse((init as RequestInit).body as string).image;
      return fakeResponse({ json: { data: [{ url: "https://cdn/x.png" }] } });
    });
    await bytePlusImage({ model: "m", prompt: "p", imageUrls: ["https://a/1.png"] });
    expect(seen).toBe("https://a/1.png");
    await bytePlusImage({
      model: "m",
      prompt: "p",
      imageUrls: ["https://a/1.png", "https://a/2.png"],
    });
    expect(seen).toEqual(["https://a/1.png", "https://a/2.png"]);
  });

  it("surfaces HTTP failures as BytePlusError carrying status + retry-after", async () => {
    installFetch(() =>
      fakeResponse({
        ok: false,
        status: 429,
        text: "rate limited",
        headers: { "retry-after": "7" },
      }),
    );
    const err = (await bytePlusImage({ model: "m", prompt: "p" }).catch((e) => e)) as BytePlusError;
    expect(err).toBeInstanceOf(BytePlusError);
    expect(err.status).toBe(429);
    expect(err.retryAfterMs).toBe(7000);
  });

  it("preserves only a bounded allowlist-safe structured provider error code", async () => {
    installFetch(() =>
      fakeResponse({
        ok: false,
        status: 403,
        text: JSON.stringify({
          error: {
            code: "AccountOverdueError",
            message: "secret provider detail bp-key",
          },
        }),
      }),
    );
    const err = (await bytePlusImage({ model: "m", prompt: "p" }).catch((e) => e)) as Error;
    expect(err.message).toContain("HTTP 403 (AccountOverdueError)");
    expect(err.message).not.toContain("secret provider detail");
    expect(err.message).not.toContain("bp-key");

    installFetch(() =>
      fakeResponse({
        ok: false,
        status: 403,
        text: JSON.stringify({ error: { code: "unsafe code with key=bp-key" } }),
      }),
    );
    const unsafe = (await bytePlusImage({ model: "m", prompt: "p" }).catch((e) => e)) as Error;
    expect(unsafe.message).toBe("BytePlus image failed with HTTP 403");
  });

  it("makes code-less invalid image requests terminal without leaking their body", async () => {
    for (const status of [400, 413, 415, 422]) {
      const { calls } = installFetch(() =>
        fakeResponse({ ok: false, status, text: "private validation details and input URLs" }),
      );
      const err = (await bytePlusImage({ model: "m", prompt: "p" }).catch((e) => e)) as Error;
      expect(err.message).toContain("Invalid request");
      expect(err.message).not.toContain("private validation");
      expect(classifyJobError(err.message)).toBe("terminal");
      expect(calls).toHaveLength(1);
    }
  });

  it("keeps rate limits and 5xx image failures transient", async () => {
    for (const status of [429, 500, 503]) {
      const { calls } = installFetch(() =>
        fakeResponse({ ok: false, status, text: "temporary private provider detail" }),
      );
      const err = (await bytePlusImage({ model: "m", prompt: "p" }).catch((e) => e)) as Error;
      expect(classifyJobError(err.message)).toBe("transient");
      expect(calls).toHaveLength(1);
    }
  });

  it("retries once with ARK only after a definitive 401", async () => {
    process.env.ARK_API_KEY = "ark-key";
    const { calls } = installFetch(({ index }) =>
      index === 0
        ? fakeResponse({ ok: false, status: 401, text: "invalid credential" })
        : fakeResponse({ json: { data: [{ url: "https://cdn/ark.png" }] } }),
    );

    await expect(bytePlusImage({ model: "m", prompt: "p" })).resolves.toBe(
      "https://cdn/ark.png",
    );
    expect(calls).toHaveLength(2);
    expect((calls[0].init!.headers as Record<string, string>).Authorization).toBe("Bearer bp-key");
    expect((calls[1].init!.headers as Record<string, string>).Authorization).toBe("Bearer ark-key");
  });

  it("does not retry a billable image submission on 403, 5xx, or transport failure", async () => {
    process.env.ARK_API_KEY = "ark-key";
    for (const status of [403, 503]) {
      const { calls } = installFetch(() =>
        fakeResponse({ ok: false, status, text: "do not expose this provider body" }),
      );
      const err = (await bytePlusImage({ model: "m", prompt: "p" }).catch((e) => e)) as Error;
      expect(calls).toHaveLength(1);
      expect(err.message).not.toContain("do not expose");
    }

    const calls: string[] = [];
    globalThis.fetch = mock(() => {
      calls.push("called");
      return Promise.reject(new Error("timeout"));
    }) as unknown as typeof fetch;
    await expect(bytePlusImage({ model: "m", prompt: "p" })).rejects.toThrow("timeout");
    expect(calls).toHaveLength(1);
  });

  it("throws when the response has no output url (explicit, not empty string)", async () => {
    installFetch(() => fakeResponse({ json: { data: [] } }));
    await expect(bytePlusImage({ model: "m", prompt: "p" })).rejects.toThrow(/no output url/i);
  });
});

describe("byteplus.server — video (create + poll)", () => {
  beforeEach(() => {
    for (const k of ENV) delete process.env[k];
    process.env.BYTEPLUS_API_KEY = "bp-key";
    installFastClock();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    globalThis.setTimeout = realSetTimeout;
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("creates a task, polls until succeeded, and returns the video_url", async () => {
    const { calls } = installFetch(({ url, index }) => {
      if (index === 0) {
        expect(url).toContain("/contents/generations/tasks");
        return fakeResponse({ json: { id: "task_123" } });
      }
      if (index === 1) return fakeResponse({ json: { status: "running" } });
      return fakeResponse({
        json: { status: "succeeded", content: { video_url: "https://cdn/v.mp4" } },
      });
    });
    const url = await bytePlusVideo({
      model: "seedance-1-0-pro-250528",
      prompt: "a dragon",
      imageUrls: ["https://a/first.png"],
      duration: 5,
      resolution: "720p",
      pollIntervalMs: 1,
    });
    expect(url).toBe("https://cdn/v.mp4");
    // create body: prompt flags + image content part
    const createBody = JSON.parse(calls[0].init!.body as string);
    const textPart = createBody.content.find((c: { type: string }) => c.type === "text");
    expect(textPart.text).toContain("--resolution 720p");
    expect(textPart.text).toContain("--duration 5");
    const imgPart = createBody.content.find((c: { type: string }) => c.type === "image_url");
    expect(imgPart.image_url.url).toBe("https://a/first.png");
    // poll URL includes the task id
    expect(calls[2].url).toContain("task_123");
  });

  it("retries a 401 create with ARK and pins polling to the successful credential", async () => {
    process.env.ARK_API_KEY = "ark-key";
    const { calls } = installFetch(({ index }) => {
      if (index === 0) return fakeResponse({ ok: false, status: 401, text: "rejected" });
      if (index === 1) return fakeResponse({ json: { id: "ark_task" } });
      return fakeResponse({
        json: { status: "succeeded", content: { video_url: "https://cdn/ark.mp4" } },
      });
    });

    await expect(
      bytePlusVideo({ model: "m", prompt: "p", pollIntervalMs: 1 }),
    ).resolves.toBe("https://cdn/ark.mp4");
    expect(calls).toHaveLength(3);
    expect((calls[0].init!.headers as Record<string, string>).Authorization).toBe("Bearer bp-key");
    expect((calls[1].init!.headers as Record<string, string>).Authorization).toBe("Bearer ark-key");
    expect((calls[2].init!.headers as Record<string, string>).Authorization).toBe("Bearer ark-key");
  });

  it("does not retry video submission for unsafe statuses", async () => {
    process.env.ARK_API_KEY = "ark-key";
    for (const status of [403, 500]) {
      const { calls } = installFetch(() =>
        fakeResponse({ ok: false, status, text: "possibly accepted" }),
      );
      await expect(
        bytePlusVideo({ model: "m", prompt: "p", pollIntervalMs: 1 }),
      ).rejects.toBeInstanceOf(BytePlusError);
      expect(calls).toHaveLength(1);
    }
  });

  it("does not switch credentials when polling the created task", async () => {
    process.env.ARK_API_KEY = "ark-key";
    const { calls } = installFetch(({ index }) =>
      index === 0
        ? fakeResponse({ json: { id: "bp_task" } })
        : fakeResponse({ ok: false, status: 401, text: "not authorized" }),
    );

    await expect(
      bytePlusVideo({ model: "m", prompt: "p", pollIntervalMs: 1 }),
    ).rejects.toBeInstanceOf(BytePlusError);
    expect(calls).toHaveLength(2);
    expect((calls[1].init!.headers as Record<string, string>).Authorization).toBe("Bearer bp-key");
  });

  it("preserves a safe structured error code from create and poll failures", async () => {
    installFetch(() =>
      fakeResponse({
        ok: false,
        status: 403,
        text: JSON.stringify({ error: { code: "ModelNotOpen", message: "private detail" } }),
      }),
    );
    await expect(
      bytePlusVideo({ model: "m", prompt: "p", pollIntervalMs: 1 }),
    ).rejects.toThrow("HTTP 403 (ModelNotOpen)");

    installFetch(({ index }) =>
      index === 0
        ? fakeResponse({ json: { id: "t1" } })
        : fakeResponse({
            ok: false,
            status: 403,
            text: JSON.stringify({ error: { code: "TaskAccessDenied", message: "private" } }),
          }),
    );
    await expect(
      bytePlusVideo({ model: "m", prompt: "p", pollIntervalMs: 1 }),
    ).rejects.toThrow("HTTP 403 (TaskAccessDenied)");
  });

  it("makes code-less 422 video creation terminal through orchestrator-style wrapping", async () => {
    const { calls } = installFetch(() =>
      fakeResponse({ ok: false, status: 422, text: "private invalid control details" }),
    );
    const err = (await bytePlusVideo({
      model: "m",
      prompt: "p",
      pollIntervalMs: 1,
    }).catch((e) => e)) as Error;
    const wrapped = `No video provider available right now (last: ${err.message})`;
    expect(err.message).toContain("Invalid request");
    expect(err.message).not.toContain("private invalid control");
    expect(classifyJobError(wrapped)).toBe("terminal");
    expect(calls).toHaveLength(1);
  });

  it("keeps 429 and 5xx video creation transient and never retries submission", async () => {
    for (const status of [429, 500, 503]) {
      const { calls } = installFetch(() =>
        fakeResponse({ ok: false, status, text: "temporary private provider detail" }),
      );
      const err = (await bytePlusVideo({
        model: "m",
        prompt: "p",
        pollIntervalMs: 1,
      }).catch((e) => e)) as Error;
      expect(classifyJobError(err.message)).toBe("transient");
      expect(calls).toHaveLength(1);
    }
  });

  it("throws BytePlusError when the task ends failed", async () => {
    installFetch(({ index }) =>
      index === 0
        ? fakeResponse({ json: { id: "t1" } })
        : fakeResponse({ json: { status: "failed", error: { message: "content moderated" } } }),
    );
    await expect(bytePlusVideo({ model: "m", prompt: "p", pollIntervalMs: 1 })).rejects.toThrow(
      /failed: content moderated/i,
    );
  });

  it("keeps polling through a transient 5xx and still resolves", async () => {
    installFetch(({ index }) => {
      if (index === 0) return fakeResponse({ json: { id: "t1" } });
      if (index === 1) return fakeResponse({ ok: false, status: 503, text: "unavailable" });
      return fakeResponse({
        json: { status: "succeeded", content: { video_url: "https://cdn/ok.mp4" } },
      });
    });
    const url = await bytePlusVideo({ model: "m", prompt: "p", pollIntervalMs: 1 });
    expect(url).toBe("https://cdn/ok.mp4");
  });
});
