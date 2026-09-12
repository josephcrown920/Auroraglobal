import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  segmindSeedanceMini,
  SEGMIND_SEEDANCE_MINI_ENDPOINT,
  SEGMIND_SEEDANCE_MINI_USE_CASES,
} from "./segmind.server";

const realFetch = globalThis.fetch;
const savedKey = process.env.SEGMIND_API_KEY;

describe("segmind Seedance 2 Mini", () => {
  beforeEach(() => {
    process.env.SEGMIND_API_KEY = "test-segmind-key";
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    if (savedKey === undefined) delete process.env.SEGMIND_API_KEY;
    else process.env.SEGMIND_API_KEY = savedKey;
  });

  it("sends the production defaults and records x-cost", async () => {
    let body: Record<string, unknown> | undefined;
    globalThis.fetch = mock(async (input, init) => {
      expect(input).toBe(SEGMIND_SEEDANCE_MINI_ENDPOINT);
      expect(new Headers(init?.headers).get("x-api-key")).toBe("test-segmind-key");
      body = JSON.parse(String(init?.body));
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "x-cost": "0.190575", "x-request-id": "req-123" },
      });
    }) as typeof fetch;

    const result = await segmindSeedanceMini({ prompt: "test product shot" });

    expect(body).toMatchObject({
      prompt: "test product shot",
      duration: 5,
      resolution: "480p",
      aspect_ratio: "16:9",
      generate_audio: true,
      seed: 42,
    });
    expect(result.cost).toBe(0.190575);
    expect(result.costHeader).toBe("x-cost");
    expect(result.requestId).toBe("req-123");
    expect(await result.video.arrayBuffer()).toHaveLength(3);
  });

  it("accepts the legacy x-credit-cost header without inventing spend", async () => {
    globalThis.fetch = mock(async () =>
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: { "x-credit-cost": "0.42" },
      }),
    ) as typeof fetch;

    const result = await segmindSeedanceMini({ prompt: "test" });
    expect(result.cost).toBe(0.42);
    expect(result.costHeader).toBe("x-credit-cost");
  });

  it("keeps the supplied production parameters intact", async () => {
    let body: Record<string, unknown> | undefined;
    globalThis.fetch = mock(async (_input, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(new Uint8Array([1]), { status: 200 });
    }) as typeof fetch;

    const preset = SEGMIND_SEEDANCE_MINI_USE_CASES.verticalProductAds;
    await segmindSeedanceMini({
      prompt: preset.prompt,
      duration: preset.duration,
      resolution: preset.resolution,
      aspect_ratio: preset.aspectRatio,
      generate_audio: preset.generateAudio,
    });

    expect(body).toMatchObject({
      duration: 5,
      resolution: "720p",
      aspect_ratio: "9:16",
      generate_audio: true,
    });
  });

  it("fails clearly when the provider rejects the request", async () => {
    globalThis.fetch = mock(async () =>
      new Response("invalid request", { status: 400 }),
    ) as typeof fetch;

    await expect(segmindSeedanceMini({ prompt: "test" })).rejects.toThrow(
      "Segmind Seedance 2 Mini 400",
    );
  });
});
