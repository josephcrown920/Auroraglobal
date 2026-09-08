import { describe, expect, it } from "bun:test";
import {
  PerformanceVariantPayloadSchema,
  validateVariantRequirements,
  validateVariantStructure,
  type PerformanceVariantPayload,
} from "./performance-variant.functions";
import { performanceVariantInputFingerprint as variantInputFingerprint } from "./motion-preview-fingerprint.server";

const studio = (name: string) => `https://example.supabase.co/storage/v1/object/sign/studio/user/performance/${name}.jpg?token=one`;

function scene(): PerformanceVariantPayload {
  return PerformanceVariantPayloadSchema.parse({
    version: 1,
    mode: "colors",
    kind: "build_scene",
    references: {
      identity: studio("identity"), outfit: studio("outfit"), location: studio("location"),
      composition: studio("composition"), prop: studio("prop"),
    },
    settings: { location: "warehouse", action: "performing" },
    selectedAngles: ["side_superclose", "wide_behind", "low_angle"],
    base: null, angles: [], motions: [], phoneVideoUrl: null,
    angleVideoOverrides: {}, motionDirections: {}, audioUrl: null,
  });
}

describe("performance variant server behavior", () => {
  it("requires all five distinct Build a Scene roles and 3–5 angles", () => {
    const valid = scene();
    expect(() => validateVariantRequirements(valid)).not.toThrow();
    expect(() => validateVariantRequirements({ ...valid, references: { ...valid.references, prop: null } })).toThrow("prop");
    expect(() => validateVariantRequirements({ ...valid, references: { ...valid.references, prop: valid.references.outfit } })).toThrow("distinct");
    expect(() => validateVariantRequirements({ ...valid, selectedAngles: ["low_angle"] })).toThrow("3–5");
  });

  it("requires the three Luxury Interior roles and explicit performance context", () => {
    const luxury = PerformanceVariantPayloadSchema.parse({
      ...scene(),
      kind: "luxury_interior",
      references: { composition: studio("window"), interior: studio("interior"), identity: studio("identity") },
      selectedAngles: [],
      settings: { vehicle: "Maybach", context: "Performer rapping inside the vehicle" },
    });
    expect(() => validateVariantRequirements(luxury)).not.toThrow();
    expect(() => validateVariantRequirements({ ...luxury, settings: { ...luxury.settings, context: "" } })).toThrow("context");
  });

  it("fingerprints every role reference and editable setting while ignoring signed-url renewal", () => {
    const value = scene();
    const fingerprint = variantInputFingerprint(value);
    expect(variantInputFingerprint({ ...value, references: { ...value.references, identity: studio("identity").replace("token=one", "token=two") } })).toBe(fingerprint);
    expect(variantInputFingerprint({ ...value, references: { ...value.references, identity: studio("different-person") } })).not.toBe(fingerprint);
    expect(variantInputFingerprint({ ...value, settings: { ...value.settings, action: "walking" } })).not.toBe(fingerprint);
  });

  it("rejects a forged motion entry without its independently approved plate and video", () => {
    const value = {
      ...scene(),
      motions: [{
        presetId: "low_angle",
        generationId: "00000000-0000-4000-8000-000000000001",
        jobId: "00000000-0000-4000-8000-000000000002",
        previewId: null,
      }],
    };
    expect(() => validateVariantStructure(value)).toThrow("approved plate");
  });
});