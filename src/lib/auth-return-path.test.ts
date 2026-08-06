import { describe, expect, test } from "bun:test";
import { safeAuthReturnPath } from "./auth-return-path";

describe("safeAuthReturnPath", () => {
  test("keeps internal paths, queries, and hashes", () => {
    expect(safeAuthReturnPath("/motion")).toBe("/motion");
    expect(safeAuthReturnPath("/avatar?tab=shots#recent")).toBe("/avatar?tab=shots#recent");
  });

  test("rejects external, protocol-relative, and backslash redirect targets", () => {
    expect(safeAuthReturnPath("https://evil.example")).toBeUndefined();
    expect(safeAuthReturnPath("//evil.example")).toBeUndefined();
    expect(safeAuthReturnPath("/\\evil.example")).toBeUndefined();
    expect(safeAuthReturnPath("/%5Cevil.example")).toBeUndefined();
    expect(safeAuthReturnPath("/%255Cevil.example")).toBeUndefined();
  });
});