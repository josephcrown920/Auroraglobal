import { describe, expect, it } from "bun:test";
import {
  GeminiShotBriefSchema,
  MULTISHOT_LIVE_MODEL,
  MULTISHOT_LIVE_SESSION_MINUTES,
  MULTISHOT_PLANNING_MODEL,
} from "./multishot-gemini.functions";

describe("Gemini Multishot capability contract", () => {
  it("accepts an editable 2-8 shot brief using the production response shape", () => {
    const parsed = GeminiShotBriefSchema.parse({
      brief: "A compact launch sequence.",
      continuity: "Keep the red coat and cool window light unchanged.",
      shots: [
        { title: "Arrival", prompt: "Wide 24mm dolly shot as the subject enters the blue-lit station." },
        { title: "Reveal", prompt: "Tight 85mm push-in as the subject opens the case under cool window light." },
      ],
    });
    expect(parsed.shots).toHaveLength(2);
    expect(parsed.shots[1].title).toBe("Reveal");
  });

  it("rejects malformed or unusable provider payloads", () => {
    expect(() => GeminiShotBriefSchema.parse({
      brief: "Incomplete",
      continuity: "",
      shots: [{ title: "Only one", prompt: "Too few shots even though this prompt is long enough." }],
    })).toThrow();
    expect(() => GeminiShotBriefSchema.parse({
      brief: "No usable prompt",
      continuity: "",
      shots: [
        { title: "One", prompt: "short" },
        { title: "Two", prompt: "short" },
      ],
    })).toThrow();
  });

  it("pins explicit Google model identities and a bounded Live session", () => {
    expect(MULTISHOT_PLANNING_MODEL).toMatch(/^gemini-/);
    expect(MULTISHOT_LIVE_MODEL).toContain("native-audio");
    expect(MULTISHOT_LIVE_SESSION_MINUTES).toBeGreaterThan(0);
    expect(MULTISHOT_LIVE_SESSION_MINUTES).toBeLessThanOrEqual(30);
  });
});