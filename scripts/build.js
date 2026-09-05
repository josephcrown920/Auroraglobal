#!/usr/bin/env node
// Production build entry point invoked by the Replit autoscale deployer.
// The deployer calls `node scripts/build.js` as its cached build command —
// that contract must not change. artifacts/web's production.build also
// delegates here via scripts/replit-node.sh.
//
// Onion layers (see docs/BACKUP_AND_DR.md):
//   1. After a successful vite build, .output is snapshotted to
//      .build-snapshots/snapshots/<ts>-<sha> and the `current` candidate
//      pointer is moved (with bounded rotation).
//   2. A post-build health gate boots the fresh snapshot and probes
//      /api/health; only a healthy build moves the `last-known-good` pointer.
//   3. A gate failure FAILS THE BUILD, so a build that compiles but cannot
//      boot is never deployed — the previously deployed instance keeps
//      serving, and the start-time guard (scripts/start-prod.sh) keeps a
//      restorable snapshot underneath everything.
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const run = (args, env = {}) =>
  spawnSync("bash", ["scripts/replit-node.sh", ...args], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });

const fail = (code, ...lines) => {
  for (const line of lines) console.error(`[build] ${line}`);
  process.exit(code ?? 1);
};

// 1. Compile. Respect a caller-provided NODE_OPTIONS — the dev-container
//    prod-build workflow passes 4608 MB, while the 4 GB deploy builder relies
//    on the 3072 MB default. Keep both in sync with the heap cap in
//    artifacts/web/.replit-artifact/artifact.toml (docs/BACKUP_AND_DR.md).
const build = run(["node_modules/vite/bin/vite.js", "build"], {
  NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=3072",
});
if (build.status !== 0) fail(build.status, "vite build failed — no snapshot taken, nothing promoted.");

// 2. Immutable timestamped snapshot + move `current` (rotates old snapshots).
const snap = run(["scripts/build-snapshot.mjs"]);
if (snap.status !== 0) fail(snap.status, "snapshot step failed — `current` NOT moved, last-known-good untouched.");

// 3. Health gate. The built server refuses to boot without SUPABASE_* runtime
//    values, so the gate can only run where those are visible. A build
//    environment that cannot show them to the gate is a FAIL-CLOSED result:
//    deploying an unprobed build would violate the core guarantee that a
//    build which compiles but won't boot never ships. The only way around is
//    the explicit, audited escape hatch below.
if (process.env.AURORA_BUILD_SKIP_HEALTH_GATE === "1") {
  console.warn("[build] WARNING: health gate skipped via AURORA_BUILD_SKIP_HEALTH_GATE=1 — last-known-good NOT moved.");
} else if (!(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  fail(
    1,
    "HEALTH GATE CANNOT RUN: SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY",
    "are not visible in this build environment, so the fresh build cannot be boot-probed.",
    "Refusing to deploy an unprobed build. Fix the build environment's secret visibility,",
    "or — as an explicitly audited emergency override only — re-run with AURORA_BUILD_SKIP_HEALTH_GATE=1.",
  );
} else {
  const gate = run(["scripts/health-gate.mjs", "--build-dir", ".build-snapshots/current"]);
  if (gate.status !== 0)
    fail(
      gate.status,
      "HEALTH GATE FAILED — this build compiles but does not boot/serve healthy.",
      "Failing the build so it is never deployed; the live deployment keeps serving and last-known-good is untouched.",
    );
  const promote = run(["scripts/build-snapshot.mjs", "--promote"]);
  if (promote.status !== 0) fail(promote.status, "promote failed after a healthy gate — investigate before redeploying.");
  console.log("[build] health gate passed — last-known-good updated.");
}
