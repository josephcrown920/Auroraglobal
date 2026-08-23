// Task #275 — HeyGen Template API ("Aurora Template") unit tests.
// Fetch is mocked via globalThis.fetch (NOT mock.module — heygen.server.ts is
// imported real by sibling suites; see the SDK fetch-mocking convention).
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  buildTemplateGeneratePayload,
  mergeCharacterVariable,
  submitHeyGenTemplateVideo,
  HeyGenTemplateVariablesSchema,
  HeyGenTemplateCharacterVariableSchema,
  type HeyGenTemplateVariables,
  type HeyGenTemplateVariable,
} from "./heygen.server";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const fixedVars: HeyGenTemplateVariables = {
  headline: { name: "headline", type: "text", properties: { content: "Big summer sale" } },
  scene_bg: {
    name: "scene_bg",
    type: "image",
    properties: { url: "https://example.com/bg.png", fit: "cover" },
  },
  presenter: {
    name: "presenter",
    type: "character",
    properties: { type: "avatar", character_id: "avatar_default" },
  },
};

const altCharacter: HeyGenTemplateVariable = {
  name: "whatever_the_caller_said",
  type: "character",
  properties: { type: "talking_photo", character_id: "tp_123", voice_id: "voice_9" },
};

describe("mergeCharacterVariable", () => {
  test("swaps ONLY the character slot; fixed variables are untouched", () => {
    const merged = mergeCharacterVariable(fixedVars, "presenter", altCharacter);
    expect(merged.headline).toEqual(fixedVars.headline);
    expect(merged.scene_bg).toEqual(fixedVars.scene_bg);
    expect(merged.presenter.type).toBe("character");
    expect(
      (merged.presenter as Extract<HeyGenTemplateVariable, { type: "character" }>).properties
        .character_id,
    ).toBe("tp_123");
  });

  test("forces the variable name to the slot key (no stray variables)", () => {
    const merged = mergeCharacterVariable(fixedVars, "presenter", altCharacter);
    expect(merged.presenter.name).toBe("presenter");
  });

  test("does not mutate the input fixed variables", () => {
    const before = JSON.parse(JSON.stringify(fixedVars));
    mergeCharacterVariable(fixedVars, "presenter", altCharacter);
    expect(fixedVars).toEqual(before);
  });

  test("two different characters produce identical fixed variables", () => {
    const other: HeyGenTemplateVariable = {
      name: "x",
      type: "character",
      properties: { type: "avatar", character_id: "avatar_b" },
    };
    const a = mergeCharacterVariable(fixedVars, "presenter", altCharacter);
    const b = mergeCharacterVariable(fixedVars, "presenter", other);
    const { presenter: _pa, ...fixedA } = a;
    const { presenter: _pb, ...fixedB } = b;
    expect(fixedA).toEqual(fixedB);
    expect(a.presenter).not.toEqual(b.presenter);
  });
});

describe("buildTemplateGeneratePayload", () => {
  test("normalizes names, defaults title/caption, omits absent options", () => {
    const payload = buildTemplateGeneratePayload({
      mismatched: { ...fixedVars.headline, name: "WRONG" },
    });
    expect(payload.title).toBe("Aurora Template");
    expect(payload.caption).toBe(false);
    const vars = payload.variables as HeyGenTemplateVariables;
    expect(vars.mismatched.name).toBe("mismatched");
    expect(payload).not.toHaveProperty("dimension");
    expect(payload).not.toHaveProperty("scene_ids");
    expect(payload).not.toHaveProperty("fps");
  });

  test("includes dimension/scene_ids/fps when provided", () => {
    const payload = buildTemplateGeneratePayload(fixedVars, {
      title: "Batch run",
      caption: true,
      dimension: { width: 720, height: 1280 },
      sceneIds: ["scene_1"],
      fps: 30,
    });
    expect(payload.title).toBe("Batch run");
    expect(payload.caption).toBe(true);
    expect(payload.dimension).toEqual({ width: 720, height: 1280 });
    expect(payload.scene_ids).toEqual(["scene_1"]);
    expect(payload.fps).toBe(30);
  });
});

describe("HeyGenTemplateVariablesSchema", () => {
  test("accepts every documented variable type", () => {
    const parsed = HeyGenTemplateVariablesSchema.parse({
      t: { name: "t", type: "text", properties: { content: "hi" } },
      i: { name: "i", type: "image", properties: { url: "https://x.com/a.png" } },
      v: { name: "v", type: "video", properties: { url: "https://x.com/a.mp4", play_style: "loop" } },
      a: { name: "a", type: "audio", properties: { asset_id: "asset_1" } },
      vo: { name: "vo", type: "voice", properties: { voice_id: "voice_1" } },
      c: { name: "c", type: "character", properties: { type: "avatar", character_id: "av_1" } },
    });
    expect(Object.keys(parsed)).toHaveLength(6);
  });

  test("rejects unknown variable types", () => {
    expect(() =>
      HeyGenTemplateVariablesSchema.parse({
        bad: { name: "bad", type: "hologram", properties: {} },
      }),
    ).toThrow();
  });
});

describe("HeyGenTemplateCharacterVariableSchema (per-run character swaps)", () => {
  test("accepts a character variable", () => {
    const parsed = HeyGenTemplateCharacterVariableSchema.parse({
      name: "presenter",
      type: "character",
      properties: { type: "talking_photo", character_id: "tp_1" },
    });
    expect(parsed.type).toBe("character");
  });

  test("rejects non-character variables (text/image can't be a character swap)", () => {
    expect(() =>
      HeyGenTemplateCharacterVariableSchema.parse({
        name: "presenter",
        type: "text",
        properties: { content: "not a character" },
      }),
    ).toThrow();
    expect(() =>
      HeyGenTemplateCharacterVariableSchema.parse({
        name: "presenter",
        type: "image",
        properties: { url: "https://x.com/a.png" },
      }),
    ).toThrow();
  });
});

describe("submitHeyGenTemplateVideo", () => {
  let originalHeygenApiKey: string | undefined;

  beforeEach(() => {
    originalHeygenApiKey = process.env.HEYGEN_API_KEY;
    process.env.HEYGEN_API_KEY = "test-key";
  });

  afterEach(() => {
    if (originalHeygenApiKey === undefined) delete process.env.HEYGEN_API_KEY;
    else process.env.HEYGEN_API_KEY = originalHeygenApiKey;
  });

  test("POSTs to /v2/template/{id}/generate and returns the video_id", async () => {
    let captured: { url: string; body: Record<string, unknown> } | null = null;
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      captured = { url: String(url), body: JSON.parse(String(init?.body)) };
      return new Response(JSON.stringify({ data: { video_id: "vid_42" } }), { status: 200 });
    }) as typeof fetch;

    const { videoId } = await submitHeyGenTemplateVideo("tpl abc", fixedVars, {
      dimension: { width: 720, height: 1280 },
    });
    expect(videoId).toBe("vid_42");
    const got = captured!;
    expect(got.url).toBe("https://api.heygen.com/v2/template/tpl%20abc/generate");
    expect(got.body.dimension).toEqual({ width: 720, height: 1280 });
    expect((got.body.variables as HeyGenTemplateVariables).presenter.name).toBe("presenter");
  });

  test("throws with status + body slice on HTTP error", async () => {
    globalThis.fetch = (async () =>
      new Response("template not found", { status: 404 })) as typeof fetch;
    await expect(submitHeyGenTemplateVideo("nope", {})).rejects.toThrow(
      /HeyGen template generate failed \[404\].*template not found/,
    );
  });

  test("throws when the response has no video_id", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ data: {} }), { status: 200 })) as typeof fetch;
    await expect(submitHeyGenTemplateVideo("tpl", {})).rejects.toThrow(/no video_id/);
  });

  test("rejects an empty templateId before any network call", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    await expect(submitHeyGenTemplateVideo("  ", {})).rejects.toThrow(/templateId is required/);
    expect(called).toBe(false);
  });
});
