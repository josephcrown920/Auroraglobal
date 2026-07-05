import { describe, expect, it } from "bun:test";
import {
  getCandidateModels,
  MODEL_REGISTRY,
  resolveModel,
  type GenerateRequest,
} from "./orchestrator.server";

// Self-hosted lip-sync (LatentSync) must route ONLY to the GPU worker pool: no
// cross-model fallback, and the model must be registered as a worker-pool kind.

const base: GenerateRequest = {
  kind: "lipsync",
  videoUrl: "http://example.com/face.mp4",
  audioUrl: "http://example.com/voice.wav",
};

describe("getCandidateModels — selfHostedOnly", () => {
  it("pins to exactly the requested model (no hosted fallbacks)", () => {
    const models = getCandidateModels({ ...base, model: "latentsync", selfHostedOnly: true });
    expect(models).toEqual(["latentsync"]);
  });

  it("returns an empty list when self-hosted but no model is given", () => {
    expect(getCandidateModels({ ...base, selfHostedOnly: true })).toEqual([]);
  });

  it("does NOT mix in the hosted lipsync fallback chain", () => {
    const models = getCandidateModels({ ...base, model: "latentsync", selfHostedOnly: true });
    expect(models).not.toContain("fal-ai/sync-lipsync/v2");
    expect(models).not.toContain("fal-ai/wav2lip");
    expect(models).toHaveLength(1);
  });
});

describe("getCandidateModels — hosted (default) still falls back", () => {
  it("prepends the requested model then the same-kind fallback chain", () => {
    const models = getCandidateModels({ ...base, model: "sync/lipsync-2" });
    expect(models[0]).toBe("sync/lipsync-2");
    expect(models).toContain("fal-ai/sync-lipsync/v2");
    expect(models.length).toBeGreaterThan(1);
  });

  it("caps the lipsync fallback breadth", () => {
    // FALLBACK_CAP.lipsync = 2 → at most 2 candidates total.
    const models = getCandidateModels({ ...base, model: "sync/lipsync-2" });
    expect(models.length).toBeLessThanOrEqual(2);
  });
});

describe("MODEL_REGISTRY — latentsync entry", () => {
  it("is registered as a lipsync model", () => {
    const entry = resolveModel("latentsync");
    expect(entry).not.toBeNull();
    expect(entry?.kind).toBe("lipsync");
  });

  it("routes to the GPU worker provider (not a hosted lipsync provider)", () => {
    const entry = MODEL_REGISTRY["latentsync"];
    expect(entry).toBeDefined();
    // It must NOT be one of the hosted lip-sync providers.
    expect(["heygen", "sync", "fal", "replicate", "huggingface", "lovable", "kling"]).not.toContain(
      entry.provider,
    );
  });
});
