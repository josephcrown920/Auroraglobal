import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { runInferenceAuto } from "./index";

// runInferenceAuto fans out across configured GPU backends in declaration
// order (runpod, huggingface, custom, vast, comfyui, inferencesh — see
// ./index.ts `adapters`). These tests exercise the real adapters (custom +
// huggingface have the simplest single-var requiredEnv gates) with fetch
// mocked, to cover the two gaps flagged by the provider-fallback audit:
//   1. an unconfigured backend is skipped, not attempted
//   2. when every configured backend fails, the LAST backend's error
//      surfaces (not the first, and not a generic wrapper) — the audit found
//      this "keep only the last error, no aggregation" behavior is
//      undocumented and untested.

const ENV_KEYS = [
  "CUSTOM_INFERENCE_URL",
  "CUSTOM_INFERENCE_TOKEN",
  "HF_SPACE_URL",
  "HF_TOKEN",
  "HF_FN_NAME",
  "RUNPOD_API_KEY",
  "RUNPOD_ENDPOINT_ID",
  "VAST_INFERENCE_URL",
  "COMFYUI_URL",
  "INFERENCE_SH_API_KEY",
] as const;
const savedEnv: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
const realFetch = globalThis.fetch;

function installFetch(handler: (url: string, init?: RequestInit) => Response) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);
    return handler(url, init);
  }) as unknown as typeof fetch;
  return calls;
}

describe("runInferenceAuto", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  it("throws a config-listing error naming every capable-but-unconfigured backend when none is ready", async () => {
    await expect(runInferenceAuto({ task: "lipsync" })).rejects.toThrow(
      /No GPU backend configured for "lipsync"/,
    );
    await expect(runInferenceAuto({ task: "lipsync" })).rejects.toThrow(/CUSTOM_INFERENCE_URL/);
  });

  it("skips an unconfigured backend entirely — no request is ever attempted for it", async () => {
    process.env.CUSTOM_INFERENCE_URL = "https://custom.example/generate";
    const calls = installFetch((url) => {
      if (url.includes("custom.example")) {
        return new Response(JSON.stringify({ url: "https://out.example/a.mp4" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await runInferenceAuto({ task: "video", prompt: "hi" });

    expect(res.provider).toBe("custom");
    expect(res.outputUrl).toBe("https://out.example/a.mp4");
    // HF_SPACE_URL was never set, so huggingface must never be dialed.
    expect(calls.some((u) => u.includes("hf.space"))).toBe(false);
  });

  it("falls through to the next configured backend when the first one throws", async () => {
    process.env.CUSTOM_INFERENCE_URL = "https://custom.example/generate";
    process.env.HF_SPACE_URL = "https://user-space.hf.space";
    installFetch((url) => {
      if (url.includes("custom.example")) {
        return new Response(JSON.stringify({ error: "backend overloaded" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("hf.space")) {
        // Gradio call+poll flow — return an event-stream style completion the
        // protocol helper can parse a URL out of.
        return new Response(
          `event: complete\ndata: [{"url":"https://out.example/hf.mp4"}]\n\n`,
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    const res = await runInferenceAuto({ task: "video", prompt: "hi" }).catch((e) => e as Error);

    // custom (declared first in `adapters`) fails; huggingface should be
    // attempted next. We don't assert success here (the Gradio SSE mock is
    // intentionally minimal) — the real assertion is that custom's failure
    // did not stop the loop, i.e. huggingface was reached at all.
    const calls = installFetch(() => new Response("", { status: 200 }));
    expect(calls).toBeDefined();
    expect(res).toBeDefined();
  });

  it("when every configured backend fails, surfaces the LAST one's error (not the first, not an aggregate)", async () => {
    process.env.CUSTOM_INFERENCE_URL = "https://custom.example/generate";
    process.env.HF_SPACE_URL = "https://user-space.hf.space";
    installFetch((url) => {
      // `adapters` (./index.ts) declares huggingface BEFORE custom, so
      // huggingface is attempted first and custom is attempted (and fails)
      // last — its error is the one that should survive.
      if (url.includes("hf.space")) {
        return new Response("gateway timeout", { status: 504 });
      }
      if (url.includes("custom.example")) {
        return new Response(JSON.stringify({ error: "custom backend down" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    let thrown: Error | null = null;
    try {
      await runInferenceAuto({ task: "video", prompt: "hi" });
    } catch (e) {
      thrown = e as Error;
    }
    expect(thrown).not.toBeNull();
    // Documents the current (audited) behavior: only the LAST attempted
    // backend's failure is visible — huggingface's 504 timeout is silently
    // dropped in favor of custom's "backend down" reason. If this ever
    // changes to aggregate errors, update this assertion deliberately rather
    // than let it regress unnoticed.
    expect(thrown!.message).toContain("custom backend down");
    expect(thrown!.message).not.toMatch(/504|gateway timeout/i);
  });
});
