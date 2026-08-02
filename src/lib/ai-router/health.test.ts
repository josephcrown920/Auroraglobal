import { afterEach, describe, expect, it } from "bun:test";
import {
  countHealthyForCategory,
  isHealthy,
  recordOutcome,
  resetHealthMap,
} from "./health";

describe("AI router category health", () => {
  afterEach(() => resetHealthMap());

  it("counts only healthy providers in a category", () => {
    recordOutcome("gemini", 100, false);
    recordOutcome("gemini", 100, false);
    recordOutcome("gemini", 100, false);
    recordOutcome("grok", 100, true);

    expect(isHealthy("gemini")).toBe(false);
    expect(countHealthyForCategory("GENERAL_CHAT")).toBeGreaterThan(0);
    expect(countHealthyForCategory("GENERAL_CHAT", new Set(["gemini"]))).toBe(0);
    expect(countHealthyForCategory("GENERAL_CHAT", new Set(["grok"]))).toBe(1);
  });

  it("treats providers with too little history as healthy", () => {
    recordOutcome("gemini", 100, false);
    recordOutcome("gemini", 100, false);

    expect(isHealthy("gemini")).toBe(true);
    expect(countHealthyForCategory("GENERAL_CHAT", new Set(["gemini"]))).toBe(1);
  });
});