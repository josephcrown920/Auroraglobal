import { describe, expect, it } from "bun:test";
import { classifyArkProbe, diffCatalog, ARK_ANTICIPATED, type CatalogEntry } from "./model-watch.server";
import { VIDEO_MODEL_TIERS } from "./pricing";
import { VIDEO_MODEL_LIST } from "./models";

describe("classifyArkProbe", () => {
  it("classifies ModelNotOpen as not_open (account has not activated the model)", () => {
    expect(
      classifyArkProbe(404, {
        error: { code: "ModelNotOpen", message: "Your account has not activated…", type: "Not Found" },
      }),
    ).toBe("not_open");
  });

  it("classifies InvalidEndpointOrModel.NotFound as not_found (dead slug)", () => {
    expect(
      classifyArkProbe(404, { error: { code: "InvalidEndpointOrModel.NotFound", message: "…" } }),
    ).toBe("not_found");
  });

  it("classifies param-level rejections as open (the model resolved)", () => {
    expect(classifyArkProbe(400, { error: { code: "InvalidParameter", message: "content required" } })).toBe("open");
    expect(classifyArkProbe(400, { error: { code: "MissingParameter.Content" } })).toBe("open");
  });

  it("classifies a 2xx as open", () => {
    expect(classifyArkProbe(200, { id: "task-123" })).toBe("open");
  });

  it("classifies garbage / unknown codes as error", () => {
    expect(classifyArkProbe(500, null)).toBe("error");
    expect(classifyArkProbe(429, { error: { code: "RateLimitExceeded" } })).toBe("error");
  });
});

describe("diffCatalog", () => {
  const entry = (provider: "fal" | "replicate", id: string): CatalogEntry => ({
    provider,
    model_id: id,
    title: id,
    category: null,
    meta: {},
  });

  it("returns only unseen entries and dedups within the batch", () => {
    const existing = new Set(["fal:a", "replicate:x"]);
    const found = [entry("fal", "a"), entry("fal", "b"), entry("fal", "b"), entry("replicate", "x")];
    const fresh = diffCatalog(existing, found);
    expect(fresh.map((e) => e.model_id)).toEqual(["b"]);
  });

  it("treats the same id on different providers as distinct", () => {
    const existing = new Set(["fal:same"]);
    const fresh = diffCatalog(existing, [entry("replicate", "same")]);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].provider).toBe("replicate");
  });
});

describe("seedance-2.5 registration", () => {
  it("is priced in the max video tier (never free — fal route ≈$2.37/clip exceeds ultra's pool)", () => {
    expect(VIDEO_MODEL_TIERS["seedance-2.5"]).toBe("max");
  });

  it("is selectable in VIDEO_MODEL_LIST with preview status and a unique endpoint", () => {
    const meta = VIDEO_MODEL_LIST.find((m) => m.value === "seedance-2.5");
    expect(meta).toBeDefined();
    expect(meta?.status).toBe("preview");
    const endpoints = VIDEO_MODEL_LIST.map((m) => m.endpoint);
    expect(endpoints.filter((e) => e === meta?.endpoint)).toHaveLength(1);
  });

  it("is on the ModelArk anticipated watchlist so activation gets noticed", () => {
    const entry = ARK_ANTICIPATED.find((a) => a.auroraKey === "seedance-2.5");
    expect(entry?.modelId).toBe("dreamina-seedance-2-5-260628");
  });
});
