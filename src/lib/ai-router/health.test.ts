import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  countHealthyForCategory,
  getDegradedCategories,
  isHealthy,
  recordOutcome,
  resetHealthMap,
} from "./health";
import { REQUEST_CATEGORIES } from "./categories";

describe("AI router category health", () => {
  beforeEach(() => resetHealthMap());
  afterEach(() => resetHealthMap());

  it("counts only healthy providers in a category", () => {
    recordOutcome("gemini", 100, false);
    recordOutcome("gemini", 100, false);
    recordOutcome("gemini", 100, false);

    expect(isHealthy("gemini")).toBe(false);
    expect(countHealthyForCategory("GENERAL_CHAT", new Set(["gemini"]))).toBe(0);
  });

  it("treats providers with too little history as healthy", () => {
    recordOutcome("gemini", 100, false);
    recordOutcome("gemini", 100, false);

    expect(isHealthy("gemini")).toBe(true);
    expect(countHealthyForCategory("GENERAL_CHAT", new Set(["gemini"]))).toBe(1);
  });

  it("provides category-level degraded data for the admin banner", () => {
    recordOutcome("gemini", 100, false);
    recordOutcome("gemini", 100, false);
    recordOutcome("gemini", 100, false);

    expect(getDegradedCategories(["PRICING", "GENERAL_CHAT"], new Set(["gemini"]))).toEqual([
      "PRICING",
      "GENERAL_CHAT",
    ]);
    expect(getDegradedCategories(REQUEST_CATEGORIES, new Set())).toHaveLength(REQUEST_CATEGORIES.length);
  });
});