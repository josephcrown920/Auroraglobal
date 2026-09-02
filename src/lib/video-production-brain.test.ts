import { describe, expect, it } from "bun:test";
import { buildInitialBrain, planChange, recordInstruction, ProductionBrainSchema } from "./video-production-brain";

describe("video production brain", () => {
  it("creates a valid persistent production state", () => {
    const brain = buildInitialBrain({ projectId: "p1", brief: "cinematic Lagos night music video", durationSeconds: 60, aspectRatios: ["16:9", "9:16"] });
    expect(ProductionBrainSchema.parse(brain).phase).toBe("intake");
    expect(brain.projectId).toBe("p1");
    expect(brain.delivery.formats).toEqual(["16:9", "9:16"]);
  });

  it("keeps a local shot edit local and follows dependencies", () => {
    const brain = buildInitialBrain({ projectId: "p1", brief: "test" });
    brain.nodes.push(
      { id: "scene-3", type: "scene", status: "approved", version: 1, dependsOn: [], sourceAssetIds: [], payload: {} },
      { id: "S7", type: "shot", sceneId: "scene-3", status: "approved", version: 1, dependsOn: ["scene-3"], sourceAssetIds: [], payload: {} },
      { id: "rough-cut", type: "rough-cut", status: "approved", version: 1, dependsOn: ["S7"], sourceAssetIds: [], payload: {} },
      { id: "shot-9", type: "shot", sceneId: "scene-4", status: "approved", version: 1, dependsOn: [], sourceAssetIds: [], payload: {} },
    );
    brain.timeline.push({ id: "video", kind: "video", items: [
      { id: "i7", nodeId: "S7", start: 0, end: 5, volume: 1, opacity: 1, speed: 1, effects: [] },
      { id: "i9", nodeId: "shot-9", start: 5, end: 10, volume: 1, opacity: 1, speed: 1, effects: [] },
    ] });
    const impact = planChange(brain, "make shot 7 darker");
    expect(impact.affectedNodeIds).toContain("S7");
    expect(impact.staleNodeIds).toContain("S7");
    expect(impact.staleNodeIds).toContain("rough-cut");
    expect(impact.staleNodeIds).not.toContain("shot-9");
    expect(impact.affectedTrackIds).toEqual(["video"]);
  });

  it("maps scene commands to scene ids and scene-tagged shots", () => {
    const brain = buildInitialBrain({ projectId: "p1", brief: "test" });
    brain.nodes.push(
      { id: "S3", type: "shot", status: "approved", version: 1, dependsOn: [], sourceAssetIds: [], payload: { scene: 3 } },
      { id: "S4", type: "shot", status: "approved", version: 1, dependsOn: [], sourceAssetIds: [], payload: { scene: 4 } },
    );
    const impact = planChange(brain, "make scene 3 darker");
    expect(impact.affectedNodeIds).toContain("S3");
    expect(impact.affectedNodeIds).not.toContain("S4");
  });

  it("propagates character changes without resetting unrelated history", () => {
    const brain = buildInitialBrain({ projectId: "p1", brief: "character film" });
    brain.nodes.push({ id: "shot-1", type: "shot", status: "approved", version: 1, dependsOn: [], sourceAssetIds: [], payload: {} });
    const impact = planChange(brain, "change his hair to red");
    const next = recordInstruction(brain, "change his hair to red", impact);
    expect(next.history).toHaveLength(1);
    expect(next.nodes.find(n => n.id === "shot-1")?.status).toBe("stale");
    expect(next.phase).toBe("repair");
  });
});
