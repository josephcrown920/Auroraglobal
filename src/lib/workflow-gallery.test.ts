import { describe, expect, test } from "bun:test";
import { groupGalleryByDate, selectTerminalOutput } from "./workflow-gallery";

describe("selectTerminalOutput", () => {
  test("uses the last completed leaf and classifies resolved Comfy video output", () => {
    const result = selectTerminalOutput([
      { id: "image", data: { kind: "image", status: "done", url: "image.png" } },
      { id: "comfy", data: { kind: "comfy", outputKind: "video", status: "done", altUrl: "clip.mp4" } },
    ], []);
    expect(result).toEqual({ nodeId: "comfy", url: "clip.mp4", kind: "video" });
  });
  test("does not select a completed node with outgoing edges", () => {
    const result = selectTerminalOutput([
      { id: "video", data: { kind: "video", status: "done", url: "upstream.mp4" } },
      { id: "image", data: { kind: "image", status: "done", url: "final.png" } },
    ], [{ source: "video" }]);
    expect(result?.url).toBe("final.png");
  });
});

describe("groupGalleryByDate", () => {
  test("orders recent entries within ordered date buckets", () => {
    const groups = groupGalleryByDate([
      { created_at: "2026-01-08T01:00:00Z" }, { created_at: "2026-01-10T12:00:00Z" },
    ], new Date("2026-01-10T16:00:00Z"));
    expect(groups.map((group) => group.label)).toEqual(["Today", "This week"]);
  });
});