import { describe, expect, it } from "bun:test";
import {
  emptyPerformanceWorkflow,
  parsePerformanceWorkflow,
} from "./performance-workflow";

describe("performance workflow persistence", () => {
  it("defaults Colors to a monochrome studio", () => {
    const draft = emptyPerformanceWorkflow("colors");
    expect(draft.colorId).toBe("obsidian");
    expect(draft.mode).toBe("colors");
  });

  it("round-trips an independently approved plate and preview ticket", () => {
    const draft = emptyPerformanceWorkflow();
    draft.widePlate = { url: "https://example.com/wide.jpg", generationId: "gen-wide", approved: true };
    draft.wideClip = { generationId: "motion-wide", jobId: "job-wide", previewId: "motion-wide" };
    expect(parsePerformanceWorkflow(JSON.parse(JSON.stringify(draft)))).toEqual(draft);
  });

  it("rejects malformed persisted data", () => {
    expect(parsePerformanceWorkflow({ version: 1, mode: "colors" })).toBeNull();
    expect(parsePerformanceWorkflow({ ...emptyPerformanceWorkflow(), widePlate: { url: "x" } })).toBeNull();
    expect(parsePerformanceWorkflow({ ...emptyPerformanceWorkflow(), step: Number.NaN })).toBeNull();
  });
});