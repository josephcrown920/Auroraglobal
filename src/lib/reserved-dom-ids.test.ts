import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Browsers expose every element id as a property on `window`. An element with
 * id="process" therefore becomes `window.process`, and Vite's dev-time define
 * injection (`process.env.TSS_SERVER_FN_BASE = "/_serverFn/"`) writes onto that
 * DOM node instead of a real global. As soon as hydration or navigation swaps
 * the node out, every lazily-imported server-function module throws
 * "Cannot read properties of undefined (reading 'TSS_SERVER_FN_BASE')" — which
 * is exactly how landing → Sign in broke in the preview. Keep these names out of
 * markup ids.
 */
const RESERVED_IDS = ["process", "global", "globalThis", "module", "exports", "require", "define", "Buffer"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|jsx|html)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("DOM ids never shadow bundler globals", () => {
  // The synchronous full-src-tree walk below can exceed bun's default 5s
  // test timeout purely from system contention when run alongside the full
  // test suite, lint, typecheck, and e2e concurrently (observed flake, not a
  // correctness issue — the same scan finishes in well under 100ms in
  // isolation). Give it real headroom instead of a hair-trigger timeout.
  test(
    "no src markup uses a reserved id",
    () => {
      const pattern = new RegExp(`\\bid=["'](${RESERVED_IDS.join("|")})["']`);
      const offenders = walk(join(import.meta.dir, "..")).filter((file) => pattern.test(readFileSync(file, "utf8")));
      expect(offenders).toEqual([]);
    },
    20_000,
  );
});
