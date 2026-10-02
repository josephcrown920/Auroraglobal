import { describe, expect, it } from "bun:test";
import { isModelArkAssetUri, modelArkAssetUri, seedanceReferenceMessage } from "./seedance-reference-policy";

describe("Seedance reference policy", () => {
  it("builds an asset URI from an approved asset id", () => {
    expect(modelArkAssetUri("portrait_123")).toBe("asset://portrait_123");
  });
  it("rejects malformed asset ids", () => {
    expect(() => modelArkAssetUri("https://example.com/x")).toThrow();
    expect(() => modelArkAssetUri("bad id")).toThrow();
  });
  it("recognizes only ModelArk asset URIs", () => {
    expect(isModelArkAssetUri("asset://portrait_123")).toBe(true);
    expect(isModelArkAssetUri("https://example.com/photo.jpg")).toBe(false);
  });
  it("provides an actionable user message", () => {
    expect(seedanceReferenceMessage()).toContain("authorized ModelArk/LAS identity asset");
  });
});
