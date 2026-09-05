#!/usr/bin/env node
// Onion layer 1+2: immutable build snapshots with a health-gated
// last-known-good pointer (see docs/BACKUP_AND_DR.md).
//
// Layout (SNAP_ROOT, default .build-snapshots/):
//   snapshots/<yyyymmdd-hhmmssz>-<sha>/   immutable timestamped build copies
//   current                               symlink -> newest snapshot (moved right after a build)
//   last-known-good                       symlink -> newest snapshot that PASSED the health gate
//
// Symlink targets are RELATIVE so the whole tree can be relocated (deploy
// containers, recovery-drill scratch copies) without breaking pointers.
//
// Copies are made with `cp -al` (hardlink farm) so retaining several 500+MB
// snapshots costs almost nothing for unchanged files. This is safe because
// vite empties and rewrites .output on every build — it never mutates an
// existing output file in place, so shared inodes are never written through.
//
// Usage:
//   build-snapshot.mjs            snapshot $AURORA_BUILD_OUTPUT (default .output),
//                                 move `current`, rotate old snapshots
//   build-snapshot.mjs --promote  point last-known-good at the current candidate
//                                 (only ever called after the health gate passes)
//
// Env: AURORA_BUILD_OUTPUT, AURORA_SNAPSHOT_DIR, AURORA_SNAPSHOT_RETAIN (default 3)
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = path.resolve(root, process.env.AURORA_BUILD_OUTPUT ?? ".output");
const SNAP_ROOT = path.resolve(root, process.env.AURORA_SNAPSHOT_DIR ?? ".build-snapshots");
const RETAIN = Math.max(1, Number(process.env.AURORA_SNAPSHOT_RETAIN ?? "3") || 3);
const SNAPS = path.join(SNAP_ROOT, "snapshots");
const CURRENT = path.join(SNAP_ROOT, "current");
const LKG = path.join(SNAP_ROOT, "last-known-good");

const fail = (msg) => {
  console.error(`[snapshot] FAIL: ${msg}`);
  process.exit(1);
};
const readlink = (p) => {
  try {
    return fs.readlinkSync(p);
  } catch {
    return null;
  }
};
// Atomic pointer move: build a temp symlink, then rename over the old one.
const pointAt = (link, target) => {
  const tmp = `${link}.tmp-${process.pid}`;
  try {
    fs.unlinkSync(tmp);
  } catch {}
  fs.symlinkSync(target, tmp);
  fs.renameSync(tmp, link);
};

function snapshot() {
  if (!fs.existsSync(path.join(OUTPUT_DIR, "server", "index.mjs"))) {
    fail(`${OUTPUT_DIR}/server/index.mjs missing — refusing to snapshot an incomplete build.`);
  }
  fs.mkdirSync(SNAPS, { recursive: true });

  const iso = new Date().toISOString(); // 2026-09-05T00:55:30.123Z
  const ts = `${iso.slice(0, 10).replace(/-/g, "")}-${iso.slice(11, 19).replace(/:/g, "")}z`;
  let sha = "nogit";
  try {
    sha = execFileSync("git", ["rev-parse", "--short", "Main"], {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {}

  let name = `${ts}-${sha}`;
  let n = 1;
  while (fs.existsSync(path.join(SNAPS, name))) name = `${ts}-${sha}-${++n}`; // same-second rebuilds
  const dest = path.join(SNAPS, name);
  fs.mkdirSync(dest, { recursive: true });

  try {
    execFileSync("cp", ["-al", `${OUTPUT_DIR}/.`, dest], { stdio: ["ignore", "ignore", "pipe"] });
  } catch {
    execFileSync("cp", ["-a", `${OUTPUT_DIR}/.`, dest], { stdio: "inherit" }); // fs without hardlink support
  }
  fs.writeFileSync(
    path.join(dest, "BUILD_INFO.json"),
    JSON.stringify(
      { builtAt: new Date().toISOString(), gitSha: sha, node: process.version, source: path.relative(root, OUTPUT_DIR) },
      null,
      2,
    ) + "\n",
  );

  pointAt(CURRENT, path.posix.join("snapshots", name));
  console.log(`[snapshot] current -> snapshots/${name}`);

  // Rotate: keep the newest RETAIN snapshots, but NEVER delete the snapshot
  // last-known-good currently points at (it is the restore target).
  const protectedName = (readlink(LKG) ?? "").split("/").pop();
  const all = fs
    .readdirSync(SNAPS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort(); // timestamp prefix sorts oldest-first
  let excess = all.length - RETAIN;
  for (const dir of all) {
    if (excess <= 0) break;
    if (dir === protectedName || dir === name) continue;
    fs.rmSync(path.join(SNAPS, dir), { recursive: true, force: true });
    console.log(`[snapshot] rotated out snapshots/${dir}`);
    excess--;
  }
}

function promote() {
  const target = readlink(CURRENT);
  if (!target) fail("no `current` candidate to promote.");
  if (!fs.existsSync(path.join(SNAP_ROOT, target, "server", "index.mjs"))) {
    fail(`current candidate ${target} has no server entry — refusing to promote a broken build.`);
  }
  pointAt(LKG, target);
  console.log(`[snapshot] last-known-good -> ${target}`);
}

if (process.argv.includes("--promote")) promote();
else snapshot();
