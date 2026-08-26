import { describe, expect, test } from "bun:test";
import {
  isStaleChunkError,
  reloadOnceForStaleChunk,
  RELOAD_GUARD_TTL_MS,
} from "./stale-chunk";

describe("isStaleChunkError", () => {
  const staleMessages = [
    "Failed to fetch dynamically imported module: https://x/assets/studio-abc.js",
    "TypeError: error loading dynamically imported module",
    "Importing a module script failed.",
    "ChunkLoadError: Loading chunk 42 failed",
    "Unable to preload CSS for /assets/index-abc.css",
    "Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of 'text/html' is not a valid JavaScript MIME type",
  ];
  for (const msg of staleMessages) {
    test(`matches: ${msg.slice(0, 48)}…`, () => {
      expect(isStaleChunkError(new Error(msg))).toBe(true);
      expect(isStaleChunkError(msg)).toBe(true);
    });
  }

  test("does NOT match ordinary runtime/network errors", () => {
    expect(isStaleChunkError(new Error("Failed to fetch"))).toBe(false);
    expect(isStaleChunkError(new TypeError("x is not a function"))).toBe(false);
    expect(isStaleChunkError(new Error("Request timed out"))).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
    expect(isStaleChunkError(undefined)).toBe(false);
    expect(isStaleChunkError({})).toBe(false);
  });

  test("reads .message off non-Error objects", () => {
    expect(isStaleChunkError({ message: "ChunkLoadError: Loading chunk 9 failed" })).toBe(true);
  });
});

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe("reloadOnceForStaleChunk", () => {
  test("reloads on first failure and stamps the guard", () => {
    const storage = fakeStorage();
    let reloads = 0;
    const ok = reloadOnceForStaleChunk("/studio", {
      storage,
      now: () => 1_000_000,
      reload: () => void reloads++,
    });
    expect(ok).toBe(true);
    expect(reloads).toBe(1);
    expect(storage.map.size).toBe(1);
  });

  test("refuses a second reload for the same path inside the TTL", () => {
    const storage = fakeStorage();
    let reloads = 0;
    const deps = { storage, now: () => 1_000_000, reload: () => void reloads++ };
    expect(reloadOnceForStaleChunk("/studio", deps)).toBe(true);
    expect(reloadOnceForStaleChunk("/studio", { ...deps, now: () => 1_000_000 + 5_000 })).toBe(false);
    expect(reloads).toBe(1);
  });

  test("allows a reload again after the TTL expires", () => {
    const storage = fakeStorage();
    let reloads = 0;
    const base = 1_000_000;
    expect(
      reloadOnceForStaleChunk("/studio", { storage, now: () => base, reload: () => void reloads++ }),
    ).toBe(true);
    expect(
      reloadOnceForStaleChunk("/studio", {
        storage,
        now: () => base + RELOAD_GUARD_TTL_MS + 1,
        reload: () => void reloads++,
      }),
    ).toBe(true);
    expect(reloads).toBe(2);
  });

  test("different paths guard independently", () => {
    const storage = fakeStorage();
    let reloads = 0;
    const deps = { storage, now: () => 1_000_000, reload: () => void reloads++ };
    expect(reloadOnceForStaleChunk("/studio", deps)).toBe(true);
    expect(reloadOnceForStaleChunk("/motion", deps)).toBe(true);
    expect(reloads).toBe(2);
  });

  test("never reloads when storage is unavailable or throwing", () => {
    let reloads = 0;
    expect(
      reloadOnceForStaleChunk("/studio", {
        storage: undefined,
        reload: () => void reloads++,
      }),
    ).toBe(false);
    expect(
      reloadOnceForStaleChunk("/studio", {
        storage: {
          getItem: () => {
            throw new Error("blocked");
          },
          setItem: () => {
            throw new Error("blocked");
          },
        },
        reload: () => void reloads++,
      }),
    ).toBe(false);
    expect(reloads).toBe(0);
  });
});
