import { describe, expect, test } from "bun:test";
import { providedUGCScript } from "./ugc.server";
import { buildUGCCaptionSegments, planContentLineScenes } from "./jobs.server";

describe("Content Line UGC render contracts", () => {
  test("preserves the authored script verbatim instead of rewriting it", () => {
    const authored = "Stop buying sleep gummies that leave you groggy. These are different.";
    expect(providedUGCScript(authored).full).toBe(authored);
  });

  test("makes one readable bottom-third caption segment for the final video", () => {
    expect(buildUGCCaptionSegments("I sleep through the night now", 8)).toEqual([
      { start: 3.36, end: 7.65, text: "I sleep through the night now" },
    ]);
  });

  test.each([15, 30, 45] as const)("plans a %is brief without losing any authored copy", (duration) => {
    const authored = "First, this changed my nights. Then, I stopped waking up tired. Finally, I cancelled every other sleep subscription.";
    const scenes = planContentLineScenes(authored, duration);
    expect(scenes).toHaveLength(duration / 15);
    expect(scenes.every((scene) => scene.duration === 15)).toBe(true);
    expect(scenes.map((scene) => scene.script).join(" ").replace(/\s+/g, " ").trim())
      .toBe(authored.replace(/\s+/g, " ").trim());
  });

  test.each([
    "It costs $9.99 and works. Buy it today! Trust me.",
    'She said "This works." Then I tried it. Now I agree.',
    "Really?!Yes!!This works...And it lasts. Try it now.",
    "One two three",
  ])("preserves punctuation and every word: %s", (authored) => {
    for (const duration of [30, 45] as const) {
      const scenes = planContentLineScenes(authored, duration);
      expect(scenes).toHaveLength(duration / 15);
      expect(scenes.every((scene) => scene.script.length > 0)).toBe(true);
      expect(scenes.map((scene) => scene.script).join(" ").replace(/\s+/g, " "))
        .toBe(authored.replace(/\s+/g, " "));
    }
  });

  test("rejects scripts too short for non-empty long-form scenes", () => {
    expect(() => planContentLineScenes("Hi", 30)).toThrow("at least 2 words");
    expect(() => planContentLineScenes("Hi there", 45)).toThrow("at least 3 words");
    expect(() => planContentLineScenes("", 45)).toThrow("at least 3 words");
  });
});