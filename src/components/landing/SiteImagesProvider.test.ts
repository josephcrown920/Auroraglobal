import { describe, expect, it } from "bun:test";
import { SITE_IMAGE_DEFAULTS } from "./SiteImagesProvider";

describe("Studio example image defaults", () => {
  it("exposes all five Studio strip slots with their bundled fallback URLs", () => {
    expect(SITE_IMAGE_DEFAULTS["studio-example-golden-hour-perf"].url).toBe("/sample-photos/fire-street.png");
    expect(SITE_IMAGE_DEFAULTS["studio-example-tokyo-rain"].url).toBe("/demo-tokyo-rain-1.png");
    expect(SITE_IMAGE_DEFAULTS["studio-example-editorial-split"].url).toBe("/sample-photos/red-dreads-chain.png");
    expect(SITE_IMAGE_DEFAULTS["studio-example-concert-stage"].url).toContain("josh-stage-shades.jpg");
    expect(SITE_IMAGE_DEFAULTS["studio-example-gold-luxury"].url).toBe("/sample-photos/balloon-josh.png");
  });

  it("groups the slots in the Studio example section for the admin image editor", () => {
    for (const key of [
      "studio-example-golden-hour-perf",
      "studio-example-tokyo-rain",
      "studio-example-editorial-split",
      "studio-example-concert-stage",
      "studio-example-gold-luxury",
    ] as const) {
      expect(SITE_IMAGE_DEFAULTS[key].section).toBe("studio_examples");
    }
  });
});