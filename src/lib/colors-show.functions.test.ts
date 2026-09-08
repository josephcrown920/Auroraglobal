import { describe, expect, it } from "bun:test";
import {
  assertColorsShowReferencesOwned,
  buildColorsShowRenderInput,
  COLORS_SHOW_ALLOWED_MODELS,
  COLORS_SHOW_ALLOWED_PROVIDERS,
} from "./colors-show.functions";

const url = (name: string) => `https://project.supabase.co/storage/v1/object/sign/studio/user/${name}.jpg`;
const input = {
  selfieUrl: url("identity"), outfitRefUrl: url("outfit"), wideRefUrl: url("wide"), closeupRefUrl: url("closeup"),
  shotType: "wide" as const, colorName: "crimson", outfit: "black tailored suit",
};

describe("Colors Show strict reference dispatch", () => {
  it("checks every submitted role reference", async () => {
    const checked: string[] = [];
    await assertColorsShowReferencesOwned(input, "user", async (reference) => { checked.push(reference); });
    expect(checked.sort()).toEqual([input.selfieUrl, input.outfitRefUrl, input.wideRefUrl, input.closeupRefUrl].sort());
  });

  it("uses a fail-closed multi-reference edit route", () => {
    const dispatch = buildColorsShowRenderInput(input);
    expect(dispatch.imageUrls).toEqual([input.selfieUrl, input.outfitRefUrl, input.wideRefUrl]);
    expect(dispatch.editStrict).toBe(true);
    expect(dispatch.allowedModels).toEqual([...COLORS_SHOW_ALLOWED_MODELS]);
    expect(dispatch.allowedProviders).toEqual([...COLORS_SHOW_ALLOWED_PROVIDERS]);
    expect(dispatch.allowedModels).not.toContain("gpt-image-1");
    expect(dispatch.allowedProviders).not.toContain("replit");
  });
});