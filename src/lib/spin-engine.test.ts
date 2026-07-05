import { test, expect } from "bun:test";
import {
  SPIN_COUNT,
  SPIN_PIECE_COST,
  SPIN_VIDEO_DURATION_SECONDS,
  SPIN_VIDEO_MODEL,
  SPIN_VIDEO_LIPSYNC_MODEL,
  SPIN_VIDEO_PIECE_COST,
  SpinSpecSchema,
  SpinPlanSchema,
  buildFallbackSpecs,
  normalizeSpecs,
  buildVariantPrompt,
  buildVariantVideoMotionPrompt,
  specLabel,
  type SpinSpec,
} from "./spin-engine";
import { PRICING, VIDEO_TIER_AURA, LIPSYNC_TIER_AURA, VIDEO_MODEL_TIERS, LIPSYNC_MODEL_TIERS } from "./pricing";

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
  expect(prompt).toContain("Nova");
  expect(prompt).toContain("9:16");
  expect(prompt).toContain("DO NOT change face identity");
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

test("a literal performer pose in the topic does not repeat across the batch (regression)", () => {
  const specs = buildFallbackSpecs("gripping the mic, fist forward like a rapper", 30);
  // The literal gesture must never leak into `scene` verbatim.
  for (const s of specs) {
    expect(s.scene.toLowerCase()).not.toContain("mic");
    expect(s.scene.toLowerCase()).not.toContain("fist");
  }
  // At most 2-3 posts may use a mic/performance pose, and only on Lip-sync clips.
  const micPoses = specs.filter((s) => /mic|fist/i.test(s.pose));
  expect(micPoses.length).toBeLessThanOrEqual(3);
  for (const s of micPoses) {
    expect(s.contentType).toBe("Lip-sync clip");
  }
  // The vast majority of poses must be ordinary/candid, not performer poses.
  const candidPoses = specs.filter((s) => !/mic|fist/i.test(s.pose));
  expect(candidPoses.length).toBeGreaterThanOrEqual(27);
});

test("poses vary across the batch and are never blank", () => {
  const specs = buildFallbackSpecs("morning routine", 30);
  for (const s of specs) {
    expect(s.pose.trim().length).toBeGreaterThan(0);
  }
  const uniquePoses = new Set(specs.map((s) => s.pose));
  expect(uniquePoses.size).toBeGreaterThan(1);
});

test("buildVariantPrompt states the pose as mandatory staging and disclaims the raw topic's literal gesture", () => {
  const spec = buildFallbackSpecs("normal topic", 1)[0];
  const prompt = buildVariantPrompt(spec, {
    base: "gripping the mic, fist forward like a rapper",
  });
  expect(prompt).toContain(spec.pose);
  expect(prompt.toLowerCase()).toContain("ignore any hand position, prop, gesture, or body pose");
});

// ─── Video Mode pricing (product_showcase talking-portrait pieces) ──────────

test("SPIN_VIDEO_PIECE_COST is derived from the real stacked pricing engine, not an arbitrary number", () => {
  const lenMult = SPIN_VIDEO_DURATION_SECONDS / PRICING.referenceSeconds;
  const expected = Math.max(
    1,
    Math.ceil(PRICING.base.image + VIDEO_TIER_AURA.premium * lenMult + LIPSYNC_TIER_AURA.premium * lenMult),
  );
  expect(SPIN_VIDEO_PIECE_COST).toBe(expected);
  // Sanity: this must be a real premium price, well above a single flat still.
  expect(SPIN_VIDEO_PIECE_COST).toBeGreaterThan(SPIN_PIECE_COST * 10);
});

test("video length is fixed at 15 seconds", () => {
  expect(SPIN_VIDEO_DURATION_SECONDS).toBe(15);
});

test("forced video/lipsync models both actually sit in the premium tier they're priced at", () => {
  expect(VIDEO_MODEL_TIERS[SPIN_VIDEO_MODEL]).toBe("premium");
  expect(LIPSYNC_MODEL_TIERS[SPIN_VIDEO_LIPSYNC_MODEL]).toBe("premium");
});

test("a full 30-piece video batch costs strictly more than a full 30-piece photo batch", () => {
  expect(SPIN_VIDEO_PIECE_COST * SPIN_COUNT).toBeGreaterThan(SPIN_PIECE_COST * SPIN_COUNT);
});

test("buildVariantVideoMotionPrompt describes natural motion, preserves the product, and never mentions mouth/lipsync (handled in a separate stage)", () => {
  const spec = buildFallbackSpecs("unboxing skincare", 1)[0];
  const prompt = buildVariantVideoMotionPrompt(spec, { avatarName: "Nova" });
  expect(prompt).toContain(spec.motion);
  expect(prompt).toContain(spec.framing);
  expect(prompt).toContain(spec.camera);
  expect(prompt).toContain("Nova");
  expect(prompt.toLowerCase()).toContain("product");
  expect(prompt).toContain("9:16");
  expect(prompt.toLowerCase()).not.toContain("lip-sync");
  expect(prompt.toLowerCase()).not.toContain("lipsync");
});

test("buildVariantVideoMotionPrompt omits the avatar name cleanly when absent", () => {
  const spec = buildFallbackSpecs("holding a coffee mug", 1)[0];
  const prompt = buildVariantVideoMotionPrompt(spec);
  expect(prompt).not.toContain("undefined");
  expect(prompt).not.toContain("null");
  expect(prompt).toContain("Same person as reference image.");
});
