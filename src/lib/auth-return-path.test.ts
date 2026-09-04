import { afterEach, describe, expect, test } from "bun:test";
import {
  authNextSearch,
  isAuthRedirectInFlight,
  parseAuthReturnPath,
  safeAuthReturnPath,
} from "./auth-return-path";

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

  test("never nests the auth page inside its own return path", () => {
    stubLocation("/auth");
    expect(authNextSearch()).toBeUndefined();
    stubLocation("/auth", "", "#access_token=abc");
    expect(authNextSearch()).toBeUndefined();
  });

  test("keeps the return path a first redirect already put on /auth", () => {
    // The root layout remounts the pending page once the URL flips to /auth,
    // so route guards call this a second time; that call must not wipe next=.
    stubLocation("/auth", "?next=%2Fadmin");
    expect(authNextSearch()).toEqual({ next: "/admin" });
    stubLocation("/auth", "?next=%2Fvideo-agent-edit%3Fid%3Dabc%23step-2");
    expect(authNextSearch()).toEqual({ next: "/video-agent-edit?id=abc#step-2" });
  });

  test("drops an unsafe or root next= already on /auth instead of re-using it", () => {
    stubLocation("/auth", "?next=https%3A%2F%2Fevil.example%2F");
    expect(authNextSearch()).toBeUndefined();
    stubLocation("/auth", "?next=%2F");
    expect(authNextSearch()).toBeUndefined();
  });
});

describe("isAuthRedirectInFlight", () => {
  const g = globalThis as { window?: unknown };
  const originalWindow = g.window;
  afterEach(() => {
    if (originalWindow === undefined) delete g.window;
    else g.window = originalWindow;
  });

  test("is true only once the URL already points at /auth (and never during SSR)", () => {
    g.window = { location: { pathname: "/auth", search: "?next=%2Fadmin", hash: "" } };
    expect(isAuthRedirectInFlight()).toBe(true);
    g.window = { location: { pathname: "/admin", search: "", hash: "" } };
    expect(isAuthRedirectInFlight()).toBe(false);
    delete g.window;
    expect(isAuthRedirectInFlight()).toBe(false);
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