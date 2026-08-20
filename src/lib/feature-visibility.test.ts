import { describe, expect, test } from "bun:test";

import {
  FEATURE_KEYS,
  GATEABLE_FEATURES,
  defaultHiddenKeys,
  featureKeyForRoute,
  featureKeyForTemplate,
  isFeatureKey,
  parseOverrides,
  resolveHiddenKeys,
} from "./feature-visibility";
import { STUDIO_TEMPLATES } from "./template-studio";

describe("artist-only defaults", () => {
  test("TikTok30 stays visible while audience-specific features are hidden by default", () => {
    expect(defaultHiddenKeys().sort()).toEqual(
      FEATURE_KEYS.filter((key) => key !== "spin").sort(),
    );
  });

  test("registry keys are unique", () => {
    expect(new Set(FEATURE_KEYS).size).toBe(FEATURE_KEYS.length);
  });

  test("all gated routes are absolute paths", () => {
    for (const f of GATEABLE_FEATURES) {
      for (const r of f.routes) expect(r.startsWith("/")).toBe(true);
    }
  });
});

describe("override resolution", () => {
  test("visible override removes the key from the hidden set", () => {
    const hidden = resolveHiddenKeys({ spin: true, ugc: true });
    expect(hidden).not.toContain("spin");
    expect(hidden).not.toContain("ugc");
    expect(hidden).toContain("kids");
  });

  test("explicit hidden override keeps the key hidden", () => {
    expect(resolveHiddenKeys({ spin: false })).toContain("spin");
  });

  test("null/empty overrides fall back to defaults", () => {
    expect(resolveHiddenKeys(null)).toEqual(defaultHiddenKeys());
    expect(resolveHiddenKeys({})).toEqual(defaultHiddenKeys());
  });
});

describe("parseOverrides (untrusted store value)", () => {
  test("drops unknown keys and non-boolean values", () => {
    expect(
      parseOverrides({ spin: true, bogus: true, ugc: "yes", kids: false }),
    ).toEqual({ spin: true, kids: false });
  });

  test("non-object values fail safe to {}", () => {
    expect(parseOverrides(null)).toEqual({});
    expect(parseOverrides("x")).toEqual({});
    expect(parseOverrides([1, 2])).toEqual({});
    expect(parseOverrides(42)).toEqual({});
  });
});

describe("route matching", () => {
  test("exact and nested paths match; unrelated prefixes do not", () => {
    expect(featureKeyForRoute("/ugc")).toBe("ugc");
    expect(featureKeyForRoute("/ugc/campaign/1")).toBe("ugc");
    expect(featureKeyForRoute("/ugc-line")).toBe("content-line"); // not a /ugc prefix hit
    expect(featureKeyForRoute("/content")).toBe("content-funnel");
    expect(featureKeyForRoute("/content-machine")).toBe("content-machine");
    expect(featureKeyForRoute("/spin")).toBe("spin");
    expect(featureKeyForRoute("/creator/dashboard")).toBe("creator-hub");
    expect(featureKeyForRoute("/avatar")).toBe("talking-avatars");
    expect(featureKeyForRoute("/heygen-templates")).toBe("heygen-templates");
    expect(featureKeyForRoute("/kids")).toBe("kids");
    expect(featureKeyForRoute("/nexusarb")).toBe("nexusarb");
    expect(featureKeyForRoute("/split-reality")).toBe("split-reality");
    expect(featureKeyForRoute("/eromify")).toBe("adult-school");
    expect(featureKeyForRoute("/aurora-adult")).toBe("adult-school");
    expect(featureKeyForRoute("/aurora-adult/")).toBe("adult-school");
  });

  test("ungated core artist routes are not matched", () => {
    for (const p of ["/", "/studio", "/motion", "/lipsync", "/colors", "/templates", "/gallery", "/canvas", "/video-agent", "/edit", "/marketplace"]) {
      expect(featureKeyForRoute(p)).toBeNull();
    }
  });
});

describe("template matching", () => {
  test("known gated templates map to their features", () => {
    const byId = (id: string) => STUDIO_TEMPLATES.find((t) => t.id === id)!;
    expect(featureKeyForTemplate(byId("grwm-reel"))).toBe("grwm");
    for (const id of ["viral-spin", "trend-remix-spin"]) {
      expect(featureKeyForTemplate(byId(id))).toBe("spin");
    }
    for (const id of ["kids-storybook", "kids-bedtime"]) {
      expect(featureKeyForTemplate(byId(id))).toBe("kids");
    }
  });

  test("every ugc-dispatch template is gated (grwm-reel by grwm, the rest by ugc)", () => {
    for (const t of STUDIO_TEMPLATES.filter((t) => t.dispatch === "ugc")) {
      expect(featureKeyForTemplate(t)).toBe(t.id === "grwm-reel" ? "grwm" : "ugc");
    }
  });

  test("core artist templates stay ungated", () => {
    const ungated = STUDIO_TEMPLATES.filter((t) => featureKeyForTemplate(t) === null);
    // The bulk of the catalog must remain visible in artist-only mode.
    expect(ungated.length).toBeGreaterThan(20);
    for (const t of ungated) {
      expect(t.dispatch).not.toBe("spin");
      expect(t.dispatch).not.toBe("ugc");
      expect(t.category).not.toBe("Kids");
    }
  });
});

describe("isFeatureKey", () => {
  test("accepts registry keys, rejects everything else", () => {
    expect(isFeatureKey("spin")).toBe(true);
    expect(isFeatureKey("adult-school")).toBe(true);
    expect(isFeatureKey("bogus")).toBe(false);
    expect(isFeatureKey(3)).toBe(false);
    expect(isFeatureKey(null)).toBe(false);
  });
});
