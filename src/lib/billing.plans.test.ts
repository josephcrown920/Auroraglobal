import { describe, expect, it } from "bun:test";
import { DURATION_CAPS, classifyJobQueue, HEAVY_JOB_KINDS, tierFor } from "./billing.plans";

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

  it("classifies standard 1080p video as standard", () => {
    expect(classifyJobQueue("video", { resolution: "1080p" })).toBe("standard");
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
