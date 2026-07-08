import { afterEach, describe, expect, it } from "bun:test";
import {
  StartInput,
  anglesForStyle,
  styledFallback,
  generateConcepts,
  CUT_STYLES,
} from "./tiktok-remix.functions";

// The TikTok Remix Factory caps cuts at 10. The UI slider enforces this, but
// the server-side zod validator (StartInput) is the real safeguard: each cut
// reserves COST_TIKTOK_REMIX_CUT Aura, so a direct call asking for more than 10 must be rejected
// before any credits are reserved. These tests pin that cap so it can't quietly
// regress.

const VALID_URL = "https://example.com/source.mp4";

describe("StartInput.count — cut cap enforcement", () => {
  it("defaults to 10 when count is omitted", () => {
    const parsed = StartInput.parse({ sourceVideoUrl: VALID_URL });
    expect(parsed.count).toBe(10);
  });

  it("accepts every valid count from 1 through 10", () => {
    for (let n = 1; n <= 10; n++) {
      const parsed = StartInput.parse({ sourceVideoUrl: VALID_URL, count: n });
      expect(parsed.count).toBe(n);
    }
  });

  it("rejects counts above the cap (11 and 30)", () => {
    expect(() => StartInput.parse({ sourceVideoUrl: VALID_URL, count: 11 })).toThrow();
    expect(() => StartInput.parse({ sourceVideoUrl: VALID_URL, count: 30 })).toThrow();
  });

  it("rejects counts below 1", () => {
    expect(() => StartInput.parse({ sourceVideoUrl: VALID_URL, count: 0 })).toThrow();
    expect(() => StartInput.parse({ sourceVideoUrl: VALID_URL, count: -5 })).toThrow();
  });

  it("rejects non-integer counts", () => {
    expect(() => StartInput.parse({ sourceVideoUrl: VALID_URL, count: 5.5 })).toThrow();
  });

  it("safeParse reports success false for an over-cap count", () => {
    const result = StartInput.safeParse({ sourceVideoUrl: VALID_URL, count: 30 });
    expect(result.success).toBe(false);
  });
});

describe("StartInput — source video url validation", () => {
  it("requires a valid sourceVideoUrl", () => {
    expect(() => StartInput.parse({ sourceVideoUrl: "not-a-url", count: 5 })).toThrow();
    expect(() => StartInput.parse({ count: 5 })).toThrow();
  });
});

describe("StartInput.style — cut-style selection", () => {
  it("defaults to auto when style is omitted (unchanged default behavior)", () => {
    const parsed = StartInput.parse({ sourceVideoUrl: VALID_URL });
    expect(parsed.style).toBe("auto");
  });

  it("accepts every supported style", () => {
    for (const s of CUT_STYLES) {
      const parsed = StartInput.parse({ sourceVideoUrl: VALID_URL, style: s });
      expect(parsed.style).toBe(s);
    }
  });

  it("rejects an unknown style", () => {
    expect(() => StartInput.parse({ sourceVideoUrl: VALID_URL, style: "nope" })).toThrow();
  });
});

describe("anglesForStyle — deterministic fallback pools", () => {
  it("returns a distinct, themed pool for each style", () => {
    for (const s of CUT_STYLES) {
      const pool = anglesForStyle(s);
      // Must be able to cover the full 10-cut cap deterministically.
      expect(pool.length).toBeGreaterThanOrEqual(10);
      // No duplicate angles within a pool (each cut should be unique).
      expect(new Set(pool).size).toBe(pool.length);
    }
  });

  it("biases urban_cut and grwm away from the default auto pool", () => {
    const auto = anglesForStyle("auto");
    const urban = anglesForStyle("urban_cut");
    const grwm = anglesForStyle("grwm");
    expect(urban).not.toEqual(auto);
    expect(grwm).not.toEqual(auto);
    expect(urban).not.toEqual(grwm);
  });

  it("urban_cut reads as a beat-synced outfit/runway showcase", () => {
    const text = anglesForStyle("urban_cut").join(" ").toLowerCase();
    expect(text).toContain("beat");
    expect(text).toContain("runway");
    expect(text).toContain("outfit");
  });

  it("grwm reads as a getting-ready mirror/reveal arc", () => {
    const text = anglesForStyle("grwm").join(" ").toLowerCase();
    expect(text).toContain("mirror");
    expect(text).toContain("outfit");
    expect(text).toContain("reveal");
  });
});

describe("styledFallback — deterministic concepts honor the chosen style", () => {
  it("returns exactly `count` prompts, each prefixed with the base prompt", () => {
    const out = styledFallback("base brief", 4, "urban_cut");
    expect(out.length).toBe(4);
    for (const p of out) expect(p.startsWith("base brief. ")).toBe(true);
  });

  it("defaults to the auto pool when style is omitted (unchanged behavior)", () => {
    const auto = styledFallback("brief", 5);
    const explicitAuto = styledFallback("brief", 5, "auto");
    expect(auto).toEqual(explicitAuto);
  });

  it("draws urban_cut and grwm from their own pools, not the auto pool", () => {
    const auto = styledFallback("brief", 6, "auto");
    const urban = styledFallback("brief", 6, "urban_cut");
    const grwm = styledFallback("brief", 6, "grwm");
    expect(urban).not.toEqual(auto);
    expect(grwm).not.toEqual(auto);
    expect(urban).not.toEqual(grwm);
  });

  it("never exceeds the requested count even at the 10-cut cap", () => {
    for (const s of CUT_STYLES) {
      expect(styledFallback("brief", 10, s).length).toBe(10);
    }
  });
});

// generateConcepts uses the AI gateway when LOVABLE_API_KEY is set, but must
// fall back to the STYLE-specific deterministic pool — not the generic auto pool
// — whenever that call is unavailable (gateway throws, non-200, or malformed
// JSON). These tests drive the real fallback path with a stubbed fetch + key.
describe("generateConcepts — style-specific fallback when the AI path fails", () => {
  const realFetch = globalThis.fetch;
  const realKey = process.env.LOVABLE_API_KEY;
  const BRIEF = "neon city pop brief";
  const COUNT = 6;

  afterEach(() => {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.LOVABLE_API_KEY;
    else process.env.LOVABLE_API_KEY = realKey;
  });

  it("uses the styled pool (not auto) when the gateway throws", async () => {
    process.env.LOVABLE_API_KEY = "test-key";
    globalThis.fetch = (() => {
      throw new Error("gateway down");
    }) as typeof fetch;
    const out = await generateConcepts(VALID_URL, BRIEF, COUNT, "urban_cut");
    expect(out).toEqual(styledFallback(BRIEF, COUNT, "urban_cut"));
    expect(out).not.toEqual(styledFallback(BRIEF, COUNT, "auto"));
  });

  it("uses the styled pool when the gateway returns a non-200", async () => {
    process.env.LOVABLE_API_KEY = "test-key";
    globalThis.fetch = (async () => ({ ok: false, status: 500 })) as unknown as typeof fetch;
    const out = await generateConcepts(VALID_URL, BRIEF, COUNT, "grwm");
    expect(out).toEqual(styledFallback(BRIEF, COUNT, "grwm"));
    expect(out).not.toEqual(styledFallback(BRIEF, COUNT, "auto"));
  });

  it("uses the styled pool when the gateway returns malformed JSON", async () => {
    process.env.LOVABLE_API_KEY = "test-key";
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "not json at all" } }] }),
    })) as unknown as typeof fetch;
    const out = await generateConcepts(VALID_URL, BRIEF, COUNT, "urban_cut");
    expect(out).toEqual(styledFallback(BRIEF, COUNT, "urban_cut"));
  });

  it("returns the AI cuts verbatim when the gateway responds with a valid array", async () => {
    process.env.LOVABLE_API_KEY = "test-key";
    const cuts = ["cut one", "cut two", "cut three"];
    globalThis.fetch = (async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(cuts) } }] }),
    })) as unknown as typeof fetch;
    const out = await generateConcepts(VALID_URL, BRIEF, COUNT, "urban_cut");
    expect(out).toEqual(cuts);
  });
});
