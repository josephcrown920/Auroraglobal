import { describe, expect, it } from "bun:test";
import {
  buildVideoEditorPrompt,
  VIDEO_EDIT_STYLE_IDS,
  VideoEditRecommendationSchema,
} from "./video-studio.schema";

describe("Video Studio edit recommendations", () => {
  it("accepts only settings supported by AutoCut", () => {
    expect(
      VideoEditRecommendationSchema.parse({
        style: "cinematic",
        includeMusic: true,
        reason: "Slow crossfades suit the requested mood.",
      }).style,
    ).toBe("cinematic");

    expect(
      VideoEditRecommendationSchema.safeParse({
        style: "custom-keyframes",
        includeMusic: true,
        reason: "Unsupported effect.",
      }).success,
    ).toBe(false);
    expect(VIDEO_EDIT_STYLE_IDS).toEqual(["hype", "cinematic", "talking_head", "tiktok_hook"]);
  });

  it("tells the Editor Agent about ordered clips and renderer limits", () => {
    const prompt = buildVideoEditorPrompt("Make it dreamy and slow.", 3);
    expect(prompt).toContain("3 uploaded video clip(s)");
    expect(prompt).toContain("arranged in the order they want");
    expect(prompt).toContain("does not apply arbitrary prompt edits");
  });
});
