import { describe, expect, it } from "bun:test";
import {
  PerformanceWorkflowPayloadSchema,
  validatePerformanceWorkflowStructure,
} from "./performance-workflow.functions";
import { emptyPerformanceWorkflow } from "./performance-workflow";
import { motionInputFingerprint, motionParamsWithEffectiveSeed, performanceReskinFingerprint } from "./studio.functions";
import { buildMimicMotionRequest } from "./motion-workflows.server";

const image = "https://project.supabase.co/storage/v1/object/sign/studio/user/uploads/image.jpg";
const video = "https://project.supabase.co/storage/v1/object/sign/studio/user/uploads/video.mp4";
const id = "00000000-0000-4000-8000-000000000001";
const jobId = "00000000-0000-4000-8000-000000000002";

describe("performance workflow server contract", () => {
  it("accepts a partial-success workflow with only wide motion queued", () => {
    const payload = PerformanceWorkflowPayloadSchema.parse({
      ...emptyPerformanceWorkflow(),
      subjectUrl: image,
      widePlate: { url: image, generationId: id, approved: true },
      closeupPlate: { url: image, generationId: "00000000-0000-4000-8000-000000000003", approved: true },
      wideVideoUrl: video,
      wideClip: { generationId: id, jobId, previewId: id },
    });
    expect(() => validatePerformanceWorkflowStructure(payload)).not.toThrow();
    expect(payload.closeupClip).toBeNull();
  });

  it("rejects motion without server-approved plate provenance", () => {
    const payload = PerformanceWorkflowPayloadSchema.parse({
      ...emptyPerformanceWorkflow(),
      wideVideoUrl: video,
      wideClip: { generationId: id, jobId, previewId: id },
    });
    expect(() => validatePerformanceWorkflowStructure(payload)).toThrow("approved wide plate");
  });

  it("rejects motion when the angle-specific phone performance is absent", () => {
    const payload = PerformanceWorkflowPayloadSchema.parse({
      ...emptyPerformanceWorkflow(),
      closeupPlate: { url: image, generationId: id, approved: true },
      closeupClip: { generationId: id, jobId, previewId: null },
    });
    expect(() => validatePerformanceWorkflowStructure(payload)).toThrow("matching phone video");
  });

  it("rejects non-UUID generation and job provenance", () => {
    expect(() => PerformanceWorkflowPayloadSchema.parse({
      ...emptyPerformanceWorkflow(),
      widePlate: { url: image, generationId: "fake", approved: true },
    })).toThrow();
    expect(() => PerformanceWorkflowPayloadSchema.parse({
      ...emptyPerformanceWorkflow(),
      wideClip: { generationId: id, jobId: "fake", previewId: null },
    })).toThrow();
  });

  it("rejects unsafe non-URL media values before persistence", () => {
    expect(() => PerformanceWorkflowPayloadSchema.parse({
      ...emptyPerformanceWorkflow(),
      wideVideoUrl: "/relative/untrusted.mp4",
    })).toThrow();
  });

  it("binds preview confirmation to plate generation, prompt and exact motion params", () => {
    const base = {
      sourceGenerationId: id,
      workflowMode: "colors" as const,
      workflowAngle: "wide" as const,
      imageUrl: image,
      drivingVideoUrl: video,
      prompt: "faithful wide performance",
      params: { motionType: "faithful" as const, cameraMovement: "static" as const },
    };
    const fingerprint = motionInputFingerprint(base);
    expect(motionInputFingerprint({ ...base, sourceGenerationId: "00000000-0000-4000-8000-000000000004" })).not.toBe(fingerprint);
    expect(motionInputFingerprint({ ...base, prompt: "different performance" })).not.toBe(fingerprint);
    expect(motionInputFingerprint({ ...base, params: { ...base.params, cameraMovement: "push-in" as const } })).not.toBe(fingerprint);
    expect(motionInputFingerprint({ ...base, workflowAngle: "closeup" as const })).not.toBe(fingerprint);
  });

  it("keeps a preview binding stable when a stored object is re-signed", () => {
    const first = motionInputFingerprint({
      imageUrl: image + "?token=old",
      drivingVideoUrl: video + "?token=old",
      params: { motionType: "faithful" },
    });
    const resigned = motionInputFingerprint({
      imageUrl: image + "?token=new",
      drivingVideoUrl: video + "?token=new",
      params: { motionType: "faithful" },
    });
    expect(resigned).toBe(first);
  });

  it("uses the preview's persisted effective seed in the actual final worker payload", () => {
    const previewParams = motionParamsWithEffectiveSeed(
      { motionType: "faithful", cameraMovement: "static", frames: 80 },
      null,
      424242,
    );
    const finalParams = motionParamsWithEffectiveSeed(
      { motionType: "faithful", cameraMovement: "static", frames: 180 },
      previewParams.seed,
      999999,
    );
    const previewRequest = buildMimicMotionRequest({ imageUrl: image, drivingVideoUrl: video, params: previewParams });
    const finalRequest = buildMimicMotionRequest({ imageUrl: image, drivingVideoUrl: video, params: finalParams });
    expect(previewRequest.params?.seed).toBe(424242);
    expect(finalRequest.params?.seed).toBe(424242);
    expect(finalRequest.comfyInputs?.["3.seed"]).toBe(previewRequest.comfyInputs?.["3.seed"]);
  });

  it("binds performance-reskin preview confirmation to owned media and effective seed", () => {
    const params = motionParamsWithEffectiveSeed({ motionType: "faithful" }, null, 10101);
    const base = {
      performanceVideoUrl: video + "?token=old",
      avatarImageUrl: image + "?token=old",
      audioUrl: "https://project.supabase.co/storage/v1/object/sign/studio/user/uploads/song.mp3?token=old",
      outfit: "tailored black suit",
      location: "night interior",
      params,
    };
    const fingerprint = performanceReskinFingerprint(base);
    expect(performanceReskinFingerprint({
      ...base,
      performanceVideoUrl: video + "?token=new",
      avatarImageUrl: image + "?token=new",
      audioUrl: base.audioUrl.replace("token=old", "token=new"),
    })).toBe(fingerprint);
    expect(performanceReskinFingerprint({ ...base, params: { ...params, seed: 20202 } })).not.toBe(fingerprint);
  });
});