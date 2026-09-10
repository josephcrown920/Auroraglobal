import { describe, expect, it } from "bun:test";
import {
  _enqueueVideoFromImage,
  validateVideoPreviewBinding,
} from "./studio.functions";
import { videoPreviewFingerprint } from "./motion-preview-fingerprint.server";

const STUDIO = "https://tpzmvbczwahxajujvnrq.supabase.co/storage/v1/object/public/studio/";
const USER_ID = "user-1";
const PREVIEW_ID = "00000000-0000-4000-8000-000000000001";

const request = {
  imageUrl: `${STUDIO}${USER_ID}/uploads/portrait.jpg`,
  prompt: "Slow movement across the workspace.",
  duration: 5,
  resolution: "720p" as const,
  modelKey: "seedance-2.0-fast",
  cameraMovement: null,
  endFrameUrl: null,
  confirmPreviewId: PREVIEW_ID,
  templateId: null,
};

const fingerprint = videoPreviewFingerprint({
  imageUrl: request.imageUrl,
  endFrameUrl: request.endFrameUrl,
  prompt: request.prompt,
  duration: request.duration,
  resolution: request.resolution,
  modelKey: request.modelKey,
  cameraMovement: request.cameraMovement,
  templateId: request.templateId,
});

const successfulVideoPreview = {
  id: PREVIEW_ID,
  user_id: USER_ID,
  kind: "video",
  mode: "preview",
  status: "succeeded",
  created_at: new Date().toISOString(),
  result_video_url: `${STUDIO}${USER_ID}/results/preview.mp4`,
  preview_fingerprint: fingerprint,
};

type VideoDeps = NonNullable<Parameters<typeof _enqueueVideoFromImage>[2]>;

function noSpendDeps(
  row: typeof successfulVideoPreview,
  reserveCalls: { count: number }[],
): VideoDeps {
  return {
    assertOwned: async () => {},
    // This seam represents the generic gate. The strict video binding below
    // must reject before the reserve seam can ever be reached.
    resolveGate: async () => ({ confirmed: true }),
    assertPreviewBinding: async (userId, previewId, expected) => {
      validateVideoPreviewBinding(row, userId, expected);
      expect(previewId).toBe(PREVIEW_ID);
    },
    reserve: async () => {
      reserveCalls.push({ count: 1 });
      return { jobId: "must-not-run", generationId: "must-not-run" };
    },
  };
}

describe("video preview confirmation binding", () => {
  it("rejects a mismatched fingerprint before reserving credits", async () => {
    const reserveCalls: { count: number }[] = [];
    await expect(
      _enqueueVideoFromImage(
        USER_ID,
        request,
        noSpendDeps({ ...successfulVideoPreview, preview_fingerprint: "different-inputs" }, reserveCalls),
      ),
    ).rejects.toThrow("does not match these exact inputs");
    expect(reserveCalls).toHaveLength(0);
  });

  it("fails closed for legacy previews without a binding", async () => {
    const reserveCalls: { count: number }[] = [];
    await expect(
      _enqueueVideoFromImage(
        USER_ID,
        request,
        noSpendDeps({ ...successfulVideoPreview, preview_fingerprint: null }, reserveCalls),
      ),
    ).rejects.toThrow("generate a fresh preview first");
    expect(reserveCalls).toHaveLength(0);
  });

  it("rejects an owned non-video preview before reserving credits", async () => {
    const reserveCalls: { count: number }[] = [];
    await expect(
      _enqueueVideoFromImage(
        USER_ID,
        request,
        noSpendDeps({ ...successfulVideoPreview, kind: "motion" }, reserveCalls),
      ),
    ).rejects.toThrow("not a video render");
    expect(reserveCalls).toHaveLength(0);
  });

  it("keeps the original requested quality in the fingerprint", () => {
    expect(
      videoPreviewFingerprint({
        imageUrl: request.imageUrl,
        prompt: request.prompt,
        duration: request.duration,
        resolution: request.resolution,
        modelKey: request.modelKey,
      }),
    ).toBe(fingerprint);
    expect(
      videoPreviewFingerprint({
        imageUrl: request.imageUrl,
        prompt: request.prompt,
        duration: request.duration,
        resolution: "1080p",
        modelKey: request.modelKey,
      }),
    ).not.toBe(fingerprint);
  });
});