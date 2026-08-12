import { afterEach, describe, expect, test } from "bun:test";
import { authNextSearch, parseAuthReturnPath, safeAuthReturnPath } from "./auth-return-path";

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

describe("authNextSearch", () => {
  const g = globalThis as { window?: unknown };
  const originalWindow = g.window;
  afterEach(() => {
    if (originalWindow === undefined) delete g.window;
    else g.window = originalWindow;
  });

  function stubLocation(pathname: string, search = "", hash = "") {
    g.window = { location: { pathname, search, hash } };
  }

  test("returns the current page as next", () => {
    stubLocation("/motion");
    expect(authNextSearch()).toEqual({ next: "/motion" });
  });

  test("preserves query and hash for deep links", () => {
    stubLocation("/video-agent-edit", "?id=abc-123", "#step-2");
    expect(authNextSearch()).toEqual({ next: "/video-agent-edit?id=abc-123#step-2" });
    stubLocation("/canvas", "?template=neon-strut");
    expect(authNextSearch()).toEqual({ next: "/canvas?template=neon-strut" });
  });

  test("returns undefined on the landing page and during SSR", () => {
    stubLocation("/");
    expect(authNextSearch()).toBeUndefined();
    delete g.window;
    expect(authNextSearch()).toBeUndefined();
  });
});

describe("parseAuthReturnPath", () => {
  test("splits a deep link into pathname, search object, and hash for the router", () => {
    expect(parseAuthReturnPath("/video-agent-edit?id=abc-123#step-2")).toEqual({
      pathname: "/video-agent-edit",
      search: { id: "abc-123" },
      hash: "step-2",
    });
  });

  test("handles plain paths and multi-param queries", () => {
    expect(parseAuthReturnPath("/studio")).toEqual({ pathname: "/studio", search: {}, hash: "" });
    expect(parseAuthReturnPath("/canvas?template=neon&marketplaceTemplateId=u-1")).toEqual({
      pathname: "/canvas",
      search: { template: "neon", marketplaceTemplateId: "u-1" },
      hash: "",
    });
  });

  test("preserves repeated query keys instead of flattening them", () => {
    expect(parseAuthReturnPath("/gallery?tag=a&tag=b&tag=c")).toEqual({
      pathname: "/gallery",
      search: { tag: ["a", "b", "c"] },
      hash: "",
    });
  });

  test("captures the hash fragment for CLI authorize style deep links", () => {
    const g = globalThis as { window?: unknown };
    const original = g.window;
    g.window = { location: { pathname: "/cli/authorize", search: "?code=ABCD-1234", hash: "#device" } };
    try {
      const next = authNextSearch();
      expect(next).toEqual({ next: "/cli/authorize?code=ABCD-1234#device" });
      expect(parseAuthReturnPath(next!.next)).toEqual({
        pathname: "/cli/authorize",
        search: { code: "ABCD-1234" },
        hash: "device",
      });
    } finally {
      if (original === undefined) delete g.window;
      else g.window = original;
    }
  });

  test("round-trips authNextSearch output so post-sign-in navigation matches the origin", () => {
    const g = globalThis as { window?: unknown };
    const original = g.window;
    g.window = { location: { pathname: "/video-agent-edit", search: "?id=p1", hash: "" } };
    try {
      const next = authNextSearch();
      expect(next).toBeDefined();
      expect(parseAuthReturnPath(next!.next)).toEqual({
        pathname: "/video-agent-edit",
        search: { id: "p1" },
        hash: "",
      });
    } finally {
      if (original === undefined) delete g.window;
      else g.window = original;
    }
  });
});