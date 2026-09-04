import { describe, expect, it } from "bun:test";
import {
  buildBeatAlignedSegments,
  buildEvenLyricSegments,
  lyricAnalysisMarkerAfterCleanup,
  lyricBeatGate,
} from "./music-video-prompts";

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

describe("buildBeatAlignedSegments", () => {
  it("snaps each line's start to the nearest beat", () => {
    // 10s song, 2 lines → even starts 0 and 5; beats land at 1.2 and 6.0
    const segs = buildBeatAlignedSegments(10, ["one", "two"], [1.2, 6.0]);
    expect(segs).toEqual([
      { start: 1.2, end: 6, text: "one" },
      { start: 6, end: 10, text: "two" },
    ]);
  });

  it("lands exactly on the grid when beats match the even split", () => {
    const segs = buildBeatAlignedSegments(8, ["a", "b", "c", "d"], [0, 2, 4, 6]);
    expect(segs.map((s) => s.start)).toEqual([0, 2, 4, 6]);
    expect(segs.map((s) => s.end)).toEqual([2, 4, 6, 8]);
  });

  it("keeps starts strictly increasing when beats run out", () => {
    const segs = buildBeatAlignedSegments(4, ["a", "b", "c", "d"], [0, 1]);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].start).toBeGreaterThan(segs[i - 1].start);
    }
    for (const s of segs) expect(s.end).toBeGreaterThanOrEqual(s.start);
    expect(segs[segs.length - 1].end).toBe(4);
  });

  it("never lets consecutive lines share a beat", () => {
    // 4 lines, 2s song → even split is 0.5s/line but only 2 beats exist
    const segs = buildBeatAlignedSegments(2, ["a", "b", "c", "d"], [0.2, 0.9]);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].start).toBeGreaterThan(segs[i - 1].start);
    }
  });

  it("falls back to an even split when there are no usable beats", () => {
    const lines = ["one", "two", "three"];
    expect(buildBeatAlignedSegments(30, lines, [])).toEqual(buildEvenLyricSegments(30, lines));
    // beats outside [0, duration) are unusable
    expect(buildBeatAlignedSegments(30, lines, [-2, 99])).toEqual(buildEvenLyricSegments(30, lines));
  });

  it("handles unsorted beat timestamps", () => {
    const segs = buildBeatAlignedSegments(10, ["one", "two"], [6, 1.2]);
    expect(segs[0].start).toBe(1.2);
    expect(segs[1].start).toBe(6);
  });

  it("reserves room so late-only beats cannot collapse the tail", () => {
    // The only beat is at 9.9s of a 10s song — no line may take it, because
    // the later lines would have nowhere to go. Result is the even split.
    const segs = buildBeatAlignedSegments(10, ["a", "b", "c"], [9.9]);
    expect(segs.map((s) => s.start)).toEqual([0, 3.33, 6.67]);
    for (const s of segs) expect(s.end).toBeGreaterThan(s.start);
    expect(segs[2].end).toBe(10);
  });

  it("only snaps when a beat is near the line's even position", () => {
    // Beat at 3.4s is closest to line 2's even position (3.33s); line 1
    // keeps its 0s even start rather than jumping to 3.4s.
    const segs = buildBeatAlignedSegments(10, ["a", "b", "c"], [3.4]);
    expect(segs.map((s) => s.start)).toEqual([0, 3.4, 6.67]);
  });

  it("keeps rounded boundaries monotonic on very short songs", () => {
    const segs = buildBeatAlignedSegments(2, ["a", "b", "c", "d"], [0.4, 0.9, 1.4, 1.9]);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].start).toBeGreaterThanOrEqual(segs[i - 1].start);
      expect(segs[i].end).toBeGreaterThanOrEqual(segs[i].start);
    }
    expect(segs[segs.length - 1].end).toBe(2);
  });

  it("keeps starts strictly increasing at the densest supported line count", () => {
    // 1s song, 50 lines → 0.02s slots; every line has its own beat.
    const beats = Array.from({ length: 50 }, (_, i) => i * 0.02);
    const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`);
    const segs = buildBeatAlignedSegments(1, lines, beats);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].start).toBeGreaterThan(segs[i - 1].start);
    }
    expect(segs[49].end).toBe(1);
  });

  it("falls back to the even split when distinct centisecond boundaries are impossible", () => {
    // 0.01s song with 3 lines → 0.003s slots cannot produce distinct
    // 2-decimal boundaries; defined behavior is the even split.
    const lines = ["a", "b", "c"];
    expect(buildBeatAlignedSegments(0.01, lines, [0.005])).toEqual(
      buildEvenLyricSegments(0.01, lines),
    );
  });

  it("returns an empty array for empty lines or invalid duration", () => {
    expect(buildBeatAlignedSegments(30, [], [1, 2])).toEqual([]);
    expect(buildBeatAlignedSegments(0, ["x"], [1])).toEqual([]);
    expect(buildBeatAlignedSegments(Number.NaN, ["x"], [1])).toEqual([]);
    expect(buildBeatAlignedSegments(10, ["   "], [1])).toEqual([]);
  });
});
