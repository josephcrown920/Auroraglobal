#!/usr/bin/env node
/**
 * Guard the runtime boundary used by the optional Cloudflare build.
 *
 * Native Node modules are valid in the canonical Replit Node deployment, but
 * they must never leak into shared browser code or a Worker entry module.
 * Server-only files and the explicitly Node-only media/worker endpoints are
 * reported as an allowlisted boundary instead of being silently ignored.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const forbidden = new Set([
  "sharp",
  "canvas",
  "child_process",
  "node:child_process",
  "fs",
  "node:fs",
  "fs/promises",
  "node:fs/promises",
  "worker_threads",
  "node:worker_threads",
]);

const explicitlyNodeOnly = new Set([
  "src/routes/api/public/faststart-video.ts",
  "src/routes/api/public/watermark-image.ts",
  "src/routes/api/public/watermark-video.ts",
  "src/routes/api/public/workers/files/$name.ts",
  "src/routes/api/public/github-sync-monitor.ts",
  "src/routes/api/public/watchdog.ts",
  "src/lib/github-sync-health.functions.ts",
]);

function walk(dir) {
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    else if (/\.(?:ts|tsx|js|jsx)$/.test(name)) files.push(full);
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

const importPattern =
  /\b(?:import|export)\s+(?:[^"'`]*?\s+from\s+)?["'`]([^"'`]+)["'`]|import\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
const violations = [];
const allowlisted = [];

for (const file of walk(sourceRoot)) {
  const rel = relative(file);
  const isServerOnly = /\.server(?:\.[cm]?[jt]sx?)$/.test(rel);
  const isTest = /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(rel);
  const text = fs.readFileSync(file, "utf8");
  for (const match of text.matchAll(importPattern)) {
    const specifier = match[1] ?? match[2];
    if (!forbidden.has(specifier)) continue;
    if (isServerOnly || isTest || explicitlyNodeOnly.has(rel)) {
      allowlisted.push(`${rel} -> ${specifier}`);
    } else {
      violations.push(`${rel} -> ${specifier}`);
    }
  }
}

if (violations.length) {
  console.error("Worker boundary audit failed. Move these imports behind a Node-only boundary:");
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

console.log(
  `Worker boundary audit passed: ${allowlisted.length} native imports are confined to documented Node-only files.`,
);