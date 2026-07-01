import { test, expect } from "bun:test";
import {
  SPIN_COUNT,
  SpinSpecSchema,
  SpinPlanSchema,
  buildFallbackSpecs,
  normalizeSpecs,
  buildVariantPrompt,
  specLabel,
  type SpinSpec,
} from "./spin-engine";

test("buildFallbackSpecs returns exactly SPIN_COUNT complete specs", () => {
  const specs = buildFallbackSpecs("dancing in the rain");
  expect(specs.length).toBe(SPIN_COUNT);
  for (const s of specs) {
    // Every field must be non-empty so prompt-building never emits blanks.
    expect(SpinSpecSchema.safeParse(s).success).toBe(true);
    for (const v of Object.values(s)) {
      expect(typeof v).toBe("string");
      expect((v as string).trim().length).toBeGreaterThan(0);
    }
  }
});

test("buildFallbackSpecs produces genuinely unique looks (no repeated location+outfit)", () => {
  const specs = buildFallbackSpecs("morning routine", 30);
  const combos = new Set(specs.map((s) => `${s.location}||${s.outfit}`));
  expect(combos.size).toBe(specs.length);
});

test("count is configurable and stays unique for large N", () => {
  const specs = buildFallbackSpecs("gym day", 50);
  expect(specs.length).toBe(50);
  const combos = new Set(specs.map((s) => `${s.location}||${s.outfit}`));
  expect(combos.size).toBe(50);
});

test("the user idea is woven into hooks and captions", () => {
  const idea = "unboxing my new camera";
  const specs = buildFallbackSpecs(idea, 5);
  expect(specs.some((s) => s.hook.includes(idea))).toBe(true);
  expect(specs.some((s) => s.caption.includes(idea))).toBe(true);
});

test("buildVariantPrompt includes every variation axis + identity + trigger word", () => {
  const spec: SpinSpec = buildFallbackSpecs("skydiving", 1)[0];
  const prompt = buildVariantPrompt(spec, {
    base: "skydiving",
    triggerWord: "sks_person",
    avatarName: "Nova",
    aspect: "9:16",
  });
  expect(prompt).toContain(spec.outfit);
  expect(prompt).toContain(spec.location);
  expect(prompt).toContain(spec.mood);
  expect(prompt).toContain(spec.lighting);
  expect(prompt).toContain(spec.camera);
  expect(prompt).toContain(spec.framing);
  expect(prompt).toContain("sks_person");
  expect(prompt).toContain('"Nova"');
  expect(prompt).toContain("[9:16 aspect ratio]");
});

test("buildVariantPrompt omits identity/trigger cleanly when absent", () => {
  const spec = buildFallbackSpecs("cooking pasta", 1)[0];
  const prompt = buildVariantPrompt(spec);
  expect(prompt).not.toContain("featuring AI creator");
  expect(prompt).not.toContain("undefined");
  expect(prompt).not.toContain("null");
});

test("normalizeSpecs pads a short LLM response up to count", () => {
  const partial = [{ contentType: "Talking-head hook", hook: "wait for it" }];
  const specs = normalizeSpecs(partial, "day in my life", 30);
  expect(specs.length).toBe(30);
  // Provided fields are preserved on the first item.
  expect(specs[0].contentType).toBe("Talking-head hook");
  expect(specs[0].hook).toBe("wait for it");
  // Blank fields are backfilled from the deterministic fallback.
  expect(specs[0].outfit.trim().length).toBeGreaterThan(0);
  expect(specs[0].location.trim().length).toBeGreaterThan(0);
});

test("normalizeSpecs trims an over-long LLM response down to count", () => {
  const raw = buildFallbackSpecs("beach trip", 40);
  const specs = normalizeSpecs(raw, "beach trip", 30);
  expect(specs.length).toBe(30);
});

test("SpinPlanSchema accepts a well-formed plan", () => {
  const plan = { posts: buildFallbackSpecs("test idea", 3) };
  expect(SpinPlanSchema.safeParse(plan).success).toBe(true);
});

test("specLabel returns the content type", () => {
  const spec = buildFallbackSpecs("test", 1)[0];
  expect(specLabel(spec)).toBe(spec.contentType);
});
