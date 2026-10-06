import { describe, expect, it } from "bun:test";
import { buildViralPreviewUrl, ViralPreviewInputSchema } from "./viral-preview";

describe("viral preview", () => {
  it("builds a deterministic vertical Pollinations image URL", () => {
    const first = buildViralPreviewUrl("  my new single just dropped ");
    const second = buildViralPreviewUrl("my new single just dropped");

    expect(first).toBe(second);
    expect(first).toContain("image.pollinations.ai");
    expect(first).toContain("width=720");
    expect(first).toContain("height=1280");
    expect(first).toContain("nologo=true");
  });

  it("rejects blank and oversized topics", () => {
    expect(ViralPreviewInputSchema.safeParse({ topic: " " }).success).toBe(false);
    expect(ViralPreviewInputSchema.safeParse({ topic: "x".repeat(121) }).success).toBe(false);
  });
});