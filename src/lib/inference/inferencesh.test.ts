// Tests for the inference.sh backend: wire protocol helpers + adapter behavior.
// fetch is stubbed per-test on globalThis and restored afterEach (no mock.module).

import { afterEach, describe, expect, it } from "bun:test";
import {
  extractOutputUrl,
  inferenceShInput,
  normaliseInferenceInput,
  resolveInferenceShApp,
  runInferenceShTask,
} from "./protocols";
import { inferenceshAdapter } from "./providers/inferencesh";
import { adapters } from "./index";
import { dispatchInferenceSh, type WorkerRow } from "../orchestrator.server";

const realFetch = globalThis.fetch;
const ENV_KEYS = [
  "INFERENCE_SH_API_KEY",
  "INFERENCE_SH_BASE_URL",
  "INFERENCE_SH_APP_IMAGE",
  "INFERENCE_SH_APP_VIDEO",
];
const savedEnv: Record<string, string | undefined> = {};
for (const k of ENV_KEYS) savedEnv[k] = process.env[k];

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

type Call = { url: string; init?: RequestInit };

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return calls;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("normaliseInferenceInput", () => {
  it("converts mediaUrl+mode=video to videoUrl", () => {
    const result = normaliseInferenceInput({
      task: "lipsync",
      audioUrl: "https://cdn/audio.wav",
      mediaUrl: "https://cdn/face.mp4",
      mode: "video",
    });
    expect(result.videoUrl).toBe("https://cdn/face.mp4");
    expect(result.mediaUrl).toBeUndefined();
    expect(result.mode).toBeUndefined();
  });

  it("converts mediaUrl+mode=image to imageUrls", () => {
    const result = normaliseInferenceInput({
      task: "lipsync",
      audioUrl: "https://cdn/audio.wav",
      mediaUrl: "https://cdn/face.jpg",
      mode: "image",
    });
    expect(result.imageUrls).toEqual(["https://cdn/face.jpg"]);
    expect(result.mediaUrl).toBeUndefined();
    expect(result.mode).toBeUndefined();
  });

  it("treats unset mode as video", () => {
    const result = normaliseInferenceInput({
      task: "lipsync",
      mediaUrl: "https://cdn/face.mp4",
    });
    expect(result.videoUrl).toBe("https://cdn/face.mp4");
    expect(result.mediaUrl).toBeUndefined();
  });

  it("does not overwrite an existing videoUrl with mediaUrl", () => {
    const result = normaliseInferenceInput({
      task: "lipsync",
      mediaUrl: "https://cdn/legacy.mp4",
      videoUrl: "https://cdn/canonical.mp4",
    });
    expect(result.videoUrl).toBe("https://cdn/canonical.mp4");
    expect(result.mediaUrl).toBeUndefined();
  });

  it("is a no-op when mediaUrl is absent", () => {
    const input = { task: "image" as const, prompt: "a cat", imageUrls: ["https://cdn/ref.png"] };
    expect(normaliseInferenceInput(input)).toEqual(input);
  });
});

describe("resolveInferenceShApp", () => {
  it("prefers the INFERENCE_SH_APP_<TASK> env override", () => {
    expect(resolveInferenceShApp("image", { INFERENCE_SH_APP_IMAGE: "me/my-flux" })).toBe("me/my-flux");
    expect(resolveInferenceShApp("video", { INFERENCE_SH_APP_VIDEO: "me/video-app" })).toBe("me/video-app");
  });

  it("falls back to the documented default for image only", () => {
    expect(resolveInferenceShApp("image", {})).toBe("infsh/flux");
    expect(resolveInferenceShApp("video", {})).toBeUndefined();
    expect(resolveInferenceShApp("lipsync", {})).toBeUndefined();
  });
});

describe("inferenceShInput", () => {
  it("sends conventional fields and lets params win", () => {
    expect(
      inferenceShInput({
        task: "image",
        prompt: "a cat",
        imageUrls: ["https://x/ref.png"],
        params: { prompt: "override", steps: 4 },
      }),
    ).toEqual({ prompt: "override", image_urls: ["https://x/ref.png"], steps: 4 });
  });

  it("omits undefined fields", () => {
    expect(inferenceShInput({ task: "image", prompt: "hi" })).toEqual({ prompt: "hi" });
  });

  it("derives media_url and mode from canonical videoUrl for lipsync tasks", () => {
    // Internal code uses videoUrl (canonical); inferenceShInput derives the
    // wire-compat media_url+mode for old deployed workers automatically.
    expect(
      inferenceShInput({
        task: "lipsync",
        audioUrl: "https://cdn/voice.wav",
        videoUrl: "https://cdn/face.mp4",
      }),
    ).toEqual({
      audio_url: "https://cdn/voice.wav",
      video_url: "https://cdn/face.mp4",
      media_url: "https://cdn/face.mp4",
      mode: "video",
    });
  });

  it("derives media_url and mode from canonical imageUrls for image-mode lipsync", () => {
    expect(
      inferenceShInput({
        task: "lipsync",
        audioUrl: "https://cdn/voice.wav",
        imageUrls: ["https://cdn/face.jpg"],
      }),
    ).toEqual({
      audio_url: "https://cdn/voice.wav",
      image_urls: ["https://cdn/face.jpg"],
      media_url: "https://cdn/face.jpg",
      mode: "image",
    });
  });

  it("params win over derived media_url for lipsync", () => {
    expect(
      inferenceShInput({
        task: "lipsync",
        audioUrl: "https://cdn/audio.wav",
        videoUrl: "https://cdn/face.mp4",
        params: { media_url: "https://cdn/override.mp4" },
      }),
    ).toEqual({
      audio_url: "https://cdn/audio.wav",
      video_url: "https://cdn/face.mp4",
      media_url: "https://cdn/override.mp4",
      mode: "video",
    });
  });
});

describe("runInferenceShTask", () => {
  it("submits to /run and polls /tasks/{id} until Completed", async () => {
    let polls = 0;
    const calls = stubFetch((url) => {
      if (url.endsWith("/run")) return json({ id: "task_1", status: 2 });
      polls++;
      return polls < 2
        ? json({ id: "task_1", status: 7 })
        : json({ id: "task_1", status: 10, output: { image: { uri: "https://cdn.inference.sh/out.png" } } });
    });

    const task = await runInferenceShTask({
      baseUrl: "https://api.inference.sh/",
      token: "inf_test",
      app: "infsh/flux",
      input: { prompt: "a cat" },
      pollMs: 1,
    });

    expect(task.status).toBe(10);
    expect(extractOutputUrl(task.output)).toBe("https://cdn.inference.sh/out.png");
    // Submit call: correct URL, auth + API-version headers, app+input body.
    expect(calls[0].url).toBe("https://api.inference.sh/run");
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer inf_test");
    expect(headers["x-api-version"]).toBe("2");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      app: "infsh/flux",
      input: { prompt: "a cat" },
    });
    // Poll calls hit the task endpoint.
    expect(calls[1].url).toBe("https://api.inference.sh/tasks/task_1");
  });

  it("returns immediately when /run responds already Completed", async () => {
    const calls = stubFetch(() => json({ id: "t", status: 10, output: { url: "https://cdn/x.mp4" } }));
    const task = await runInferenceShTask({
      baseUrl: "https://api.inference.sh",
      token: "inf_test",
      app: "ns/app",
      input: {},
    });
    expect(extractOutputUrl(task.output)).toBe("https://cdn/x.mp4");
    expect(calls.length).toBe(1);
  });

  it("includes setup in the submit body when provided", async () => {
    const calls = stubFetch(() => json({ id: "t", status: 10, output: { url: "https://cdn/x.png" } }));
    await runInferenceShTask({
      baseUrl: "https://api.inference.sh",
      token: "inf_test",
      app: "infsh/flux",
      input: { prompt: "p" },
      setup: { model: "schnell" },
    });
    expect(JSON.parse(String(calls[0].init?.body)).setup).toEqual({ model: "schnell" });
  });

  it("throws the task error on Failed status", async () => {
    stubFetch((url) =>
      url.endsWith("/run")
        ? json({ id: "t", status: 2 })
        : json({ id: "t", status: 11, error: "no active workers with matching resources" }),
    );
    await expect(
      runInferenceShTask({
        baseUrl: "https://api.inference.sh",
        token: "inf_test",
        app: "ns/app",
        input: {},
        pollMs: 1,
      }),
    ).rejects.toThrow(/no active workers/);
  });

  it("throws explicitly on a non-2xx submit", async () => {
    stubFetch(() => new Response("problem", { status: 402 }));
    await expect(
      runInferenceShTask({
        baseUrl: "https://api.inference.sh",
        token: "inf_test",
        app: "ns/app",
        input: {},
      }),
    ).rejects.toThrow(/402/);
  });
});

describe("inferenceshAdapter", () => {
  it("is registered in the dispatcher with INFERENCE_SH_API_KEY gating", () => {
    expect(adapters.inferencesh).toBe(inferenceshAdapter);
    expect(inferenceshAdapter.requiredEnv).toEqual(["INFERENCE_SH_API_KEY"]);
    // Appended last so existing backend precedence is unchanged.
    expect(Object.keys(adapters).at(-1)).toBe("inferencesh");
  });

  it("fails explicitly when the key is missing", async () => {
    delete process.env.INFERENCE_SH_API_KEY;
    await expect(inferenceshAdapter.run({ task: "image", prompt: "x" })).rejects.toThrow(
      /INFERENCE_SH_API_KEY/,
    );
  });

  it("fails explicitly when no app is mapped for the task", async () => {
    process.env.INFERENCE_SH_API_KEY = "inf_test";
    delete process.env.INFERENCE_SH_APP_VIDEO;
    await expect(inferenceshAdapter.run({ task: "video", prompt: "x" })).rejects.toThrow(
      /INFERENCE_SH_APP_VIDEO/,
    );
  });

  it("dispatches through the orchestrator gpu-worker protocol path (lockstep guard)", async () => {
    const worker: WorkerRow = {
      id: "w1",
      name: "infsh-cloud",
      endpoint_url: "https://api.inference.sh",
      auth_token: "inf_worker_key",
      in_flight: 0,
      max_concurrency: 1,
      protocol: "inferencesh",
      runpod_sync: false,
    };
    process.env.INFERENCE_SH_APP_IMAGE = "ns/flux-clone";
    const calls = stubFetch((url) =>
      url.endsWith("/run")
        ? json({ id: "t7", status: 2 })
        : json({ id: "t7", status: 10, output: { image: { uri: "https://cdn/img.png" } } }),
    );

    const payload = await dispatchInferenceSh(
      "https://api.inference.sh",
      worker,
      { kind: "image", prompt: "a fox" } as Parameters<typeof dispatchInferenceSh>[2],
      Date.now() + 30_000,
    );

    expect(extractOutputUrl(payload)).toBe("https://cdn/img.png");
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.app).toBe("ns/flux-clone");
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer inf_worker_key");
  });

  it("dispatch fails explicitly when the worker row has no API key", async () => {
    const worker = {
      id: "w2",
      name: "no-key",
      endpoint_url: "https://api.inference.sh",
      auth_token: null,
      in_flight: 0,
      max_concurrency: 1,
      protocol: "inferencesh",
      runpod_sync: false,
    } satisfies WorkerRow;
    await expect(
      dispatchInferenceSh(
        "https://api.inference.sh",
        worker,
        { kind: "image", prompt: "x" } as Parameters<typeof dispatchInferenceSh>[2],
        Date.now() + 10_000,
      ),
    ).rejects.toThrow(/auth_token/);
  });

  it("runs an app end-to-end and returns the output url", async () => {
    process.env.INFERENCE_SH_API_KEY = "inf_test";
    process.env.INFERENCE_SH_BASE_URL = "https://api.inference.sh";
    const calls = stubFetch((url) =>
      url.endsWith("/run")
        ? json({ id: "t9", status: 2 })
        : json({ id: "t9", status: 10, output: { video: { uri: "https://cdn/out.mp4" } } }),
    );

    process.env.INFERENCE_SH_APP_VIDEO = "ns/video-app";
    const res = await inferenceshAdapter.run({
      task: "video",
      prompt: "a dog",
      params: { setup: { model: "fast" }, fps: 24 },
    });

    expect(res.outputUrl).toBe("https://cdn/out.mp4");
    expect(res.videoUrl).toBe("https://cdn/out.mp4"); // non-image legacy compat field
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.app).toBe("ns/video-app");
    expect(body.setup).toEqual({ model: "fast" }); // params.setup lifted to top-level
    expect(body.input).toEqual({ prompt: "a dog", fps: 24 }); // setup not leaked into input
  });
});
