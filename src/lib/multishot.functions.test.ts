import { describe, expect, it } from "vitest";
import {
  assertExactTemporalBinding,
  isMultishotLeaseActive,
  multishotDigest,
} from "./multishot.functions";

describe("multishot approval digests", () => {
  it("is stable across object key ordering", () => {
    expect(multishotDigest({ b: 2, a: ["x", { d: 4, c: 3 }] }))
      .toBe(multishotDigest({ a: ["x", { c: 3, d: 4 }], b: 2 }));
  });

  it("changes when an input or exact preview changes", () => {
    const base = { prompt: "shot", engine: "google", previewGenerationId: "one" };
    expect(multishotDigest(base)).not.toBe(multishotDigest({ ...base, prompt: "edited" }));
    expect(multishotDigest(base)).not.toBe(multishotDigest({ ...base, previewGenerationId: "two" }));
  });

  it("rejects stale still/temporal approval bindings", () => {
    const valid = {
      selected: true,
      currentInputDigest: "input",
      storedInputDigest: "input",
      expectedStillApproval: "still",
      storedStillApproval: "still",
      expectedTemporalInput: "motion",
      storedTemporalInput: "motion",
      expectedTemporalApproval: "approved-motion",
      storedTemporalApproval: "approved-motion",
    };
    expect(() => assertExactTemporalBinding(valid)).not.toThrow();
    expect(() => assertExactTemporalBinding({ ...valid, storedInputDigest: "old" })).toThrow();
    expect(() => assertExactTemporalBinding({ ...valid, storedTemporalApproval: "old" })).toThrow();
    expect(() => assertExactTemporalBinding({ ...valid, selected: false })).toThrow();
  });

  it("allows reclaim only after a processing lease expires", () => {
    expect(isMultishotLeaseActive("processing", "2030-01-01T00:00:00.000Z", 1)).toBe(true);
    expect(isMultishotLeaseActive("processing", "2020-01-01T00:00:00.000Z", Date.now())).toBe(false);
    expect(isMultishotLeaseActive("failed", "2030-01-01T00:00:00.000Z", 1)).toBe(false);
  });
});