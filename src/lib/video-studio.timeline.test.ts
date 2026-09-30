import { describe, expect, it } from "bun:test";
import { getTimelineDropIndex, moveTimelineItem } from "./video-studio.timeline";

describe("Video Studio timeline ordering", () => {
  it("moves clips earlier and later by final position", () => {
    expect(moveTimelineItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveTimelineItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("accounts for removing the dragged clip before dropping it before a target", () => {
    expect(moveTimelineItem(["a", "b", "c"], 0, getTimelineDropIndex(0, 2))).toEqual(["b", "a", "c"]);
    expect(moveTimelineItem(["a", "b", "c"], 2, getTimelineDropIndex(2, 0))).toEqual(["c", "a", "b"]);
  });

  it("leaves the original sequence unchanged for invalid indices", () => {
    const clips = ["a", "b"];
    expect(moveTimelineItem(clips, -1, 1)).toBe(clips);
    expect(moveTimelineItem(clips, 0, 2)).toBe(clips);
  });
});
