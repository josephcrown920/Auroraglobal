#!/usr/bin/env node
/**
 * Run each Bun test file in its own process.
 *
 * Aurora has server/provider tests that intentionally use mock.module() and
 * mutate process.env/globalThis.fetch. Bun's module mocks and globals are
 * process-wide, so running the whole tree in one Bun process makes otherwise
 * independent suites order-dependent. A fresh process per file gives every
 * suite a clean module registry and environment while preserving the same
 * test files and assertions.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = join(process.cwd(), "src");

function collect(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(path));
    else if (/\.test\.(?:ts|tsx|js|jsx)$/.test(entry.name)) out.push(path);
  }
  return out;
}

const files = collect(root).sort();
if (files.length === 0) {
  console.error("No test files found under src/");
  process.exit(1);
}

console.log(`Running ${files.length} test files in isolated Bun processes...`);

for (const file of files) {
  console.log(`\n=== ${file} ===`);
  const result = spawnSync("bun", ["test", file], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.error) {
    console.error(`Failed to start Bun for ${file}:`, result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`\nTest file failed: ${file}`);
    process.exit(result.status ?? 1);
  }
}

console.log(`\nAll ${files.length} test files passed in isolated processes.`);
