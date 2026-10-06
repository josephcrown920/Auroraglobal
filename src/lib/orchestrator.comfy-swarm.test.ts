import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  dispatchComfyui,
  extractWorkerUrl,
  type GenerateRequest,
  type WorkerRow,
} from "./orchestrator.server";
import {
  FLUX2_IMAGE_WORKFLOW,
  LTX23_I2V_WORKFLOW,
  LTX23_T2V_WORKFLOW,
  SVD_I2V_WORKFLOW,
} from "./comfy-default-workflows.server";

// Task #85: a plain image/video request carries no comfyWorkflow, yet must run on
// a ComfyUI swarm worker. dispatchComfyui builds the default graph by kind and
// submits it to /prompt. These tests exercise that dispatch directly (no supabase
// mock needed) so they don't entangle with the orchestrate()-level mocks in
// orchestrator.gpu-preference.test.ts — bun's mock.module is process-global.

const COMFY = "https://comfy.example.com";

function makeWorker(overrides: Partial<WorkerRow> = {}): WorkerRow {
  return {
    id: "w-comfy",
    name: "kaggle-comfy",
    endpoint_url: COMFY,
    auth_token: null,
    in_flight: 0,
    max_concurrency: 1,
    protocol: "comfyui",
    runpod_sync: false,
    ...overrides,
  };
}

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

type FetchCall = { url: string; body: unknown };

function installFetch(handler: (url: string) => Response) {
  const calls: FetchCall[] = [];
  const fn = mock((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    let body: unknown;
    if (typeof init?.body === "string") {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    calls.push({ url, body });
    return Promise.resolve(handler(url));
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return { calls };
}

// runComfyWorkflow polls /history with setTimeout sleeps bounded by the deadline.
// A virtual clock keeps the poll loop instant while preserving the deadline math.
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
  restoreClock();
});

/** Drive a comfyui dispatch: /prompt → one finished /history poll → /view URL. */
function runDispatch(req: GenerateRequest, workerOverrides: Partial<WorkerRow> = {}) {
  installFakeClock();
  const { calls } = installFetch((url) => {
    if (url.endsWith("/prompt")) return fakeResponse({ json: { prompt_id: "p1" } });
    // GET /history/p1 — a finished job with one image output.
    return fakeResponse({
      json: {
        p1: {
          outputs: { "7": { images: [{ filename: "out.png", subfolder: "", type: "output" }] } },
        },
      },
    });
  });
  return { calls, promise: dispatchComfyui(COMFY, makeWorker(workerOverrides), req, Date.now() + 60_000) };
}

describe("dispatchComfyui — free-GPU swarm default graphs (Task #85)", () => {
  it("image: builds the SDXL graph, patches the prompt, and resolves a /view url", async () => {
    const { calls, promise } = runDispatch({
      kind: "image",
      prompt: "a red fox",
      resolution: "720p",
    });
    const payload = await promise;

    expect(extractWorkerUrl(payload)).toBe(
      "https://comfy.example.com/view?filename=out.png&subfolder=&type=output",
    );
    expect(calls[0].url).toBe("https://comfy.example.com/prompt");
    expect(calls[1].url).toBe("https://comfy.example.com/history/p1");

    // The submitted graph is the SDXL contract with our prompt patched in.
    const submitted = (
      calls[0].body as {
        prompt: Record<string, { class_type: string; inputs: Record<string, unknown> }>;
      }
    ).prompt;
    expect(Object.keys(submitted)).toEqual(Object.keys(FLUX2_IMAGE_WORKFLOW));
    expect(submitted["1"].class_type).toBe("UNETLoader");
    expect(submitted["4"].inputs.text).toBe("a red fox");
    expect(submitted["8"].inputs.width).toBe(1024);
  });

  it("video: image-to-video patches the LoadImageFromUrl node with the input still", async () => {
    const { calls, promise } = runDispatch({
      kind: "video",
      prompt: "drift",
      imageUrls: ["https://cdn.example.com/still.png"],
    });
    await promise;

    const submitted = (
      calls[0].body as {
        prompt: Record<string, { class_type: string; inputs: Record<string, unknown> }>;
      }
    ).prompt;
    expect(Object.keys(submitted)).toEqual(Object.keys(LTX23_I2V_WORKFLOW));
    expect(submitted["19"].class_type).toBe("LoadImageFromUrl");
    expect(submitted["19"].inputs.url).toBe("https://cdn.example.com/still.png");
  });

  it("video: text-to-video uses the AnimateDiff graph when no input still is given", async () => {
    const { calls, promise } = runDispatch({ kind: "video", prompt: "a comet streaking" });
    await promise;

    const submitted = (
      calls[0].body as {
        prompt: Record<string, { class_type: string; inputs: Record<string, unknown> }>;
      }
    ).prompt;
    expect(Object.keys(submitted)).toEqual(Object.keys(LTX23_T2V_WORKFLOW));
    expect(submitted["1"].class_type).toBe("CheckpointLoaderSimple");
    expect(submitted["3"].inputs.text).toBe("a comet streaking");
  });

  it("video: legacy image-to-video dispatch submits the SVD graph", async () => {
    const { calls, promise } = runDispatch(
      { kind: "video", imageUrls: ["https://cdn.example.com/still.png"] },
      { capabilities: ["video", "comfy:video:legacy:i2v"] },
    );
    await promise;
    const submitted = (
      calls[0].body as { prompt: Record<string, { class_type: string; inputs: Record<string, unknown> }> }
    ).prompt;
    expect(Object.keys(submitted)).toEqual(Object.keys(SVD_I2V_WORKFLOW));
    expect(submitted["1"].class_type).toBe("ImageOnlyCheckpointLoader");
    expect(submitted["2"].inputs.url).toBe("https://cdn.example.com/still.png");
  });

  it("request-supplied comfyInputs override the defaults", async () => {
    const { calls, promise } = runDispatch({
      kind: "image",
      prompt: "a fox",
      comfyInputs: { "4.text": "overridden" },
    });
    await promise;
    const submitted = (
      calls[0].body as { prompt: Record<string, { inputs: Record<string, unknown> }> }
    ).prompt;
    expect(submitted["4"].inputs.text).toBe("overridden");
  });

  it("explicit comfyWorkflow on the request is used verbatim (no default built)", async () => {
    installFakeClock();
    const { calls } = installFetch((url) => {
      if (url.endsWith("/prompt")) return fakeResponse({ json: { prompt_id: "p1" } });
      return fakeResponse({
        json: {
          p1: {
            outputs: { "9": { images: [{ filename: "x.png", subfolder: "", type: "output" }] } },
          },
        },
      });
    });
    const req: GenerateRequest = {
      kind: "image",
      prompt: "a fox",
      comfyWorkflow: { "1": { class_type: "KSampler", inputs: {} } },
    };
    await dispatchComfyui(COMFY, makeWorker(), req, Date.now() + 60_000);
    const submitted = (calls[0].body as { prompt: Record<string, unknown> }).prompt;
    expect(Object.keys(submitted)).toEqual(["1"]);
  });
});
