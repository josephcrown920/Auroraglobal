import {
  hasActiveWorkerForKind,
  orchestrate,
  type GenerateRequest,
  type GenerateResult,
} from "./orchestrator.server";
import {
  buildMimicMotionRequest,
  type MotionGenerateRequest,
} from "./motion-workflows.server";

export type MotionSmokeStepResult = {
  status: "pass" | "fail" | "skip";
  latency_ms: number;
  cost_usd: number;
  output_url?: string | null;
  error?: string | null;
  raw?: Record<string, unknown>;
};

export type MotionSmokeDeps = {
  hasActiveWorkerForKind: typeof hasActiveWorkerForKind;
  buildMimicMotionRequest: typeof buildMimicMotionRequest;
  orchestrate: (request: GenerateRequest) => Promise<GenerateResult>;
};

const defaultDeps: MotionSmokeDeps = {
  hasActiveWorkerForKind,
  buildMimicMotionRequest,
  orchestrate,
};

/**
 * Executes the production Perform Anywhere smoke path.
 *
 * Keeping request construction here ensures the smoke runner and integration
 * coverage dispatch the exact same snake_case params and ComfyUI workflow.
 */
export async function runMotionSmokeStep(
  userId: string,
  refId: string,
  imageUrl: string,
  drivingVideoUrl: string,
  deps: MotionSmokeDeps = defaultDeps,
): Promise<MotionSmokeStepResult> {
  const start = Date.now();
  try {
    if (!(await deps.hasActiveWorkerForKind("motion"))) {
      return {
        status: "skip",
        latency_ms: Date.now() - start,
        cost_usd: 0,
        error: "No motion GPU worker online — skipping Perform Anywhere smoke step",
      };
    }

    const motionRequest: MotionGenerateRequest = deps.buildMimicMotionRequest({
      imageUrl,
      drivingVideoUrl,
      prompt: "smoke test: motion transfer — drive reference image with short clip",
      params: { motionType: "faithful", cameraMovement: "static" },
    });
    const out = await deps.orchestrate({
      ...motionRequest,
      userId,
      refId,
      // MimicMotion has no paid-provider equivalent. This also guarantees a
      // smoke run can never escape to a configured external motion provider.
      selfHostedOnly: true,
    });
    if (!out.url) throw new Error("Motion transfer returned no video URL");

    return {
      status: "pass",
      latency_ms: Date.now() - start,
      cost_usd: out.costUsd ?? 0,
      output_url: out.url,
      raw: { provider: out.provider },
    };
  } catch (e) {
    return {
      status: "fail",
      latency_ms: Date.now() - start,
      cost_usd: 0,
      error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
    };
  }
}
