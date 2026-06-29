import { describe, expect, it } from "bun:test";
import {
  computeKidsStoryCost,
  kidsStoryCostForLength,
  KIDS_LENGTHS,
  KIDS_MAX_SCENES,
  pickKidsMusic,
  KIDS_MUSIC,
  KIDS_MUSIC_NONE,
  buildKidsIllustrationPrompt,
  buildKidsMotionPrompt,
  estimateNarrationSeconds,
  findKidsCharacter,
  generateKidsStoryScript,
  DEFAULT_KIDS_CHARACTER,
} from "./kids-story.server";
import { computeCost } from "./pricing";

// ─── Pricing: stacked, additive, routed entirely through pricing.computeCost ──

describe("computeKidsStoryCost", () => {
  it("sums per-scene (image+video+audio) plus one final video of the full length", () => {
    const perScene = computeCost({ features: ["image", "video", "audio"], durationSeconds: 5 }).total;
    const finalAssembly = computeCost({ features: ["video"], durationSeconds: 15 }).total;
    expect(computeKidsStoryCost(3, 5)).toBe(perScene * 3 + finalAssembly);
  });

  it("clamps the scene count to the supported range", () => {
    expect(computeKidsStoryCost(0, 5)).toBe(computeKidsStoryCost(1, 5));
    expect(computeKidsStoryCost(99, 5)).toBe(computeKidsStoryCost(KIDS_MAX_SCENES, 5));
  });

  it("is monotonic in the number of scenes", () => {
    expect(computeKidsStoryCost(4, 5)).toBeGreaterThan(computeKidsStoryCost(3, 5));
  });

  it("kidsStoryCostForLength matches the catalog's scene count", () => {
    const short = KIDS_LENGTHS.short;
    expect(kidsStoryCostForLength("short")).toBe(
      computeKidsStoryCost(short.scenes, short.secondsPerScene),
    );
    const long = KIDS_LENGTHS.long;
    expect(kidsStoryCostForLength("long")).toBe(
      computeKidsStoryCost(long.scenes, long.secondsPerScene),
    );
  });
});

// ─── Music selection ──────────────────────────────────────────────────────────

describe("pickKidsMusic", () => {
  it("returns null when the user chose 'none'", () => {
    expect(pickKidsMusic("bedtime", KIDS_MUSIC_NONE)).toBeNull();
  });

  it("returns the exact track when a valid id is given", () => {
    const target = KIDS_MUSIC[1];
    expect(pickKidsMusic("bedtime", target.id)?.id).toBe(target.id);
  });

  it("auto-picks a track matching the content type when none is chosen", () => {
    const track = pickKidsMusic("educational");
    expect(track).not.toBeNull();
    expect(track!.contentTypes).toContain("educational");
  });

  it("falls back to a content-type match when an unknown id is given", () => {
    const track = pickKidsMusic("bedtime", "does-not-exist");
    expect(track).not.toBeNull();
    expect(track!.contentTypes).toContain("bedtime");
  });
});

// ─── Prompt builders: identity lock + storybook art style, never any text ─────

describe("prompt builders", () => {
  it("buildKidsIllustrationPrompt embeds the character description, scene, style and aspect", () => {
    const p = buildKidsIllustrationPrompt({
      sceneIllustration: "playing under a big oak tree",
      characterName: "Fuzz the monster",
      characterDescription: "a small round lavender monster",
      aspect: "9:16",
    });
    expect(p).toContain("Fuzz the monster");
    expect(p).toContain("a small round lavender monster");
    expect(p).toContain("playing under a big oak tree");
    expect(p).toContain("9:16");
    expect(p.toLowerCase()).toContain("storybook");
    expect(p.toLowerCase()).toContain("no text");
  });

  it("buildKidsMotionPrompt keeps the character name and scene", () => {
    const p = buildKidsMotionPrompt({
      sceneIllustration: "waving hello in a meadow",
      characterName: "Pip the bunny",
    });
    expect(p).toContain("Pip the bunny");
    expect(p).toContain("waving hello in a meadow");
  });
});

// ─── Narration length estimate ────────────────────────────────────────────────

describe("estimateNarrationSeconds", () => {
  it("uses the fallback for empty narration", () => {
    expect(estimateNarrationSeconds("   ", 5)).toBe(5);
  });

  it("stays within the 3–12s bounds", () => {
    expect(estimateNarrationSeconds("one two", 5)).toBeGreaterThanOrEqual(3);
    const long = Array.from({ length: 200 }, () => "word").join(" ");
    expect(estimateNarrationSeconds(long, 5)).toBeLessThanOrEqual(12);
  });
});

describe("findKidsCharacter", () => {
  it("resolves a known preset and rejects unknown / nullish ids", () => {
    expect(findKidsCharacter(DEFAULT_KIDS_CHARACTER.id)?.id).toBe(DEFAULT_KIDS_CHARACTER.id);
    expect(findKidsCharacter("nope")).toBeUndefined();
    expect(findKidsCharacter(null)).toBeUndefined();
  });
});

// ─── Script generation: graceful template fallback ───────────────────────────
// With no LLM provider key configured, generateWithFallback has no enabled
// providers and throws, so the studio must still produce a real, on-spec story.

const hasLlm = !!(
  process.env.LOVABLE_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.OPENAI_API_KEY ||
  process.env.OPENROUTER_API_KEY ||
  process.env.HF_TOKEN
);

describe("generateKidsStoryScript", () => {
  it("produces a titled, on-length script and falls back to a template without an LLM key", async () => {
    const { script, source } = await generateKidsStoryScript({
      contentType: "bedtime",
      ageRange: "3-5",
      topic: "the moon",
      characterName: "Fuzz the monster",
      characterDescription: "a small round lavender monster",
      sceneCount: 3,
    });

    expect(script.title.trim().length).toBeGreaterThan(0);
    expect(script.scenes.length).toBeGreaterThanOrEqual(1);
    expect(script.scenes.length).toBeLessThanOrEqual(3);
    for (const s of script.scenes) {
      expect(s.narration.length + s.illustration.length).toBeGreaterThan(0);
    }

    if (!hasLlm) {
      expect(source).toBe("template");
      expect(script.scenes).toHaveLength(3);
      expect(script.scenes.some((s) => s.narration.includes("Fuzz the monster"))).toBe(true);
    }
  });

  it("never returns more scenes than requested (cost is fixed at enqueue)", async () => {
    const { script } = await generateKidsStoryScript({
      contentType: "adventure",
      ageRange: "5-8",
      topic: "a tiny boat",
      characterName: "Ollie the owl",
      sceneCount: 2,
    });
    expect(script.scenes.length).toBeLessThanOrEqual(2);
  });
});
