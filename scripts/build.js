#!/usr/bin/env node
// Production build entry point invoked by the Replit autoscale deployer.
// The deployer calls `node scripts/build.js` as its cached build command.
// This script shells out to replit-node.sh, which resolves the correct Node
// binary and runs `vite build` with a 3 GB heap cap.
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const result = spawnSync(
  "bash",
  ["scripts/replit-node.sh", "node_modules/vite/bin/vite.js", "build"],
  {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=3072" },
  },
);

process.exit(result.status ?? 1);
