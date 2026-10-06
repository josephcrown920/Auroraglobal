import { describe, expect, it } from "bun:test";
import { COMFY_MANAGER_CAPABILITIES, UNIFIED_WORKFLOWS, isUnifiedWorkflow } from "./comfy-manager.integration.server";
import { planVideoAgent } from "./byteplus-agent.integration.server";

describe("unified Comfy Manager integration", () => {
  it("registers the core capability set", () => {
    expect(COMFY_MANAGER_CAPABILITIES).toContain("comfyui-workflows");
    expect(COMFY_MANAGER_CAPABILITIES).toContain("modelark-seedance");
    expect(COMFY_MANAGER_CAPABILITIES).toContain("gpu-hub");
    expect(COMFY_MANAGER_CAPABILITIES).toContain("free-colab-workers");
    expect(COMFY_MANAGER_CAPABILITIES).toContain("free-kaggle-workers");
  });

  it("keeps the canonical six video workflows", () => {
    expect(UNIFIED_WORKFLOWS.map((w) => w.id)).toEqual([
      "standard-video", "cinematic-video", "viral-video", "image-to-video", "character-video", "lip-sync-video",
    ]);
    expect(UNIFIED_WORKFLOWS.every((w) => w.provider === "modelark")).toBe(true);
  });

  it("plans cinematic and viral requests without adding another backend", () => {
    expect(planVideoAgent({ prompt: "artist walking through a city", mode: "cinematic" }).workflow.id).toBe("cinematic-video");
    expect(planVideoAgent({ prompt: "hook shot", mode: "viral", preset: "CASH_RAIN" }).prompt).toContain("CASH_RAIN");
  });

  it("rejects unknown workflow ids", () => {
    expect(isUnifiedWorkflow("not-a-workflow")).toBe(false);
  });
});
