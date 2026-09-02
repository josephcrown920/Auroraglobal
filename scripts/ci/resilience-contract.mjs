#!/usr/bin/env node
/**
 * Static contract for Aurora's onion resilience layer.
 * This intentionally checks architecture, not deployment-provider behavior.
 */
import { readFile } from "node:fs/promises";

const files = {
  boundary: "src/components/ErrorBoundary.tsx",
  router: "src/router.tsx",
  root: "src/routes/__root.tsx",
  sw: "public/sw.js",
  knownGood: ".github/workflows/known-good.yml",
  watchdog: ".github/workflows/production-watchdog.yml",
  rollback: ".github/workflows/rollback.yml",
  docs: "docs/PRODUCTION-RESILIENCE.md",
  ci: ".github/workflows/ci.yml",
};

const contents = Object.fromEntries(
  await Promise.all(Object.entries(files).map(async ([key, path]) => [key, await readFile(path, "utf8")])),
);

const checks = [
  ["global React error boundary", contents.boundary.includes("export class ErrorBoundary")],
  ["global boundary mounted in root", contents.root.includes("<ErrorBoundary>")],
  ["stale chunk detection", contents.boundary.includes("isStaleChunkError")],
  ["guarded stale chunk reload", contents.boundary.includes("reloadOnceForStaleChunk")],
  ["router error fallback", contents.router.includes("defaultErrorComponent")],
  ["router pending fallback", contents.router.includes("defaultPendingComponent")],
  ["hashed asset cache strategy", contents.sw.includes("/assets/") && contents.sw.includes("Cache-first")],
  ["network-first navigation fallback", contents.sw.includes("function networkFirst") && contents.sw.includes("offline.html")],
  ["API network isolation", contents.sw.includes("function isApiCall")],
  ["known-good certification workflow", contents.knownGood.includes("production-known-good") && contents.knownGood.includes("production-certified-")],
  ["watchdog health probing", contents.watchdog.includes("AURORA_HEALTHCHECK_URL") && contents.watchdog.includes("three consecutive")],
  ["watchdog authenticated rollback bridge", contents.watchdog.includes("AURORA_ROLLBACK_WEBHOOK_URL") && contents.watchdog.includes("AURORA_ROLLBACK_WEBHOOK_SECRET") && contents.watchdog.includes("authorization: Bearer")],
  ["manual rollback only uses certified targets", contents.rollback.includes("production-known-good") && contents.rollback.includes("production-certified-[0-9a-f]")],
  ["manual rollback bridge authentication", contents.rollback.includes("AURORA_ROLLBACK_WEBHOOK_SECRET") && contents.rollback.includes("authorization: Bearer")],
  ["resilience documentation", contents.docs.includes("AURORA_ROLLBACK_WEBHOOK_SECRET") && contents.docs.includes("fail closed")],
  ["quality gate enforces resilience contract", contents.ci.includes("node scripts/ci/resilience-contract.mjs")],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
if (failed.length) process.exit(1);
console.log(`Resilience contract: ${checks.length}/${checks.length} checks passed.`);
