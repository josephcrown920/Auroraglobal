import { describe, expect, it } from "bun:test";
import {
  DURATION_CAPS,
  classifyJobQueue,
  computeLocalPrice,
  computePaystackPrice,
  durationCapMessage,
  getPppMultiplier,
  HEAVY_JOB_KINDS,
  tierFor,
} from "./billing.plans";

describe("geo-based PPP pricing", () => {
  it("uses the configured PPP discount for eligible countries", () => {
    expect(getPppMultiplier("IN")).toBe(0.4);
    expect(getPppMultiplier("br")).toBe(0.55);
    expect(getPppMultiplier("NG")).toBe(0.35);
  });

  it("leaves unknown, high-income, and missing countries at full price", () => {
    expect(getPppMultiplier("US")).toBe(1);
    expect(getPppMultiplier("XX")).toBe(1);
    expect(getPppMultiplier(null)).toBe(1);
  });

  it("rounds JPY in zero-decimal minor units", () => {
    const price = computeLocalPrice(10_00, "JP");
    expect(price).toMatchObject({ currency: "JPY", amountMinor: 1500, pppMultiplier: 1 });
  });

  it("rounds INR and USD in two-decimal minor units", () => {
    expect(computeLocalPrice(10_00, "IN")).toMatchObject({
      currency: "INR",
      amountMinor: 33_200,
      pppMultiplier: 0.4,
    });
    expect(computeLocalPrice(10_00, "US")).toMatchObject({
      currency: "USD",
      amountMinor: 1_000,
      pppMultiplier: 1,
    });
  });

  it("always returns a chargeable NGN checkout quote while preserving PPP", () => {
    expect(computePaystackPrice(10_00, "IN")).toMatchObject({
      currency: "NGN",
      amountMinor: 620_000,
      pppMultiplier: 0.4,
    });
    expect(computePaystackPrice(10_00, "US")).toMatchObject({
      currency: "NGN",
      amountMinor: 1_550_000,
      pppMultiplier: 1,
    });
  });
});

// ─── DURATION_CAPS ────────────────────────────────────────────────────────────

describe("DURATION_CAPS", () => {
  it("free tier cap is 10s", () => {
    expect(DURATION_CAPS.free).toBe(10);
  });

  it("pro tier cap is 15s", () => {
    expect(DURATION_CAPS.pro).toBe(15);
  });

  it("pro cap is greater than free cap", () => {
    expect(DURATION_CAPS.pro).toBeGreaterThan(DURATION_CAPS.free);
  });

  it("every tier has a positive cap", () => {
    for (const cap of Object.values(DURATION_CAPS)) {
      expect(cap).toBeGreaterThan(0);
    }
  });
});

// ─── durationCapMessage (pure policy behind assertDurationCap) ────────────────

describe("durationCapMessage", () => {
  it("free: 10s allowed, 11s rejected with upgrade hint", () => {
    expect(durationCapMessage("free", 10)).toBeNull();
    const msg = durationCapMessage("free", 11);
    expect(msg).toMatch(/^Unsupported duration/);
    expect(msg).toContain("Starter");
    expect(msg).toContain("10s limit");
    expect(msg).toContain("Upgrade to Pro");
  });

  it("pro: 15s allowed, 16s rejected without upgrade hint", () => {
    expect(durationCapMessage("pro", 15)).toBeNull();
    const msg = durationCapMessage("pro", 16);
    expect(msg).toMatch(/^Unsupported duration/);
    expect(msg).toContain("Pro");
    expect(msg).toContain("15s limit");
    expect(msg).not.toContain("Upgrade");
  });

  it("rejections are TERMINAL (start with 'Unsupported' for TERMINAL_ERROR_RE)", () => {
    expect(durationCapMessage("free", 999)).toMatch(/^Unsupported/);
  });

  it("preview-length renders (≤5s) always clear both tiers", () => {
    expect(durationCapMessage("free", 5)).toBeNull();
    expect(durationCapMessage("pro", 5)).toBeNull();
  });
});

// ─── classifyJobQueue ─────────────────────────────────────────────────────────

describe("classifyJobQueue", () => {
  it("classifies lipsync as heavy", () => {
    expect(classifyJobQueue("lipsync", {})).toBe("heavy");
  });

  it("classifies 4K resolution as heavy regardless of kind", () => {
    expect(classifyJobQueue("video", { resolution: "4K" })).toBe("heavy");
    expect(classifyJobQueue("image", { resolution: "4K" })).toBe("heavy");
  });

  it("classifies 2160p (ultra-HD) as heavy", () => {
    expect(classifyJobQueue("video", { resolution: "2160p" })).toBe("heavy");
  });

  it("classifies reshoot batches as heavy", () => {
    expect(classifyJobQueue("reshoot", {})).toBe("heavy");
  });

  it("classifies multi_angle as heavy", () => {
    expect(classifyJobQueue("multi_angle", {})).toBe("heavy");
  });

  it("classifies HD 1080p video as heavy", () => {
    expect(classifyJobQueue("video", { resolution: "1080p" })).toBe("heavy");
  });

  it("classifies 4K 2160p video as heavy", () => {
    expect(classifyJobQueue("video", { resolution: "2160p" })).toBe("heavy");
  });

  it("classifies standard 720p video as standard", () => {
    expect(classifyJobQueue("video", { resolution: "720p" })).toBe("standard");
  });

  it("classifies image generation as standard", () => {
    expect(classifyJobQueue("image", {})).toBe("standard");
  });

  it("classifies text generation as standard", () => {
    expect(classifyJobQueue("text", {})).toBe("standard");
  });

  it("classifies audio as standard", () => {
    expect(classifyJobQueue("audio", {})).toBe("standard");
  });

  it("classifies unknown kinds with no heavy payload as standard", () => {
    expect(classifyJobQueue("kids_story", {})).toBe("standard");
    expect(classifyJobQueue("autocut", {})).toBe("standard");
  });
});

// ─── HEAVY_JOB_KINDS ─────────────────────────────────────────────────────────

describe("HEAVY_JOB_KINDS", () => {
  it("includes lipsync", () => {
    expect(HEAVY_JOB_KINDS.has("lipsync")).toBe(true);
  });

  it("does not include standard video", () => {
    expect(HEAVY_JOB_KINDS.has("video")).toBe(false);
  });

  it("does not include image", () => {
    expect(HEAVY_JOB_KINDS.has("image")).toBe(false);
  });
});

// ─── tierFor ─────────────────────────────────────────────────────────────────

describe("tierFor", () => {
  it("returns pro for plan='pro'", () => {
    expect(tierFor("pro")).toBe("pro");
  });

  it("returns free for null", () => {
    expect(tierFor(null)).toBe("free");
  });

  it("returns free for undefined", () => {
    expect(tierFor(undefined)).toBe("free");
  });

  it("returns free for unknown plan string", () => {
    expect(tierFor("enterprise")).toBe("free");
    expect(tierFor("basic")).toBe("free");
  });
});
