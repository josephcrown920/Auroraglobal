import { describe, expect, it } from "bun:test";
import {
  sanitizeVideoAgentScript,
  videoAgentWordTarget,
  SPOKEN_WORDS_PER_SECOND,
} from "./video-agent-prompt";

describe("sanitizeVideoAgentScript", () => {
  it("drops metadata label lines that would be spoken aloud", () => {
    const input = [
      "Tone: upbeat and friendly",
      "Background: modern office",
      "Hey there! Welcome to Aurora.",
      "Style = cinematic",
    ].join("\n");
    expect(sanitizeVideoAgentScript(input)).toBe("Hey there! Welcome to Aurora.");
  });

  it("drops labelled lines even behind list markers", () => {
    const input = "- Tone: calm\n* Camera: slow zoom\nLet me show you how it works.";
    expect(sanitizeVideoAgentScript(input)).toBe("Let me show you how it works.");
  });

  it("strips timestamp prefixes but keeps the speech", () => {
    const input = "0:00 Welcome back everyone.\n[00:05] Today we launch.\n(0:10-0:15) Let's dive in.";
    expect(sanitizeVideoAgentScript(input)).toBe(
      "Welcome back everyone. Today we launch. Let's dive in.",
    );
  });

  it("removes bracketed stage directions mid-line", () => {
    const input = "Hi! [smiles warmly] This is the new dashboard [cut to product] you asked for.";
    expect(sanitizeVideoAgentScript(input)).toBe(
      "Hi! This is the new dashboard you asked for.",
    );
  });

  it("keeps parentheses — they can be legitimate speech", () => {
    const input = "It costs ten dollars (yes, really) per month.";
    expect(sanitizeVideoAgentScript(input)).toBe("It costs ten dollars (yes, really) per month.");
  });

  it("does not touch mid-sentence words like 'the tone of voice'", () => {
    const input = "I love the tone of voice in this ad.";
    expect(sanitizeVideoAgentScript(input)).toBe("I love the tone of voice in this ad.");
  });

  it("joins multi-line scripts into flowing speech with collapsed whitespace", () => {
    const input = "First line.\n\n  Second   line.  \nThird line.";
    expect(sanitizeVideoAgentScript(input)).toBe("First line. Second line. Third line.");
  });

  it("returns empty string when everything was metadata", () => {
    expect(sanitizeVideoAgentScript("Tone: happy\nBackground: beach")).toBe("");
  });
});

describe("videoAgentWordTarget", () => {
  it("scales with duration at the spoken pace", () => {
    expect(videoAgentWordTarget(30)).toBe(Math.round(30 * SPOKEN_WORDS_PER_SECOND));
  });
  it("has a sane floor and default", () => {
    expect(videoAgentWordTarget(1)).toBe(12);
    expect(videoAgentWordTarget(NaN)).toBe(Math.round(20 * SPOKEN_WORDS_PER_SECOND));
  });
});
