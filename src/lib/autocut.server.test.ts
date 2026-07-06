import { describe, expect, it } from "bun:test";
import { AUTOCUT_STYLES, getStyleCutRule } from "./autocut.server";

// AutoCut assembly no longer ignores the chosen style — getStyleCutRule() maps
// each style's cutRate/transition into concrete per-clip duration bounds and a
// hard-cut vs crossfade decision. Both the local ffmpeg assembler
// (runLocalFfmpegAssemble) and the self-hosted worker (aurora_worker.py's
// STYLE_CUT_RULES) key off this same shape.
describe("getStyleCutRule", () => {
  it("returns crossfade bounds for the cinematic (slow) style", () => {
    const rule = getStyleCutRule("cinematic");
    expect(rule.transition).toBe("crossfade");
    expect(rule.minClipSec).toBeGreaterThan(0);
    expect(rule.maxClipSec).toBeGreaterThan(rule.minClipSec);
    expect(rule.crossfadeSec).toBeGreaterThan(0);
  });

  it("returns short, hard-cut bounds for the hype (fast) style", () => {
    const rule = getStyleCutRule("hype");
    expect(rule.transition).toBe("cut");
    expect(rule.maxClipSec).toBeLessThanOrEqual(2);
  });

  it("returns a hard-cut rule for every declared AutoCut style", () => {
    for (const style of AUTOCUT_STYLES) {
      const rule = getStyleCutRule(style.id);
      expect(rule.transition).toBe(style.transition === "crossfade" ? "crossfade" : "cut");
      expect(rule.minClipSec).toBeLessThan(rule.maxClipSec);
    }
  });

  it("falls back to hard-cut defaults for an unknown or missing style (e.g. kids_story)", () => {
    const missing = getStyleCutRule(undefined);
    const unknown = getStyleCutRule("not-a-real-style");
    expect(missing.transition).toBe("cut");
    expect(unknown.transition).toBe("cut");
    expect(missing.minClipSec).toBeLessThan(missing.maxClipSec);
  });
});
