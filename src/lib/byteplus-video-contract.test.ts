import { describe, expect, it } from "bun:test";
import { buildBytePlusVideoBody, normalizeSeedanceModel, requiresNativeSeedance, NATIVE_SEEDANCE_25, SEEDANCE_25_MODEL_ID } from "./byteplus-video-contract";
import { computeCost } from "./pricing";

describe("Seedance 2.x native multimodal contract", () => {
  it("normalizes every Aurora Seedance alias to a provider model ID", () => {
    expect(normalizeSeedanceModel("seedance-2.5")).toBe(SEEDANCE_25_MODEL_ID);
    expect(normalizeSeedanceModel("byteplus/seedance-2.5")).toBe(SEEDANCE_25_MODEL_ID);
    expect(normalizeSeedanceModel("seedance-2.0")).toBe("dreamina-seedance-2-0-260128");
    expect(normalizeSeedanceModel("seedance-2.0-fast")).toBe("dreamina-seedance-2-0-fast-260128");
    expect(normalizeSeedanceModel("seedance-2.0-mini")).toBe("dreamina-seedance-2-0-mini-260615");
    expect(normalizeSeedanceModel("seedance-1-5-pro-251215")).toBe("seedance-1-5-pro-251215");
    expect(normalizeSeedanceModel("seedance-1-0-pro-250528")).toBe(SEEDANCE_25_MODEL_ID);
    expect(normalizeSeedanceModel("seedance-3.0")).toBe(SEEDANCE_25_MODEL_ID);
  });

  it("preserves all inputs, roles, and top-level generation settings for 2.5", () => {
    const body = buildBytePlusVideoBody({
      model: SEEDANCE_25_MODEL_ID,
      prompt: "Use Image 1, Image 2, Video 1 and Audio 1",
      imageUrls: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
      videoUrl: "https://example.com/motion.mp4",
      audioUrl: "https://example.com/music.mp3",
      duration: 11, aspectRatio: "16:9", generateAudio: true, watermark: false, seed: 42,
    });
    expect(body).toMatchObject({
      model: SEEDANCE_25_MODEL_ID, duration: 11, ratio: "16:9", generate_audio: true, watermark: false, seed: 42,
    });
    expect(body.content).toEqual([
      { type: "text", text: "Use Image 1, Image 2, Video 1 and Audio 1" },
      { type: "image_url", image_url: { url: "https://example.com/1.jpg" }, role: "reference_image" },
      { type: "image_url", image_url: { url: "https://example.com/2.jpg" }, role: "reference_image" },
      { type: "video_url", video_url: { url: "https://example.com/motion.mp4" }, role: "reference_video" },
      { type: "audio_url", audio_url: { url: "https://example.com/music.mp3" }, role: "reference_audio" },
    ]);
  });

  it("supports reference-video motion for Seedance 2.0 Fast", () => {
    const body = buildBytePlusVideoBody({
      model: "seedance-2.0-fast",
      prompt: "Transfer the driving motion to the subject while preserving identity",
      imageUrls: ["https://example.com/subject.jpg"],
      videoUrl: "https://example.com/driving-motion.mp4",
      duration: 5,
      resolution: "720p",
    });
    expect(body.model).toBe("dreamina-seedance-2-0-fast-260128");
    expect(body.content).toEqual([
      { type: "text", text: "Transfer the driving motion to the subject while preserving identity" },
      { type: "image_url", image_url: { url: "https://example.com/subject.jpg" }, role: "reference_image" },
      { type: "video_url", video_url: { url: "https://example.com/driving-motion.mp4" }, role: "reference_video" },
    ]);
  });

  it("supports reference-video motion for Seedance 2.0", () => {
    const body = buildBytePlusVideoBody({
      model: "seedance-2.0",
      prompt: "Keep the subject anchored to the reference image and follow the reference video movement",
      imageUrls: ["https://example.com/subject.jpg"],
      videoUrl: "https://example.com/driving-motion.mp4",
      duration: 8,
      resolution: "720p",
    });
    expect(body.model).toBe("dreamina-seedance-2-0-260128");
    expect((body.content as Array<Record<string, unknown>>).some((part) => part.type === "video_url")).toBe(true);
  });

  it("keeps single-image start-frame behavior unless multimodal reference controls are used", () => {
    const base = { model: SEEDANCE_25_MODEL_ID, imageUrls: ["https://example.com/1.jpg"] };
    expect(buildBytePlusVideoBody(base).content).toEqual([
      { type: "image_url", image_url: { url: base.imageUrls[0] }, role: "first_frame" },
    ]);
    expect((buildBytePlusVideoBody({ ...base, audioUrl: "https://example.com/a.mp3" }).content as Array<{ role: string }>)[0].role).toBe("reference_image");
  });

  it("fails rather than clamping unsupported values", () => {
    for (const duration of [2, 3, 31, 4.5, NaN]) {
      expect(() => buildBytePlusVideoBody({ model: SEEDANCE_25_MODEL_ID, duration })).toThrow();
    }
    expect(() => buildBytePlusVideoBody({ model: SEEDANCE_25_MODEL_ID, resolution: "1080p" })).toThrow();
    expect(() => buildBytePlusVideoBody({ model: "old", videoUrl: "https://example.com/x" })).toThrow();
    expect(() => buildBytePlusVideoBody({ model: "old", imageUrls: ["a", "b"] })).toThrow();
    expect(() => buildBytePlusVideoBody({
      model: SEEDANCE_25_MODEL_ID, imageUrls: ["a"], imageRoles: ["last_frame"],
    })).toThrow();
    expect(() => buildBytePlusVideoBody({
      model: SEEDANCE_25_MODEL_ID, generateAudio: "false" as unknown as boolean,
    })).toThrow();
    expect(() => buildBytePlusVideoBody({
      model: SEEDANCE_25_MODEL_ID, imageRoles: "first_frame" as never,
    })).toThrow();
    expect(() => buildBytePlusVideoBody({
      model: SEEDANCE_25_MODEL_ID, imageUrls: Array.from({ length: 31 }, (_, i) => "asset://person-" + i),
    })).toThrow();
    expect(() => buildBytePlusVideoBody({
      model: SEEDANCE_25_MODEL_ID,
      imageUrls: ["asset://authorized-person"],
      videoUrl: "asset://reference-video",
    })).not.toThrow();
  });

  it("requires native routing for Seedance 2.x multimodal controls", () => {
    expect(requiresNativeSeedance({ model: NATIVE_SEEDANCE_25 })).toBe(true);
    expect(requiresNativeSeedance({ model: "seedance-2.5", params: { generate_audio: false } })).toBe(true);
    expect(requiresNativeSeedance({ model: "seedance-2.5", imageUrls: ["a", "b"] })).toBe(true);
    expect(requiresNativeSeedance({ model: "seedance-2.5", videoUrl: "v" })).toBe(true);
    expect(requiresNativeSeedance({ model: "seedance-2.0", videoUrl: "v" })).toBe(true);
    expect(requiresNativeSeedance({ model: "seedance-2.0-fast", imageUrls: ["a", "b"] })).toBe(true);
    expect(requiresNativeSeedance({ model: "seedance-2.0" })).toBe(false);
  });

  it("quotes native 2.5 at the same canonical tier as existing Seedance 2.5", () => {
    expect(computeCost({ features: ["video"], model: NATIVE_SEEDANCE_25 }).total)
      .toBe(computeCost({ features: ["video"], model: "seedance-2.5" }).total);
  });
});
