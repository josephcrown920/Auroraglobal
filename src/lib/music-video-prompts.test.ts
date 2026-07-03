import { describe, expect, it } from "bun:test";
import { buildEvenLyricSegments } from "./music-video-prompts";

describe("buildEvenLyricSegments", () => {
  it("evenly splits lines across the full duration, in order", () => {
    const segs = buildEvenLyricSegments(30, ["one", "two", "three"]);
    expect(segs).toEqual([
      { start: 0, end: 10, text: "one" },
      { start: 10, end: 20, text: "two" },
      { start: 20, end: 30, text: "three" },
    ]);
  });

  it("drops blank/whitespace-only lines before splitting", () => {
    const segs = buildEvenLyricSegments(20, ["  ", "first", "", "second", "\n"]);
    expect(segs).toEqual([
      { start: 0, end: 10, text: "first" },
      { start: 10, end: 20, text: "second" },
    ]);
  });

  it("trims surrounding whitespace on each kept line", () => {
    const segs = buildEvenLyricSegments(10, ["  padded line  "]);
    expect(segs).toEqual([{ start: 0, end: 10, text: "padded line" }]);
  });

  it("returns an empty array when there are no non-blank lines", () => {
    expect(buildEvenLyricSegments(30, [])).toEqual([]);
    expect(buildEvenLyricSegments(30, ["   ", "\t"])).toEqual([]);
  });

  it("returns an empty array for a non-positive or non-finite duration", () => {
    expect(buildEvenLyricSegments(0, ["line"])).toEqual([]);
    expect(buildEvenLyricSegments(-5, ["line"])).toEqual([]);
    expect(buildEvenLyricSegments(Number.NaN, ["line"])).toEqual([]);
    expect(buildEvenLyricSegments(Number.POSITIVE_INFINITY, ["line"])).toEqual([]);
  });

  it("rounds segment boundaries to 2 decimal places", () => {
    const segs = buildEvenLyricSegments(10, ["a", "b", "c"]);
    expect(segs).toEqual([
      { start: 0, end: 3.33, text: "a" },
      { start: 3.33, end: 6.67, text: "b" },
      { start: 6.67, end: 10, text: "c" },
    ]);
  });
});
