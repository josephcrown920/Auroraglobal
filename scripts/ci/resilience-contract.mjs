#!/usr/bin/env node
/**
 * Static contract for Aurora's onion resilience layer.
 * This intentionally checks architecture, not deployment-provider behavior.
 */
import { readFile } from "node:fs/promises";

const files = {
  boundary: "src/components/ErrorBoundary.tsx",
  router: "src/router.tsx",
  sw: "public/sw.js",
};

const contents = Object.fromEntries(
  await Promise.all(Object.entries(files).map(async ([key, path]) => [key, await readFile(path, "utf8")])),
);

const checks = [
  ["global React error boundary", contents.boundary.includes("export class ErrorBoundary")],
  ["stale chunk detection", contents.boundary.includes("isStaleChunkError")],
  ["guarded stale chunk reload", contents.boundary.includes("reloadOnceForStaleChunk")],
  ["router error fallback", contents.router.includes("defaultErrorComponent")],
  ["router pending fallback", contents.router.includes("defaultPendingComponent")],
  ["hashed asset cache strategy", contents.sw.includes("/assets/") && contents.sw.includes("Cache-first")],
  ["network-first navigation fallback", contents.sw.includes("function networkFirst") && contents.sw.includes("offline.html")],
  ["API network isolation", contents.sw.includes("function isApiCall")],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) process.exit(1);
console.log(`Resilience contract: ${checks.length}/${checks.length} checks passed.`);
