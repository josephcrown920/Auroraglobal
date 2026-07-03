// ComfyUI adapter — first-class generic workflow dispatch.
// Submits an arbitrary ComfyUI prompt graph, polls /history until it finishes,
// and resolves the first output asset's /view URL. No model or node is hardcoded:
// the caller supplies the workflow graph (and optional per-node input patches),
// so any image/video/motion/lip-sync ComfyUI workflow can run here.
//
// Required env:
//   COMFYUI_URL    — base URL of the ComfyUI server, e.g. "https://abc.trycloudflare.com"
//   COMFYUI_TOKEN  — optional bearer token (if you front ComfyUI with auth)
//
// The job must carry `comfyWorkflow` (the graph JSON). Optional `comfyInputs`
// patches values in by "nodeId.inputName" key before submitting.

import type { InferenceInput, InferenceResult, ProbeResult, ProviderAdapter } from "../types";
import { probeReachable, runComfyWorkflow, toResult } from "../protocols";

export const comfyuiAdapter: ProviderAdapter = {
  id: "comfyui",
  label: "ComfyUI (self-hosted workflow API)",
  requiredEnv: ["COMFYUI_URL"],
  tasks: ["image", "video", "lipsync", "motion"],

  async probeHealth(timeoutMs?: number): Promise<ProbeResult | null> {
    const base = process.env.COMFYUI_URL?.replace(/\/$/, "");
    if (!base) return null;
    // ComfyUI exposes liveness at /system_stats — require a 2xx.
    return probeReachable(`${base}/system_stats`, { token: process.env.COMFYUI_TOKEN, expectOk: true, timeoutMs });
  },

  async run(input: InferenceInput): Promise<InferenceResult> {
    const baseUrl = process.env.COMFYUI_URL;
    const token = process.env.COMFYUI_TOKEN;
    if (!baseUrl) {
      throw new Error("ComfyUI not configured: set COMFYUI_URL secret.");
    }
    if (!input.comfyWorkflow) {
      throw new Error("ComfyUI requires a workflow: pass `comfyWorkflow` (a ComfyUI graph JSON) in the job.");
    }

    const outputUrl = await runComfyWorkflow({
      baseUrl,
      token,
      workflow: input.comfyWorkflow,
      inputs: input.comfyInputs,
    });
    return toResult(outputUrl, input, { promptSubmitted: true });
  },
};
