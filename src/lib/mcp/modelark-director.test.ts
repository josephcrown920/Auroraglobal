import { describe, expect, it } from "bun:test";
import { modelArkDirectorSchema } from "./modelark-director.server";

describe("ModelArk director tool", () => {
  it("accepts a production instruction and optional structured context", () => {
    const parsed = modelArkDirectorSchema.parse({
      instruction: "Create a 15-second cinematic performance shot with a 9:16 delivery.",
      context: { aspect_ratio: "9:16", duration: 15 },
    });

    expect(parsed.instruction).toContain("cinematic performance");
    expect(parsed.context).toEqual({ aspect_ratio: "9:16", duration: 15 });
  });

  it("rejects an empty instruction", () => {
    expect(() => modelArkDirectorSchema.parse({ instruction: "" })).toThrow();
  });
});
