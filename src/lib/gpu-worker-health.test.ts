import { describe, expect, it } from "bun:test";
import { normalizeWorkerBase } from "./gpu-worker-health";

// The custom/Vast worker serves its job route at `.../generate` and the
// orchestrator appends `/generate` (dispatch) and `/health` (probe). Operators
// naturally register the full `.../generate` URL, so normalization must strip it
// to avoid `.../generate/generate` and `.../generate/health`.
describe("normalizeWorkerBase", () => {
  it("leaves a bare origin untouched", () => {
    expect(normalizeWorkerBase("https://host:8000")).toBe("https://host:8000");
  });

  it("strips a trailing slash", () => {
    expect(normalizeWorkerBase("https://host:8000/")).toBe("https://host:8000");
  });

  it("strips a trailing /generate so dispatch/health build correct paths", () => {
    expect(normalizeWorkerBase("https://host:8000/generate")).toBe("https://host:8000");
  });

  it("strips a trailing /generate/ (with slash)", () => {
    expect(normalizeWorkerBase("https://host:8000/generate/")).toBe("https://host:8000");
  });

  it("is a no-op for RunPod-style endpoints", () => {
    expect(normalizeWorkerBase("https://api.runpod.ai/v2/abc")).toBe("https://api.runpod.ai/v2/abc");
  });

  it("does not strip a path that merely contains 'generate'", () => {
    expect(normalizeWorkerBase("https://host/generate-images")).toBe("https://host/generate-images");
  });
});
